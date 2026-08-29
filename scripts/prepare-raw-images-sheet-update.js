/**
 * Build column B updates for Raw Images from raw-images-cloudinary-cache.json.
 *
 *   node scripts/prepare-raw-images-sheet-update.js
 *
 * Output:
 *   scripts/raw-images-gh-update.csv  (pid, image_url)
 *   scripts/raw-images-gh-update.tsv  (column B values in sheet row order, for paste into B2)
 */

const fs = require("fs");
const path = require("path");

const SHEET_CSV = path.join(__dirname, "raw-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "raw-images-cloudinary-cache.json");
const OUT_CSV = path.join(__dirname, "raw-images-gh-update.csv");
const OUT_TSV = path.join(__dirname, "raw-images-gh-update.tsv");

const CROP_PREFIX =
  "https://res.cloudinary.com/dpol0pyoo/image/fetch/c_crop,g_face/w_150,h_195,g_north/";

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

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function escCsv(value) {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolveImageUrl(row, cache) {
  const current = (row["Image URL"] || "").trim();
  const cached = cache[row.pid];
  if (cached?.crop_url) return cached.crop_url;
  return current;
}

function main() {
  const sheetRows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"));
  const cache = loadCache();

  const changed = [];
  const columnB = [];

  for (const row of sheetRows) {
    const current = (row["Image URL"] || "").trim();
    const next = resolveImageUrl(row, cache);
    columnB.push(next);
    if (next && next !== current) {
      changed.push({ pid: row.pid, image_url: next });
    }
  }

  const csvLines = ["pid,image_url"];
  for (const row of changed) {
    csvLines.push(`${row.pid},${escCsv(row.image_url)}`);
  }
  fs.writeFileSync(OUT_CSV, csvLines.join("\n"), "utf8");
  fs.writeFileSync(OUT_TSV, columnB.join("\n"), "utf8");

  const stillNonStandard = columnB.filter((url) => url && !url.startsWith(CROP_PREFIX)).length;
  console.log(`Rows: ${sheetRows.length}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Still non-standard after cache: ${stillNonStandard}`);
  console.log(`Wrote ${OUT_CSV}`);
  console.log(`Wrote ${OUT_TSV}`);
}

main();
