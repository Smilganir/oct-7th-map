/**
 * Build scripts/idf-image-cache.json by loading IDF memorial pages in headless Chrome.
 * Requires: npx playwright (installed on first run)
 *
 *   node scripts/build-idf-image-cache.js
 *   node scripts/build-idf-image-cache.js --limit 20
 */

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "new-images-sheet.csv");
const CACHE_PATH = path.join(__dirname, "idf-image-cache.json");

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

function extractPortraitUrl(page) {
  return page.evaluate(() => {
    const soldierImg = document.querySelector(".soldier-image img, .soldier-image picture img");
    if (soldierImg?.src) return soldierImg.currentSrc || soldierImg.src;

    const skip =
      /icon|footer|menu|search|logo|telegram|twitter|youtube|whatsapp|instagram|facebook|music|badge|svg|diary|recruitment|desktop|mobile|line-m|search-img|img-search|בית-מרקחת|מרקחת|pharmacy/i;
    const imgs = Array.from(document.images).map((img) => ({
      src: img.currentSrc || img.src,
      w: img.naturalWidth || img.width || 0,
      h: img.naturalHeight || img.height || 0,
    }));

    const hero = imgs.find(
      (img) =>
        img.src.includes("/media/") &&
        /\.(jpe?g|png|webp)/i.test(img.src) &&
        !skip.test(img.src) &&
        img.src.includes("width=157") &&
        img.src.includes("height=211")
    );
    if (hero) return hero.src;

    return null;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    console.error("Playwright not installed. Run: npm install -D playwright && npx playwright install chromium");
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8")).filter((r) =>
    (r["הנצחה"] || "").includes("idf.il")
  );
  const todo = rows.slice(0, Number.isFinite(limit) ? limit : rows.length);

  const cache = {};

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const url = row["הנצחה"].trim();
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const title = await page.title();
      if (!response || response.status() >= 400 || /אין מה לראות|404/i.test(title)) {
        cache[url] = { pid: row.pid, error: `page not found (${title})` };
        console.log(`[${i + 1}/${todo.length}] FAIL pid=${row.pid} ${title}`);
        continue;
      }
      await page.waitForSelector(".soldier-image img, h1", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      const imageUrl = await extractPortraitUrl(page);
      if (imageUrl) {
        cache[url] = { pid: row.pid, imageUrl: imageUrl.split("?")[0] };
        console.log(`[${i + 1}/${todo.length}] OK pid=${row.pid}`);
      } else {
        cache[url] = { pid: row.pid, error: "no portrait image in page" };
        console.log(`[${i + 1}/${todo.length}] FAIL pid=${row.pid} no image`);
      }
    } catch (err) {
      cache[url] = { pid: row.pid, error: err.message };
      console.log(`[${i + 1}/${todo.length}] ERR pid=${row.pid} ${err.message}`);
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  }

  await browser.close();
  console.log(`Wrote ${CACHE_PATH} (${Object.keys(cache).length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
