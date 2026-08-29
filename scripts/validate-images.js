/**
 * Validate pid ↔ image URL alignment (structural checks + multi-source comparison).
 *
 * Sources: memorial pages (Police, BTL, IDF, Izkor), NLI, Mako, IDF cache,
 * police/idf/kidnapped sheet exports, and Cloudinary pipeline caches.
 *
 * Usage:
 *   node scripts/validate-images.js
 *   node scripts/validate-images.js --structural
 *   node scripts/validate-images.js --pid 737
 *   node scripts/validate-images.js --limit 20
 *
 * Env:
 *   RAW_IMAGES_CSV - image URL source (default: scripts/raw-images-sheet.csv)
 *   OCT_7TH_DB_CSV_URL - published DB CSV for metadata fallback
 *   GOOGLE_SERVICE_ACCOUNT_KEY_FILE - for Sheets API metadata lookup
 *   NLI_API_KEY - optional NLI fallback during source resolve
 */

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { loadIdfCache } = require("./lib/image-resolve");
const { getDbMetadataMap } = require("./lib/sheets-read");
const { loadSourceCatalog, parseCsv } = require("./lib/source-catalog");
const { resolveAllCandidates, actualMatchesCandidates } = require("./lib/source-resolve");
const {
  normalizeUrl,
  extractPidFromCloudinaryUrl,
  policeIdsConsistent,
  isValidImageUrl,
} = require("./lib/url-normalize");

const DEFAULT_CSV = path.join(__dirname, "raw-images-sheet.csv");
const DEFAULT_REPORT = path.join(__dirname, "validation-report.csv");
const PUBLISHED_DB_CSV_URL =
  process.env.OCT_7TH_DB_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0T4vDFyLtNKmuRF0TW31psjY8qMWkPbZCoE74D6hchs4JW5WP0An7PuOjW12dYr3IrAdA-tHox5Sw/pub?output=csv&gid=1";

const FAIL_TYPES = new Set(["MISMATCH", "DUPLICATE", "SWAP_PAIR", "PID_IN_URL", "POLICE_ID_MISMATCH"]);

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pickName(row) {
  const hebrew = [row["שם פרטי"], row["שם משפחה"]].filter(Boolean).join(" ").trim();
  if (hebrew) return hebrew;

  const english = [row["first name"], row["last name"]].filter(Boolean).join(" ").trim();
  if (english) return english;

  for (const [key, value] of Object.entries(row)) {
    if (key === "pid" || key === "Image URL") continue;
    const v = String(value ?? "").trim();
    if (v && /[\u0590-\u05FF]/.test(v)) return v;
  }
  return "";
}

function loadImageRows(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  return rows
    .map((row) => ({
      pid: String(row.pid ?? "").trim(),
      imageUrl: String(row["Image URL"] ?? row.imageUrl ?? "").trim(),
      name: pickName(row),
    }))
    .filter((row) => row.pid);
}

async function loadDbMetadataFromPublishedCsv() {
  const res = await fetch(PUBLISHED_DB_CSV_URL);
  if (!res.ok) throw new Error(`Published CSV fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = parseCsv(text);
  const map = new Map();

  for (const row of parsed) {
    const pid = String(row.pid ?? "").trim();
    if (!pid) continue;
    const memorialUrl = String(row["הנצחה"] ?? "").trim();
    const nliId = String(row["הספריה הלאומית"] ?? "").trim();
    const name =
      [row["שם פרטי"], row["שם משפחה"]].filter(Boolean).join(" ").trim() ||
      [row["first name"], row["last name"]].filter(Boolean).join(" ").trim();
    map.set(pid, {
      memorialUrl: memorialUrl && memorialUrl !== "#N/A" ? memorialUrl : "",
      nliId: nliId && nliId !== "#N/A" ? nliId : "",
      name,
    });
  }
  return map;
}

async function loadDbMetadata() {
  try {
    const { map, tabName } = await getDbMetadataMap();
    console.log(`DB metadata from Sheets tab "${tabName}" (${map.size} rows)`);
    return map;
  } catch (err) {
    console.warn(`Sheets API unavailable (${err.message}); using published CSV fallback`);
    const map = await loadDbMetadataFromPublishedCsv();
    console.log(`DB metadata from published CSV (${map.size} rows)`);
    return map;
  }
}

function attachDbMetadata(rows, metadataMap) {
  return rows.map((row) => {
    const meta = metadataMap.get(row.pid) || {};
    return {
      ...row,
      memorialUrl: meta.memorialUrl || "",
      nliId: meta.nliId || "",
      name: row.name || meta.name || "",
    };
  });
}

function issue(type, row, extra = {}) {
  return {
    type,
    pid: row.pid,
    name: row.name || "",
    imageUrl: row.imageUrl || "",
    memorialUrl: row.memorialUrl || "",
    expected: extra.expected || "",
    actual: extra.actual || "",
    detail: extra.detail || "",
  };
}

function structuralChecks(rows) {
  const issues = [];
  const urlToPids = new Map();

  for (const row of rows) {
    if (!isValidImageUrl(row.imageUrl)) {
      issues.push(issue("MISSING", row, { detail: row.imageUrl || "empty" }));
      continue;
    }

    const embeddedPid = extractPidFromCloudinaryUrl(row.imageUrl);
    if (embeddedPid && embeddedPid !== row.pid) {
      issues.push(
        issue("PID_IN_URL", row, {
          expected: row.pid,
          actual: embeddedPid,
          detail: `URL contains pid ${embeddedPid}, row pid is ${row.pid}`,
        })
      );
    }

    if (row.memorialUrl) {
      const police = policeIdsConsistent(row.memorialUrl, row.imageUrl);
      if (!police.ok) {
        issues.push(
          issue("POLICE_ID_MISMATCH", row, {
            expected: police.nofelId,
            actual: police.galleryId,
            detail: `memorial nofel/${police.nofelId} vs gallery ${police.galleryId}`,
          })
        );
      }
    }

    const key = normalizeUrl(row.imageUrl);
    if (!urlToPids.has(key)) urlToPids.set(key, []);
    urlToPids.get(key).push(row.pid);
  }

  for (const [url, pids] of urlToPids) {
    const unique = [...new Set(pids)];
    if (unique.length > 1) {
      issues.push({
        type: "DUPLICATE",
        pid: unique.join(","),
        name: "",
        imageUrl: url,
        memorialUrl: "",
        expected: "",
        actual: "",
        detail: `pids=${unique.join(",")}`,
      });
    }
  }

  return issues;
}

async function sourceChecks(rows, catalog, idfCache) {
  const issues = [];
  const comparisons = [];
  const hashCache = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isValidImageUrl(row.imageUrl)) continue;

    let candidates = await resolveAllCandidates(row, catalog, idfCache, { staticOnly: true });
    let match = await actualMatchesCandidates(row.imageUrl, candidates, row, hashCache);

    if (!match && (row.memorialUrl || row.nliId)) {
      candidates = await resolveAllCandidates(row, catalog, idfCache);
      match = await actualMatchesCandidates(row.imageUrl, candidates, row, hashCache);
    }

    if (candidates.length === 0) {
      if (row.memorialUrl || row.nliId) {
        issues.push(
          issue("SOURCE_UNRESOLVED", row, {
            detail: `no candidates from memorial=${row.memorialUrl ? "yes" : "no"} nli=${row.nliId || "no"}`,
          })
        );
      }
    } else if (!match) {
      const sourceList = candidates.map((c) => c.source).join(", ");
      issues.push(
        issue("MISMATCH", row, {
          expected: candidates[0].url,
          actual: row.imageUrl,
          detail: `checked [${sourceList}] (${candidates.length} sources)`,
        })
      );
    }

    if (candidates.length > 0) {
      const primary = candidates[0];
      const expectedKey = `${normalizeUrl(primary.url)}|${primary.referer || row.memorialUrl || ""}`;
      const actualKey = `${normalizeUrl(row.imageUrl)}|${row.memorialUrl || ""}`;
      comparisons.push({
        pid: row.pid,
        expectedHash: hashCache.get(expectedKey) || "",
        actualHash: hashCache.get(actualKey) || "",
      });
    }

    if ((i + 1) % 25 === 0) {
      console.log(`Source compare ${i + 1}/${rows.length}`);
    }
  }

  const expectedByPid = new Map();
  const actualByPid = new Map();
  for (const c of comparisons) {
    if (c.expectedHash) expectedByPid.set(c.pid, c.expectedHash);
    if (c.actualHash) actualByPid.set(c.pid, c.actualHash);
  }

  const pids = [...new Set([...expectedByPid.keys(), ...actualByPid.keys()])];
  for (let i = 0; i < pids.length; i++) {
    for (let j = i + 1; j < pids.length; j++) {
      const a = pids[i];
      const b = pids[j];
      if (
        actualByPid.get(a) &&
        actualByPid.get(b) &&
        expectedByPid.get(a) &&
        expectedByPid.get(b) &&
        actualByPid.get(a) !== actualByPid.get(b) &&
        expectedByPid.get(a) !== expectedByPid.get(b) &&
        actualByPid.get(a) === expectedByPid.get(b) &&
        actualByPid.get(b) === expectedByPid.get(a)
      ) {
        issues.push({
          type: "SWAP_PAIR",
          pid: `${a},${b}`,
          name: "",
          imageUrl: "",
          memorialUrl: "",
          expected: "",
          actual: "",
          detail: `cross-matched source hashes between pid ${a} and ${b}`,
        });
      }
    }
  }

  return issues;
}

function writeReport(outPath, issues) {
  const header = "type,pid,name,imageUrl,memorialUrl,expected,actual,detail";
  const lines = [
    header,
    ...issues.map((row) =>
      ["type", "pid", "name", "imageUrl", "memorialUrl", "expected", "actual", "detail"]
        .map((k) => csvEscape(row[k]))
        .join(",")
    ),
  ];
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
}

function printSummary(rows, issues, structuralOnly) {
  const fails = issues.filter((i) => FAIL_TYPES.has(i.type));
  const byType = {};
  for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;

  for (const i of fails) {
    const name = i.name ? ` name=${i.name}` : "";
    if (i.type === "DUPLICATE") {
      console.log(`DUPLICATE url=${i.imageUrl} ${i.detail}`);
    } else if (i.type === "SWAP_PAIR") {
      console.log(`SWAP_PAIR ${i.detail}`);
    } else if (i.type === "MISSING") {
      console.log(`MISSING pid=${i.pid}${name} column AJ empty`);
    } else {
      console.log(
        `${i.type} pid=${i.pid}${name} expected=${i.expected || "-"} actual=${i.actual || i.imageUrl || "-"} ${i.detail || ""}`
      );
    }
  }

  console.log(
    `\n${structuralOnly ? "Structural" : "Full"} validation: ${rows.length} rows, ${fails.length} failures`
  );
  if (Object.keys(byType).length) {
    console.log("By type:", Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(" "));
  }
  console.log(`OK ~${Math.max(0, rows.length - fails.length)}/${rows.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const structuralOnly = args.includes("--structural");
  const limitIdx = args.indexOf("--limit");
  const pidIdx = args.indexOf("--pid");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const onlyPid = pidIdx >= 0 ? args[pidIdx + 1] : null;

  const csvPath = process.env.RAW_IMAGES_CSV || DEFAULT_CSV;
  const reportPath = process.env.VALIDATION_REPORT || DEFAULT_REPORT;

  let rows = loadImageRows(csvPath);
  if (onlyPid) rows = rows.filter((r) => r.pid === onlyPid);

  const catalog = loadSourceCatalog();
  console.log(
    `Source catalogs: police=${catalog.policeImages.size} idf=${catalog.idfCropUrls.size} kidnapped=${catalog.kidnapped.size} raw-cache=${Object.keys(catalog.rawCache).length} new-cache=${Object.keys(catalog.newCache).length}`
  );

  if (!structuralOnly) {
    const metadataMap = await loadDbMetadata();
    rows = attachDbMetadata(rows, metadataMap);
  }

  if (Number.isFinite(limit) && !onlyPid) rows = rows.slice(0, limit);

  console.log(`Validating ${rows.length} rows from ${csvPath}${structuralOnly ? " (structural only)" : ""}`);

  const issues = structuralChecks(rows);

  if (!structuralOnly) {
    const idfCache = loadIdfCache();
    const sourceIssues = await sourceChecks(rows, catalog, idfCache);
    issues.push(...sourceIssues);
  }

  writeReport(reportPath, issues);
  printSummary(rows, issues, structuralOnly);
  console.log(`Wrote ${reportPath}`);

  const hasFailures = issues.some((i) => FAIL_TYPES.has(i.type));
  if (hasFailures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
