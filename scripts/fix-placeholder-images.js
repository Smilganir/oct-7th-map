/**
 * Fetch real images for placeholder rows and upload to Cloudinary (crop format).
 *
 *   node scripts/fix-placeholder-images.js
 *   node scripts/fix-placeholder-images.js --limit 10
 *   node scripts/fix-placeholder-images.js --pid 367
 *
 * Output:
 *   scripts/placeholder-images-with-urls.csv
 *   scripts/raw-images-cloudinary-cache.json (updated)
 */

require("dotenv").config({ path: ".env.local" });

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseCsv } = require("./lib/source-catalog");
const { getDbMetadataMap } = require("./lib/sheets-read");
const {
  sleep,
  loadIdfCache,
  resolveFromMemorial,
  resolveNli,
  resolveMako,
  refererFor,
} = require("./lib/image-resolve");

const SHEET_CSV = path.join(__dirname, "raw-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "raw-images-cloudinary-cache.json");
const OUT_CSV = path.join(__dirname, "placeholder-images-with-urls.csv");

const CROP_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PLACEHOLDER_MARKERS = [
  "nopicTerror",
  "placeholder%20men",
  "placeholder men",
  "candle.png",
];

function isPlaceholderUrl(url) {
  if (!url) return false;
  return PLACEHOLDER_MARKERS.some((m) => url.includes(m));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function cropUrl(uploadUrl) {
  return uploadUrl ? CROP_PREFIX + uploadUrl : "";
}

function folderFor(source, imageUrl) {
  if (source.includes("police") || imageUrl.includes("police.gov.il")) return "police_memorials";
  if (source.includes("idf") || imageUrl.includes("idf.il")) return "idf_memorials";
  if (source.includes("btl") || imageUrl.includes("laad.btl.gov.il")) return "btl_memorials";
  return "raw_images";
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

async function resolveImage(row, idfCache) {
  const memorialUrl = row.memorialUrl || "";
  const nliId = row.nliId || "";
  let memorialError = "";

  if (memorialUrl) {
    const memorial = await resolveFromMemorial(memorialUrl, idfCache);
    if (memorial?.imageUrl && !isPlaceholderUrl(memorial.imageUrl)) {
      return {
        imageUrl: memorial.imageUrl,
        source: memorial.source || "memorial",
        status: "ok",
        error: "",
      };
    }
    if (memorial?.error) memorialError = memorial.error;
  }

  if (nliId) {
    const nli = await resolveNli(nliId);
    if (nli?.imageUrl) {
      return { imageUrl: nli.imageUrl, source: nli.source || "nli", status: "ok", error: "" };
    }
    const mako = await resolveMako(nliId);
    if (mako?.imageUrl) {
      return { imageUrl: mako.imageUrl, source: mako.source || "mako", status: "ok", error: "" };
    }
    if (!memorialError && (nli?.error || mako?.error)) {
      memorialError = nli?.error || mako?.error;
    }
  }

  return {
    imageUrl: "",
    source: "",
    status: "failed",
    error: memorialError || "no image from memorial/NLI/Mako",
  };
}

async function downloadImage(imageUrl, memorialUrl) {
  const res = await fetch(imageUrl, {
    headers: fetchHeaders(imageUrl, memorialUrl),
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("image too small");
  return buf;
}

async function uploadToCloudinary(pid, imageUrl, source, memorialUrl, cache) {
  const folder = folderFor(source, imageUrl);
  const publicId = `${folder}/pid_${pid}`;
  let tmpPath = null;

  try {
    const buf = await downloadImage(imageUrl, memorialUrl);
    const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
    tmpPath = path.join(os.tmpdir(), `placeholder-${pid}-${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, buf);

    const result = await cloudinary.uploader.upload(tmpPath, {
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
    });

    cache[pid] = {
      raw_url: imageUrl,
      upload_url: result.secure_url,
      crop_url: cropUrl(result.secure_url),
      method: "upload",
      folder,
      source,
      updated_at: new Date().toISOString(),
    };
    saveCache(cache);
    return { ok: true, crop_url: cache[pid].crop_url };
  } catch (err) {
    cache[pid] = {
      raw_url: imageUrl,
      error: err.message,
      source,
      failed_at: new Date().toISOString(),
    };
    saveCache(cache);
    return { ok: false, error: err.message };
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

function writeResults(results) {
  const header = "pid,name,memorial_url,nli_id,image_url,source,status,error,crop_url";
  const lines = [
    header,
    ...results.map((r) =>
      ["pid", "name", "memorialUrl", "nliId", "imageUrl", "source", "status", "error", "cropUrl"]
        .map((k) => csvEscape(r[k]))
        .join(",")
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const pidIdx = args.indexOf("--pid");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const onlyPid = pidIdx >= 0 ? args[pidIdx + 1] : null;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_* in .env.local");
    process.exit(1);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const sheetRows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"));
  const { map: metadataMap } = await getDbMetadataMap();

  let targets = sheetRows
    .map((row) => {
      const pid = String(row.pid ?? "").trim();
      const imageUrl = String(row["Image URL"] ?? "").trim();
      const meta = metadataMap.get(pid) || {};
      return {
        pid,
        imageUrl,
        memorialUrl: meta.memorialUrl || "",
        nliId: meta.nliId || "",
        name: meta.name || "",
      };
    })
    .filter((row) => row.pid && isPlaceholderUrl(row.imageUrl));

  if (onlyPid) targets = targets.filter((r) => r.pid === onlyPid);
  if (Number.isFinite(limit)) targets = targets.slice(0, limit);

  console.log(`Placeholder targets: ${targets.length}`);
  const idfCache = loadIdfCache();
  const cache = loadCache();
  const results = [];
  let fetched = 0;
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    console.log(`[${i + 1}/${targets.length}] pid=${row.pid} ${row.name || ""}`);

    const resolved = await resolveImage(row, idfCache);
    if (resolved.status === "ok") fetched++;

    let cropUrlResult = "";
    if (resolved.imageUrl) {
      const up = await uploadToCloudinary(
        row.pid,
        resolved.imageUrl,
        resolved.source,
        row.memorialUrl,
        cache
      );
      if (up.ok) {
        uploaded++;
        cropUrlResult = up.crop_url;
        console.log(`  OK ${resolved.source} -> ${cropUrlResult.slice(0, 80)}...`);
      } else {
        failed++;
        console.log(`  UPLOAD FAIL: ${up.error}`);
      }
    } else {
      failed++;
      console.log(`  FETCH FAIL: ${resolved.error}`);
    }

    results.push({
      pid: row.pid,
      name: row.name,
      memorialUrl: row.memorialUrl,
      nliId: row.nliId,
      imageUrl: resolved.imageUrl,
      source: resolved.source,
      status: cropUrlResult ? "uploaded" : resolved.status,
      error: resolved.error || (cropUrlResult ? "" : "upload failed"),
      cropUrl: cropUrlResult,
    });

    await sleep(250);
  }

  writeResults(results);
  console.log(`\nDone. fetched=${fetched} uploaded=${uploaded} failed=${failed}`);
  console.log(`Results: ${OUT_CSV}`);
  console.log(`Cache: ${CACHE_PATH}`);
  console.log("Next: npm run prepare-raw-images-sheet");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
