/**
 * Generate Google Apps Script to paste into Extensions > Apps Script on the spreadsheet.
 * Run: node scripts/generate-sheet-apps-script.js
 */

const fs = require("fs");
const path = require("path");

const csv = fs.readFileSync(path.join(__dirname, "new-images-gh-update.csv"), "utf8");
const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);

const rows = lines.map((line) => {
  const m = line.match(/^(\d+),("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|[^,]*)$/);
  if (!m) throw new Error("Bad line: " + line);
  const unquote = (s) => s.replace(/^"|"$/g, "").replace(/""/g, '"');
  return [unquote(m[2]), unquote(m[3])];
});

const script = `/**
 * Paste into Extensions > Apps Script on the spreadsheet, then Run > updateNewImagesGH
 * Sheet: New Images — fills columns G (Raw Image) and H (Cloudinary Image)
 */
function updateNewImagesGH() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('New Images');
  if (!sheet) throw new Error('Sheet "New Images" not found');

  const data = ${JSON.stringify(rows, null, 2)};

  sheet.getRange(2, 7, data.length, 2).setValues(data);
  SpreadsheetApp.getUi().alert('Updated ' + data.length + ' rows in columns G and H.');
}
`;

const out = path.join(__dirname, "update-new-images-sheet.gs");
fs.writeFileSync(out, script, "utf8");
console.log(`Wrote ${out} (${rows.length} rows)`);
