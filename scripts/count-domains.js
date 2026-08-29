const fs = require("fs");
const lines = fs.readFileSync("scripts/new-images-sheet.csv", "utf8").split(/\r?\n/).slice(1).filter(Boolean);
const counts = {};
for (const line of lines) {
  const m = line.match(/https?:\/\/([^/"]+)/);
  if (m) {
    const d = m[1].replace("www.", "");
    counts[d] = (counts[d] || 0) + 1;
  }
}
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map((x) => x.join(": ")).join("\n"));
console.log("Total rows:", lines.length);
