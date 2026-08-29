/**
 * Prepare columns G (Raw Image) and H (Cloudinary Image) for the New Images sheet.
 * Output: scripts/new-images-gh-update.tsv (paste into G2:H178)
 *
 *   node scripts/prepare-new-images-sheet-update.js
 */

const fs = require("fs");
const path = require("path");

const URLS_CSV = path.join(__dirname, "new-images-with-urls.csv");
const SHEET_CSV = path.join(__dirname, "new-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "new-images-cloudinary-cache.json");
const OUT_TSV = path.join(__dirname, "new-images-gh-update.tsv");
const OUT_CSV = path.join(__dirname, "new-images-gh-update.csv");

const CLOUDINARY_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

function loadCloudinaryCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

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

function cloudinaryUrl(rawUrl, pid, cache) {
  const cached = cache[pid];
  if (cached?.crop_url) return cached.crop_url;
  if (cached?.upload_url) return CLOUDINARY_PREFIX + cached.upload_url;
  if (!rawUrl) return "";
  return CLOUDINARY_PREFIX + rawUrl;
}

function main() {
  const urlRows = parseCsv(fs.readFileSync(URLS_CSV, "utf8"));
  const sheetRows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"));
  const cache = loadCloudinaryCache();

  const byPid = new Map(urlRows.map((r) => [r.pid, r]));

  const lines = [];
  let withImage = 0;

  for (const row of sheetRows) {
    const fetched = byPid.get(row.pid);
    const raw = fetched?.status === "ok" ? fetched.image_url || "" : "";
    const cloudinary = cloudinaryUrl(raw, row.pid, cache);
    if (raw) withImage++;
    lines.push([raw, cloudinary].join("\t"));
  }

  fs.writeFileSync(OUT_TSV, lines.join("\n"), "utf8");

  const csvLines = ["pid,raw_image,cloudinary_image"];
  for (const row of sheetRows) {
    const fetched = byPid.get(row.pid);
    const raw = fetched?.status === "ok" ? fetched.image_url || "" : "";
    const cloudinary = cloudinaryUrl(raw, row.pid, cache);
    const esc = (s) => (s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s);
    csvLines.push([row.pid, esc(raw), esc(cloudinary)].join(","));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join("\n"), "utf8");

  console.log(`Rows: ${sheetRows.length}, with images: ${withImage}`);
  console.log(`Wrote ${OUT_TSV}`);
  console.log(`Wrote ${OUT_CSV}`);
}

main();
