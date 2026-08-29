/**
 * Fetch raw source image URLs for visual validation (Raw Images column F).
 * Writes direct memorial/police/BTL/IDF/NLI/Mako URLs (no Cloudinary).
 *
 *   node scripts/fetch-validation-images.js
 *   node scripts/fetch-validation-images.js --limit 50
 *   node scripts/fetch-validation-images.js --pid 367
 *   node scripts/fetch-validation-images.js --local-crop   # optional local files (not for sheet)
 *
 * Output: scripts/validation-images-sheet.csv
 */

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { parseCsv } = require("./lib/source-catalog");
const { loadSourceCatalog } = require("./lib/source-catalog");
const { getDbMetadataMap } = require("./lib/sheets-read");
const { collectStaticCandidates } = require("./lib/source-resolve");
const { cropAndSave } = require("./lib/local-face-crop");
const {
  sleep,
  loadIdfCache,
  resolveFromMemorial,
  resolveNli,
  resolveMako,
} = require("./lib/image-resolve");

const SHEET_CSV = path.join(__dirname, "raw-images-sheet.csv");
const OUT_CSV = path.join(__dirname, "validation-images-sheet.csv");
const OUT_DIR = path.join(__dirname, "..", "public", "validation-images");
const PUBLIC_BASE =
  process.env.VALIDATION_IMAGE_BASE_URL || "https://oct7database.com/validation-images";

const PLACEHOLDER_MARKERS = [
  "nopicTerror",
  "placeholder%20men",
  "placeholder men",
  "candle.png",
];

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isPlaceholderUrl(url) {
  if (!url) return true;
  return PLACEHOLDER_MARKERS.some((m) => url.includes(m));
}

function isCloudinaryUrl(url) {
  return url && url.includes("res.cloudinary.com");
}

function pickStaticSource(candidates) {
  const order = [
    "police-sheet:raw",
    "fetch-new-images",
    "idf-cache",
    "btl",
    "memorial",
    "nli",
    "mako",
    "police",
    "izkor",
  ];
  const scored = candidates
    .filter((c) => c.url && !isCloudinaryUrl(c.url) && !isPlaceholderUrl(c.url))
    .map((c) => {
      const rank = order.findIndex((k) => c.source.includes(k));
      return { ...c, rank: rank >= 0 ? rank : 99 };
    })
    .sort((a, b) => a.rank - b.rank);
  return scored[0] || null;
}

async function resolveRawSource(row, catalog, idfCache) {
  const staticPick = pickStaticSource(collectStaticCandidates(row, catalog));
  if (staticPick) {
    return {
      imageUrl: staticPick.url,
      source: staticPick.source,
      referer: staticPick.referer || row.memorialUrl,
    };
  }

  if (row.memorialUrl) {
    const memorial = await resolveFromMemorial(row.memorialUrl, idfCache);
    if (memorial?.imageUrl && !isPlaceholderUrl(memorial.imageUrl) && !isCloudinaryUrl(memorial.imageUrl)) {
      return {
        imageUrl: memorial.imageUrl,
        source: memorial.source || "memorial",
        referer: row.memorialUrl,
      };
    }
  }

  if (row.nliId) {
    const nli = await resolveNli(row.nliId);
    if (nli?.imageUrl && !isCloudinaryUrl(nli.imageUrl)) {
      return { imageUrl: nli.imageUrl, source: nli.source || "nli", referer: row.memorialUrl };
    }
    const mako = await resolveMako(row.nliId);
    if (mako?.imageUrl && !isCloudinaryUrl(mako.imageUrl)) {
      return { imageUrl: mako.imageUrl, source: mako.source || "mako", referer: "https://www.mako.co.il/" };
    }
    await sleep(150);
  }

  return null;
}

function writeResults(results) {
  const header = "pid,name,source_url,validation_url,source,method,error";
  const lines = [
    header,
    ...results.map((r) =>
      ["pid", "name", "sourceUrl", "validationUrl", "source", "method", "error"]
        .map((k) => csvEscape(r[k]))
        .join(",")
    ),
  ];
  fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
}

function appendResult(result, allResults) {
  allResults.push(result);
  if (allResults.length % 25 === 0) {
    writeResults(allResults);
    console.log(`  checkpoint ${allResults.length} rows saved`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const pidIdx = args.indexOf("--pid");
  const noCrop = !args.includes("--local-crop");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const onlyPid = pidIdx >= 0 ? args[pidIdx + 1] : null;

  const { map: metadataMap } = await getDbMetadataMap();
  const catalog = loadSourceCatalog();
  const idfCache = loadIdfCache();

  let rows = parseCsv(fs.readFileSync(SHEET_CSV, "utf8"))
    .map((row) => {
      const pid = String(row.pid ?? "").trim();
      const meta = metadataMap.get(pid) || {};
      return {
        pid,
        name: meta.name || "",
        memorialUrl: meta.memorialUrl || "",
        nliId: meta.nliId || "",
        sheetImageUrl: String(row["Image URL"] ?? "").trim(),
      };
    })
    .filter((row) => row.pid);

  if (onlyPid) rows = rows.filter((r) => r.pid === onlyPid);
  if (Number.isFinite(limit)) rows = rows.slice(0, limit);

  console.log(`Fetching validation images for ${rows.length} rows`);

  const results = [];
  let cropped = 0;
  let rawOnly = 0;
  let failed = 0;

  if (fs.existsSync(OUT_CSV)) {
    const existing = parseCsv(fs.readFileSync(OUT_CSV, "utf8"));
    const done = new Set(existing.map((r) => String(r.pid)));
    for (const r of existing) {
      results.push({
        pid: r.pid,
        name: r.name,
        sourceUrl: r.source_url,
        validationUrl: r.validation_url,
        source: r.source,
        method: r.method,
        error: r.error,
      });
    }
    rows = rows.filter((r) => !done.has(r.pid));
    console.log(`Resuming: ${rows.length} rows remaining (${results.length} already done)`);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if ((i + 1) % 25 === 0) console.log(`Progress ${i + 1}/${rows.length}`);

    const resolved = await resolveRawSource(row, catalog, idfCache);
    if (!resolved) {
      failed++;
      appendResult(
        {
          pid: row.pid,
          name: row.name,
          sourceUrl: "",
          validationUrl: "",
          source: "",
          method: "failed",
          error: "no source image found",
        },
        results
      );
      continue;
    }

    let validationUrl = resolved.imageUrl;
    let method = "raw";

    if (!noCrop) {
      const cachedFile = path.join(OUT_DIR, `${row.pid}.jpg`);
      if (fs.existsSync(cachedFile)) {
        validationUrl = `${PUBLIC_BASE}/${row.pid}.jpg`;
        method = "local-portrait-crop";
        cropped++;
      } else {
        const crop = await cropAndSave(row.pid, resolved.imageUrl, resolved.referer, OUT_DIR);
        if (crop.ok) {
          validationUrl = `${PUBLIC_BASE}/${row.pid}.jpg`;
          method = crop.method;
          cropped++;
        } else {
          rawOnly++;
        }
      }
    } else {
      rawOnly++;
    }

    appendResult(
      {
        pid: row.pid,
        name: row.name,
        sourceUrl: resolved.imageUrl,
        validationUrl,
        source: resolved.source,
        method,
        error: "",
      },
      results
    );

    if (resolved.source.includes("nli") || row.nliId) {
      await sleep(120);
    }
  }

  writeResults(results);
  console.log(`\nDone. cropped=${cropped} raw=${rawOnly} failed=${failed}`);
  console.log(`CSV: ${OUT_CSV}`);
  console.log(`Images: ${OUT_DIR}`);
  console.log("Next: python scripts/upload-validation-images-to-sheet.py");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
