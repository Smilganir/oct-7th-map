/**
 * Fetch image URLs for rows in the Google Sheet "New Images" tab.
 *
 * Primary: column E memorial URL (הנצחה)
 * Fallback: column F NLI memorial-wall ID (הספריה הלאומית)
 *
 * Usage:
 *   node scripts/fetch-new-images.js
 *   node scripts/fetch-new-images.js --limit 20
 *   node scripts/fetch-new-images.js --pid 2040
 *
 * Env (optional):
 *   NLI_API_KEY - NLI Open Library search API key
 *   NEW_IMAGES_CSV - local CSV path (default: scripts/new-images-sheet.csv)
 */

const fs = require("fs");
const path = require("path");
const {
  sleep,
  loadIdfCache,
  resolveFromMemorial,
  resolveNli,
} = require("./lib/image-resolve");

const DEFAULT_CSV = path.join(__dirname, "new-images-sheet.csv");
const DEFAULT_OUT = path.join(__dirname, "new-images-with-urls.csv");

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
  while (i < len && text[i] !== "\n" && text[i] !== "\r") {
    headers.push(readField());
  }
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

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function resolveRow(row, idfCache) {
  const pid = row.pid;
  const memorialUrl = (row["הנצחה"] || "").trim();
  const nliId = (row["הספריה הלאומית"] || "").trim();

  let imageUrl = "";
  let source = "";
  let status = "";
  let error = "";

  if (memorialUrl) {
    const memorial = await resolveFromMemorial(memorialUrl, idfCache);
    if (memorial?.imageUrl) {
      imageUrl = memorial.imageUrl;
      source = memorial.source;
      status = "ok";
    } else if (memorial?.error) {
      error = memorial.error;
    }
  }

  if (!imageUrl && nliId && (error.includes("idf") || error.includes("blocked") || !memorialUrl)) {
    const nli = await resolveNli(nliId);
    if (nli?.imageUrl) {
      imageUrl = nli.imageUrl;
      source = nli.source;
      status = "ok";
      error = "";
    } else if (!error && nli?.error) {
      error = nli.error;
    } else if (!error) {
      error = "NLI fallback failed";
    }
  }

  if (!imageUrl && !error) {
    error = memorialUrl ? "no image found" : "no memorial URL or NLI ID";
  }
  if (!imageUrl && error) status = "failed";

  return { pid, memorialUrl, nliId, imageUrl, source, status, error };
}

function writeCsv(outPath, results) {
  const fixed = [
    "pid,memorial_url,nli_id,image_url,source,status,error",
    ...results.map((r) =>
      ["pid", "memorialUrl", "nliId", "imageUrl", "source", "status", "error"]
        .map((k) => csvEscape(r[k]))
        .join(",")
    ),
  ];
  fs.writeFileSync(outPath, fixed.join("\n"), "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const pidIdx = args.indexOf("--pid");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const onlyPid = pidIdx >= 0 ? args[pidIdx + 1] : null;

  const csvPath = process.env.NEW_IMAGES_CSV || DEFAULT_CSV;
  const outPath = process.env.NEW_IMAGES_OUT || DEFAULT_OUT;
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

  let todo = rows;
  if (onlyPid) todo = rows.filter((r) => r.pid === onlyPid);
  if (Number.isFinite(limit)) todo = todo.slice(0, limit);

  console.log(`Processing ${todo.length} rows from ${csvPath}`);
  const idfCache = loadIdfCache();

  const results = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const result = await resolveRow(row, idfCache);
    results.push(result);
    if (result.status === "ok") ok++;
    else fail++;
    const mark = result.status === "ok" ? "OK" : "FAIL";
    console.log(`[${i + 1}/${todo.length}] ${mark} pid=${result.pid} ${result.source || result.error}`);
    await sleep(200);
  }

  writeCsv(outPath, results);
  console.log(`\nDone. ok=${ok} failed=${fail}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
