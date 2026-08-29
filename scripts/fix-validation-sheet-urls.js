/**
 * Rewrite validation-images-sheet.csv to use raw source_url in validation_url
 * (fixes broken oct7database.com/validation-images links).
 *
 *   node scripts/fix-validation-sheet-urls.js
 */

const fs = require("fs");
const path = require("path");
const { parseCsv } = require("./lib/source-catalog");

const CSV = path.join(__dirname, "validation-images-sheet.csv");

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rows = parseCsv(fs.readFileSync(CSV, "utf8"));
let fixed = 0;

for (const row of rows) {
  const source = String(row.source_url ?? "").trim();
  const validation = String(row.validation_url ?? "").trim();
  if (
    source &&
    (!validation || validation.includes("oct7database.com/validation-images"))
  ) {
    row.validation_url = source;
    row.method = row.method?.includes("crop") ? "raw-source" : row.method || "raw";
    fixed++;
  }
}

const header = "pid,name,source_url,validation_url,source,method,error";
const lines = [
  header,
  ...rows.map((r) =>
    ["pid", "name", "source_url", "validation_url", "source", "method", "error"]
      .map((k) => csvEscape(r[k]))
      .join(",")
  ),
];
fs.writeFileSync(CSV, lines.join("\n"), "utf8");
console.log(`Fixed ${fixed} rows -> raw source_url in validation_url`);
