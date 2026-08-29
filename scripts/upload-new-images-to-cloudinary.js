/**
 * Upload New Images raw URLs to Cloudinary, then build face-crop delivery URLs.
 *
 * External memorial sites block Cloudinary fetch; upload locally first (like IDF/Police sheets).
 *
 *   node scripts/upload-new-images-to-cloudinary.js
 *   node scripts/upload-new-images-to-cloudinary.js --limit 5
 *   node scripts/upload-new-images-to-cloudinary.js --pid 2040
 *
 * Output: scripts/new-images-cloudinary-cache.json
 * Then:   npm run prepare-new-images-sheet && npm run upload-new-images-sheet
 */

require("dotenv").config({ path: ".env.local" });
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");

const URLS_CSV = path.join(__dirname, "new-images-with-urls.csv");
const SHEET_CSV = path.join(__dirname, "new-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "new-images-cloudinary-cache.json");

const CROP_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    let field = "";
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ",") i++;
      return field;
    }
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
      field += text[i++];
    }
    if (text[i] === ",") i++;
    return field;
  }

  const headers = [];
  while (i < len && text[i] !== "\n" && text[i] !== "\r") headers.push(readField());
  if (text[i] === "\r") i++;
  if (text[i] === "\n") i++;

  while (i < len) {
    if (text[i] === "\r" || text[i] === "\n") {
      i++;
      continue;
    }
    const row = {};
    for (const h of headers) row[h] = readField();
    rows.push(row);
    while (i < len && (text[i] === "\r" || text[i] === "\n")) i++;
  }
  return rows;
}

function refererFor(url) {
  try {
    const u = new URL(url);
    return u.origin + encodeURI(decodeURI(u.pathname)) + u.search;
  } catch {
    return "https://www.google.com/";
  }
}

function folderFor(row) {
  const source = row.source || "";
  const imageUrl = row.image_url || "";
  if (source.includes("police") || imageUrl.includes("police.gov.il")) {
    return "police_memorials";
  }
  if (source.includes("idf") || imageUrl.includes("idf.il")) {
    return "idf_memorials";
  }
  return "new_images";
}

function fetchHeaders(imageUrl, memorialUrl) {
  const headers = {
    "User-Agent": UA,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
  };
  if (imageUrl.includes("idf.il")) {
    headers.Referer = "https://www.idf.il/";
  } else if (memorialUrl) {
    headers.Referer = refererFor(memorialUrl);
  } else {
    headers.Referer = refererFor(imageUrl);
  }
  return headers;
}

function cropUrl(uploadUrl) {
  return uploadUrl ? CROP_PREFIX + uploadUrl : "";
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let pid = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === "--pid" && args[i + 1]) pid = args[++i];
  }
  return { limit, pid };
}

async function downloadImage(imageUrl, memorialUrl) {
  const res = await fetch(imageUrl, {
    headers: fetchHeaders(imageUrl, memorialUrl),
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`fetch ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) {
    throw new Error("image too small");
  }
  return buf;
}

async function main() {
  const { limit, pid: onlyPid } = parseArgs();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_* in .env.local");
    process.exit(1);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const urlRows = parseCsv(fs.readFileSync(URLS_CSV, "utf8"));
  const sheetRows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"));
  const memorialByPid = new Map(sheetRows.map((r) => [r.pid, r.memorial_url || r["הנצחה"] || ""]));

  const cache = loadCache();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const targets = urlRows.filter((r) => {
    if (r.status !== "ok" || !r.image_url) return false;
    if (onlyPid && r.pid !== onlyPid) return false;
    return true;
  });

  for (const row of targets) {
    if (uploaded >= limit) break;
    if (cache[row.pid]?.upload_url && cache[row.pid]?.crop_url) {
      skipped++;
      continue;
    }

    const memorialUrl = memorialByPid.get(row.pid) || row.memorial_url || "";
    const folder = folderFor(row);
    const publicId = `${folder}/pid_${row.pid}`;
    let tmpPath = null;

    try {
      console.log(`[${row.pid}] ${row.image_url}`);
      const buf = await downloadImage(row.image_url, memorialUrl);
      const ext = path.extname(new URL(row.image_url).pathname) || ".jpg";
      tmpPath = path.join(os.tmpdir(), `new-img-${row.pid}-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buf);

      const result = await cloudinary.uploader.upload(tmpPath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      cache[row.pid] = {
        raw_url: row.image_url,
        upload_url: result.secure_url,
        crop_url: cropUrl(result.secure_url),
        folder,
        uploaded_at: new Date().toISOString(),
      };
      saveCache(cache);
      uploaded++;
      console.log(`  -> ${result.secure_url}`);
    } catch (err) {
      failed++;
      cache[row.pid] = {
        raw_url: row.image_url,
        error: err.message,
        failed_at: new Date().toISOString(),
      };
      saveCache(cache);
      console.error(`  ERROR: ${err.message}`);
    } finally {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  const ok = Object.values(cache).filter((v) => v.upload_url).length;
  console.log(`Done. uploaded=${uploaded}, skipped=${skipped}, failed=${failed}, cached_ok=${ok}`);
  console.log(`Cache: ${CACHE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
