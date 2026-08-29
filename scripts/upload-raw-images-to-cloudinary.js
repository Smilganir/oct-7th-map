/**
 * Upload non-Cloudinary Raw Images URLs and normalize all to the face-crop delivery format.
 *
 *   node scripts/upload-raw-images-to-cloudinary.js
 *   node scripts/upload-raw-images-to-cloudinary.js --limit 10
 *   node scripts/upload-raw-images-to-cloudinary.js --pid 195
 *
 * Output: scripts/raw-images-cloudinary-cache.json
 * Then:   npm run prepare-raw-images-sheet && npm run upload-raw-images-sheet
 */

require("dotenv").config({ path: ".env.local" });
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");

const SHEET_CSV = path.join(__dirname, "raw-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "raw-images-cloudinary-cache.json");

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

function isStandardCropUrl(url) {
  return typeof url === "string" && url.startsWith(CROP_PREFIX);
}

function cropUrl(sourceUrl) {
  return sourceUrl ? CROP_PREFIX + sourceUrl : "";
}

function extractFetchTarget(url) {
  const marker = "/image/fetch/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const httpsIdx = rest.indexOf("https://");
  const httpIdx = rest.indexOf("http://");
  const start =
    httpsIdx >= 0 && (httpIdx < 0 || httpsIdx <= httpIdx) ? httpsIdx : httpIdx;
  return start >= 0 ? rest.slice(start) : null;
}

function folderFor(imageUrl) {
  if (imageUrl.includes("idf.il")) return "idf_memorials";
  if (imageUrl.includes("police.gov.il")) return "police_memorials";
  if (imageUrl.includes("laad.btl.gov.il")) return "btl_memorials";
  return "raw_images";
}

function normalizeWithoutUpload(imageUrl) {
  if (!imageUrl || isStandardCropUrl(imageUrl)) {
    return { crop_url: imageUrl, method: "unchanged" };
  }
  if (imageUrl.includes("res.cloudinary.com")) {
    if (imageUrl.includes("/image/upload/")) {
      return { crop_url: cropUrl(imageUrl), method: "wrap_upload" };
    }
    const fetchTarget = extractFetchTarget(imageUrl);
    if (fetchTarget) {
      return { crop_url: cropUrl(fetchTarget), method: "wrap_fetch" };
    }
  }
  return null;
}

function fetchHeaders(imageUrl) {
  const headers = {
    "User-Agent": UA,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
  };
  if (imageUrl.includes("idf.il")) {
    headers.Referer = "https://www.idf.il/";
  } else {
    try {
      const u = new URL(imageUrl);
      headers.Referer = u.origin + "/";
    } catch {
      headers.Referer = "https://www.google.com/";
    }
  }
  return headers;
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
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === "--pid" && args[i + 1]) pid = args[++i];
    if (args[i] === "--force") force = true;
  }
  return { limit, pid, force };
}

async function downloadImage(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: fetchHeaders(imageUrl),
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
  const { limit, pid: onlyPid, force } = parseArgs();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_* in .env.local");
    process.exit(1);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const sheetRows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"));
  const cache = loadCache();

  let processed = 0;
  let uploaded = 0;
  let wrapped = 0;
  let skipped = 0;
  let failed = 0;

  const targets = sheetRows.filter((row) => {
    const imageUrl = (row["Image URL"] || "").trim();
    if (!imageUrl) return false;
    if (onlyPid && row.pid !== onlyPid) return false;
    if (!force && isStandardCropUrl(imageUrl)) return false;
    if (!force && cache[row.pid]?.crop_url && !cache[row.pid]?.error) return false;
    return true;
  });

  console.log(`Targets: ${targets.length} (limit ${Number.isFinite(limit) ? limit : "none"})`);

  for (const row of targets) {
    if (processed >= limit) break;
    processed++;

    const imageUrl = row["Image URL"].trim();
    const normalized = normalizeWithoutUpload(imageUrl);

    if (normalized?.method === "unchanged") {
      skipped++;
      continue;
    }

    if (normalized) {
      cache[row.pid] = {
        raw_url: imageUrl,
        crop_url: normalized.crop_url,
        method: normalized.method,
        updated_at: new Date().toISOString(),
      };
      saveCache(cache);
      wrapped++;
      console.log(`[${row.pid}] ${normalized.method}`);
      continue;
    }

    const folder = folderFor(imageUrl);
    const publicId = `${folder}/pid_${row.pid}`;
    let tmpPath = null;

    try {
      console.log(`[${row.pid}] upload ${imageUrl}`);
      const buf = await downloadImage(imageUrl);
      const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
      tmpPath = path.join(os.tmpdir(), `raw-img-${row.pid}-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buf);

      const result = await cloudinary.uploader.upload(tmpPath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      cache[row.pid] = {
        raw_url: imageUrl,
        upload_url: result.secure_url,
        crop_url: cropUrl(result.secure_url),
        method: "upload",
        folder,
        updated_at: new Date().toISOString(),
      };
      saveCache(cache);
      uploaded++;
      console.log(`  -> ${result.secure_url}`);
    } catch (err) {
      failed++;
      cache[row.pid] = {
        raw_url: imageUrl,
        error: err.message,
        failed_at: new Date().toISOString(),
      };
      saveCache(cache);
      console.error(`  ERROR: ${err.message}`);
    } finally {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  const ok = Object.values(cache).filter((v) => v.crop_url).length;
  console.log(
    `Done. processed=${processed}, uploaded=${uploaded}, wrapped=${wrapped}, skipped=${skipped}, failed=${failed}, cached_ok=${ok}`
  );
  console.log(`Cache: ${CACHE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
