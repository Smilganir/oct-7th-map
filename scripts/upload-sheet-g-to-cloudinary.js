/**
 * Upload New Images rows that have column G (raw) but empty H (Cloudinary crop URL).
 * Updates column H in the sheet and merges into new-images-cloudinary-cache.json.
 *
 *   node scripts/upload-sheet-g-to-cloudinary.js
 */

require("dotenv").config({ path: ".env.local" });
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q";
const SHEET_NAME = "New Images";
const CACHE_PATH = path.join(__dirname, "new-images-cloudinary-cache.json");
const KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
  "C:\\Users\\smilg\\credentials.json";

const CROP_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

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

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_* in .env.local");
    process.exit(1);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const sheets = await getSheetsWriteClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'`,
  });
  const values = res.data.values || [];
  const headers = values[0];
  const gIdx = headers.findIndex((h) => /raw image/i.test(h));
  const hIdx = headers.findIndex((h) => /cloudinary/i.test(h));
  const pidIdx = headers.findIndex((h) => /^pid$/i.test(h));

  const pending = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const pid = String(row[pidIdx] ?? "").trim();
    const raw = String(row[gIdx] ?? "").trim();
    const crop = String(row[hIdx] ?? "").trim();
    if (pid && raw && !crop) {
      pending.push({ pid, raw, sheetRow: i + 1 });
    }
  }

  if (!pending.length) {
    console.log("No rows with G filled and H empty.");
    return;
  }

  console.log(`Found ${pending.length} rows to upload.`);
  const cache = loadCache();
  const hUpdates = [];

  for (const item of pending) {
    if (cache[item.pid]?.crop_url) {
      console.log(`[${item.pid}] cached -> ${cache[item.pid].crop_url}`);
      hUpdates.push({ range: `'${SHEET_NAME}'!H${item.sheetRow}`, values: [[cache[item.pid].crop_url]] });
      continue;
    }

    const folder = folderFor(item.raw);
    const publicId = `${folder}/pid_${item.pid}`;
    let tmpPath = null;

    try {
      console.log(`[${item.pid}] ${item.raw}`);
      const buf = await downloadImage(item.raw);
      const ext = path.extname(new URL(item.raw).pathname.split("?")[0]) || ".jpg";
      tmpPath = path.join(os.tmpdir(), `new-img-${item.pid}-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buf);

      const result = await cloudinary.uploader.upload(tmpPath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      const cropUrl = CROP_PREFIX + result.secure_url;
      cache[item.pid] = {
        raw_url: item.raw,
        upload_url: result.secure_url,
        crop_url: cropUrl,
        folder,
        uploaded_at: new Date().toISOString(),
      };
      saveCache(cache);
      hUpdates.push({ range: `'${SHEET_NAME}'!H${item.sheetRow}`, values: [[cropUrl]] });
      console.log(`  -> ${cropUrl}`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      cache[item.pid] = {
        raw_url: item.raw,
        error: err.message,
        failed_at: new Date().toISOString(),
      };
      saveCache(cache);
    } finally {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  if (hUpdates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: hUpdates,
      },
    });
    console.log(`Updated column H for ${hUpdates.length} rows.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
