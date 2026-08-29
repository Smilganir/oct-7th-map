/**
 * Load local image source catalogs (sheet exports, Cloudinary caches).
 */

const fs = require("fs");
const path = require("path");

const SCRIPTS_DIR = path.join(__dirname, "..");

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

function loadJson(fileName) {
  const filePath = path.join(SCRIPTS_DIR, fileName);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function loadCsvRows(fileName) {
  const filePath = path.join(SCRIPTS_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = String(row[key] ?? "").trim();
    if (value && value !== "#N/A") return value;
  }
  return "";
}

function loadPidUrlMap(fileName, pidKeys, urlKeys) {
  const map = new Map();
  for (const row of loadCsvRows(fileName)) {
    const pid = firstValue(row, pidKeys);
    const url = firstValue(row, urlKeys);
    if (pid && url) map.set(pid, url);
  }
  return map;
}

function loadSourceCatalog() {
  const rawCache = loadJson("raw-images-cloudinary-cache.json");
  const newCache = loadJson("new-images-cloudinary-cache.json");
  const idfCache = loadJson("idf-image-cache.json");

  const fetchedUrls = new Map();
  for (const row of loadCsvRows("new-images-with-urls.csv")) {
    const pid = firstValue(row, ["pid"]);
    const url = firstValue(row, ["image_url", "imageUrl"]);
    if (pid && url) fetchedUrls.set(pid, url);
  }

  return {
    policeImages: loadPidUrlMap("police-images-sheet.csv", ["PID", "pid"], ["Image URL", "imageUrl"]),
    policeUploads: loadPidUrlMap("police-images-sheet.csv", ["PID", "pid"], ["Cloudinary URL", "Cloudinary_URL"]),
    policeCrops: loadPidUrlMap("police-images-sheet.csv", ["PID", "pid"], ["Face URL", "Face URL"]),
    idfCropUrls: loadPidUrlMap("idf-images-sheet.csv", ["PID", "pid"], ["Image URL", "imageUrl"]),
    idfUploadUrls: loadPidUrlMap("idf-images-sheet.csv", ["PID", "pid"], ["Cloudinary_URL", "Cloudinary URL"]),
    kidnapped: loadPidUrlMap("kidnapped-images-sheet.csv", ["PID", "pid"], ["Cloudinary URL", "Cloudinary URL"]),
    fetchedUrls,
    rawCache,
    newCache,
    idfCache,
  };
}

module.exports = {
  loadSourceCatalog,
  loadCsvRows,
  parseCsv,
};
