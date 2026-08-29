/**
 * Manually triggered sync: new Oct_7th_DB rows → New Images tab.
 *
 * 1. Finds PIDs in Oct_7th_DB that are not yet in New Images or Raw Images.
 * 2. Appends those rows to New Images (columns A–F from DB).
 * 3. Resolves raw memorial image URLs → column G.
 * 4. Uploads to Cloudinary with face-crop prefix → column H.
 * 5. Writes scripts/new-images-export.json with all Oct_7th_DB entries.
 *
 * Usage:
 *   node scripts/sync-db-to-new-images.js
 *   node scripts/sync-db-to-new-images.js --dry-run
 *   node scripts/sync-db-to-new-images.js --pid 2500
 *   node scripts/sync-db-to-new-images.js --skip-upload   # copy rows only, no Cloudinary
 *
 * Prerequisites:
 *   - .env.local with CLOUDINARY_* credentials
 *   - Service account key with Editor access on the spreadsheet
 *   - npm run build-idf-image-cache (for IDF memorial pages)
 */

require("dotenv").config({ path: ".env.local" });

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");
const { google } = require("googleapis");
const { getTabValues } = require("./lib/sheets-read");
const {
  sleep,
  loadIdfCache,
  resolveFromMemorial,
  resolveNli,
} = require("./lib/image-resolve");

const SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q";
const DB_TAB = "Oct_7th_DB";
const NEW_IMAGES_TAB = "New Images";
const RAW_IMAGES_TAB = "Raw Images";
const KIDNAPPED_TAB = "Kidnapped Images";
const CACHE_PATH = path.join(__dirname, "new-images-cloudinary-cache.json");
const OUTPUT_JSON = path.join(__dirname, "new-images-export.json");
const KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
  "C:\\Users\\smilg\\credentials.json";

const CROP_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

const FALLBACK_IMAGE =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/https://res.cloudinary.com/dpol0pyoo/image/fetch/g_face/w_150,h_150/https://assets-global.website-files.com/6527c2936fb0dc6bcfaf4f0c/652be63bb52b8f954933d895_no%20image%20placeholder%20men.png";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function refererFor(url) {
  try {
    const u = new URL(url);
    return u.origin + encodeURI(decodeURI(u.pathname)) + u.search;
  } catch {
    return "https://www.google.com/";
  }
}

function folderFor(imageUrl) {
  if (imageUrl.includes("police.gov.il")) return "police_memorials";
  if (imageUrl.includes("idf.il")) return "idf_memorials";
  if (imageUrl.includes("btl.gov.il")) return "btl_memorials";
  return "new_images";
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
    headers.Referer = refererFor(imageUrl);
  }
  return headers;
}

function valuesToObjects(values) {
  if (!values?.length) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h ?? "").trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const rowValues = values[i] || [];
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      row[key] = String(rowValues[c] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

function pidSetFromTab(values, pidHeader = "pid") {
  const { rows } = valuesToObjects(values);
  const set = new Set();
  for (const row of rows) {
    const pid = String(row[pidHeader] ?? "").trim();
    if (pid) set.add(pid);
  }
  return set;
}

function cleanCell(value) {
  const s = String(value ?? "").trim();
  return s === "#N/A" ? "" : s;
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

async function getSheetsWriteClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

async function downloadImage(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: fetchHeaders(imageUrl),
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("image too small");
  return buf;
}

async function resolveRawImage(row, idfCache) {
  const memorialUrl = cleanCell(row["הנצחה"]);
  const nliId = cleanCell(row["הספריה הלאומית"]);

  if (memorialUrl) {
    const memorial = await resolveFromMemorial(memorialUrl, idfCache);
    if (memorial?.imageUrl) {
      return { rawUrl: memorial.imageUrl, source: memorial.source };
    }
  }

  if (nliId) {
    const nli = await resolveNli(nliId);
    if (nli?.imageUrl) {
      return { rawUrl: nli.imageUrl, source: nli.source };
    }
  }

  return { rawUrl: "", source: "", error: "no image resolved" };
}

async function uploadToCloudinary(pid, rawUrl, cache) {
  if (cache[pid]?.crop_url) {
    return { cropUrl: cache[pid].crop_url, uploadUrl: cache[pid].upload_url, cached: true };
  }

  const folder = folderFor(rawUrl);
  const publicId = `${folder}/pid_${pid}`;
  let tmpPath = null;

  try {
    const buf = await downloadImage(rawUrl);
    const ext = path.extname(new URL(rawUrl).pathname.split("?")[0]) || ".jpg";
    tmpPath = path.join(os.tmpdir(), `sync-new-img-${pid}-${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, buf);

    const result = await cloudinary.uploader.upload(tmpPath, {
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
    });

    const cropUrl = CROP_PREFIX + result.secure_url;
    cache[pid] = {
      raw_url: rawUrl,
      upload_url: result.secure_url,
      crop_url: cropUrl,
      folder,
      uploaded_at: new Date().toISOString(),
    };
    saveCache(cache);
    return { cropUrl, uploadUrl: result.secure_url, cached: false };
  } catch (err) {
    cache[pid] = {
      raw_url: rawUrl,
      error: err.message,
      failed_at: new Date().toISOString(),
    };
    saveCache(cache);
    throw err;
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

function buildNewImagesRow(dbRow, rawUrl, cropUrl) {
  return [
    cleanCell(dbRow.pid),
    cleanCell(dbRow["first name"]),
    cleanCell(dbRow["last name"]),
    cleanCell(dbRow["middle name"]),
    cleanCell(dbRow["הנצחה"]),
    cleanCell(dbRow["הספריה הלאומית"]),
    rawUrl || "",
    cropUrl || "",
  ];
}

function buildImageUrlMaps(newImagesValues, rawImagesValues, kidnappedValues, appendedRows = []) {
  const raw = new Map();
  const kidnapped = new Map();
  const newImg = new Map();

  for (const row of valuesToObjects(rawImagesValues).rows) {
    const pid = cleanCell(row.pid);
    const url = cleanCell(row["Image URL"]);
    if (pid && url) raw.set(pid, url);
  }

  for (const row of valuesToObjects(kidnappedValues).rows) {
    const pid = cleanCell(row.PID);
    const url = cleanCell(row["Cloudinary URL"]);
    if (pid && url) kidnapped.set(pid, url);
  }

  for (const row of valuesToObjects(newImagesValues).rows) {
    const pid = cleanCell(row.pid);
    const url = cleanCell(row["Cloudinary Image"]);
    if (pid && url) newImg.set(pid, url);
  }

  for (const row of appendedRows) {
    const pid = cleanCell(row[0]);
    const url = cleanCell(row[7]);
    if (pid && url) newImg.set(pid, url);
  }

  return { raw, kidnapped, newImg };
}

function lookupCloudinaryUrl(pid, maps) {
  const fromRaw = maps.raw.get(pid);
  if (fromRaw) return fromRaw;

  const fromKidnapped = maps.kidnapped.get(pid);
  if (fromKidnapped) return fromKidnapped;

  const fromNewImages = maps.newImg.get(pid);
  if (fromNewImages) return fromNewImages;

  return FALLBACK_IMAGE;
}

function buildExportEntries(dbRows, maps) {
  return dbRows
    .map((row) => {
      const pid = cleanCell(row.pid);
      return {
        pid,
        firstName: cleanCell(row["first name"]),
        lastName: cleanCell(row["last name"]),
        cloudinaryUrl: pid ? lookupCloudinaryUrl(pid, maps) : "",
      };
    })
    .filter((entry) => entry.pid)
    .sort((a, b) => Number(a.pid) - Number(b.pid));
}

async function writeExportJson(dbRows, maps, meta) {
  const payload = {
    generatedAt: new Date().toISOString(),
    spreadsheetId: SPREADSHEET_ID,
    sourceTab: DB_TAB,
    newRowsAdded: meta.newRowsAdded,
    newPids: meta.newPids,
    entries: buildExportEntries(dbRows, maps),
  };
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipUpload = args.includes("--skip-upload");
  const pidIdx = args.indexOf("--pid");
  const onlyPid = pidIdx >= 0 ? args[pidIdx + 1] : null;

  if (!skipUpload) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Missing CLOUDINARY_* in .env.local (or pass --skip-upload)");
      process.exit(1);
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  }

  console.log("Loading sheets...");
  const [dbValues, newImagesValues, rawImagesValues, kidnappedValues] = await Promise.all([
    getTabValues(DB_TAB),
    getTabValues(NEW_IMAGES_TAB),
    getTabValues(RAW_IMAGES_TAB),
    getTabValues(KIDNAPPED_TAB),
  ]);

  const { rows: dbRows } = valuesToObjects(dbValues);
  const newImagesPids = pidSetFromTab(newImagesValues);
  const rawImagesPids = pidSetFromTab(rawImagesValues);

  let candidates = dbRows.filter((row) => {
    const pid = cleanCell(row.pid);
    if (!pid) return false;
    if (newImagesPids.has(pid)) return false;
    if (rawImagesPids.has(pid)) return false;
    return true;
  });

  if (onlyPid) {
    candidates = candidates.filter((row) => cleanCell(row.pid) === onlyPid);
    if (!candidates.length) {
      const inDb = dbRows.some((row) => cleanCell(row.pid) === onlyPid);
      if (!inDb) {
        console.error(`PID ${onlyPid} not found in ${DB_TAB}`);
        process.exit(1);
      }
      if (newImagesPids.has(onlyPid)) {
        console.log(`PID ${onlyPid} already exists in ${NEW_IMAGES_TAB}.`);
      } else if (rawImagesPids.has(onlyPid)) {
        console.log(`PID ${onlyPid} already exists in ${RAW_IMAGES_TAB} (not synced to New Images).`);
      }
    }
  }

  console.log(
    `Found ${candidates.length} new row(s) in ${DB_TAB} (not in ${NEW_IMAGES_TAB} or ${RAW_IMAGES_TAB}).`
  );

  const idfCache = loadIdfCache();
  const cache = loadCache();
  const rowsToAppend = [];
  const newPids = [];

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const pid = cleanCell(row.pid);
    console.log(`\n[${i + 1}/${candidates.length}] PID ${pid}`);

    let rawUrl = "";
    let cropUrl = "";

    try {
      const resolved = await resolveRawImage(row, idfCache);
      rawUrl = resolved.rawUrl;
      if (rawUrl) {
        console.log(`  raw: ${rawUrl} (${resolved.source})`);
      } else {
        console.log(`  raw: (none) ${resolved.error || ""}`);
      }

      if (rawUrl && !skipUpload) {
        const uploaded = await uploadToCloudinary(pid, rawUrl, cache);
        cropUrl = uploaded.cropUrl;
        console.log(`  crop: ${cropUrl}${uploaded.cached ? " (cached)" : ""}`);
      } else if (rawUrl && skipUpload) {
        console.log("  crop: skipped (--skip-upload)");
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }

    rowsToAppend.push(buildNewImagesRow(row, rawUrl, cropUrl));
    newPids.push(pid);
    await sleep(200);
  }

  let finalNewImagesValues = newImagesValues;
  let appendedRows = [];

  if (rowsToAppend.length && !dryRun) {
    const sheets = await getSheetsWriteClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${NEW_IMAGES_TAB}'!A:H`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rowsToAppend },
    });
    console.log(`\nAppended ${rowsToAppend.length} row(s) to ${NEW_IMAGES_TAB}.`);
    finalNewImagesValues = await getTabValues(NEW_IMAGES_TAB);
    appendedRows = rowsToAppend;
  } else if (rowsToAppend.length && dryRun) {
    console.log(`\n[dry-run] Would append ${rowsToAppend.length} row(s) to ${NEW_IMAGES_TAB}.`);
    appendedRows = rowsToAppend;
  } else {
    console.log("\nNo new rows to append.");
  }

  const imageMaps = buildImageUrlMaps(
    finalNewImagesValues,
    rawImagesValues,
    kidnappedValues,
    dryRun ? appendedRows : []
  );

  const exportPayload = await writeExportJson(dbRows, imageMaps, {
    newRowsAdded: dryRun ? 0 : rowsToAppend.length,
    newPids: dryRun ? [] : newPids,
  });

  console.log(
    `\nWrote ${OUTPUT_JSON} (${exportPayload.entries.length} entries, ${exportPayload.newRowsAdded} new).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
