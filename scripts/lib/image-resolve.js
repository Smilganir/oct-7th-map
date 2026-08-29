/**
 * Memorial image URL resolution (shared by fetch-new-images.js and validate-images.js).
 */

const fs = require("fs");
const path = require("path");

const NLI_API_KEY = process.env.NLI_API_KEY || "";
const SCRIPTS_DIR = path.join(__dirname, "..");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function refererFor(url) {
  try {
    const u = new URL(url);
    return u.origin + encodeURI(decodeURI(u.pathname)) + u.search;
  } catch {
    return "https://www.google.com/";
  }
}

function padBtlId(id) {
  return String(id).padStart(6, "0");
}

function extractPoliceNofelId(url) {
  const m = url.match(/\/nofel\/(\d+)/i);
  return m ? m[1] : null;
}

function extractBtlId(url) {
  const m = url.match(/[?&]ID=(\d+)/i);
  return m ? m[1] : null;
}

function absolutize(src, pageUrl) {
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/")) return new URL(pageUrl).origin + src;
  return src;
}

function getImageUrlFromHtml(html, pageUrl) {
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) return absolutize(og[1].trim(), pageUrl);

  const izkor = html.match(/\/assets\/person\/images\/(\d+)\.jpg/i);
  if (izkor) return `https://www.izkor.gov.il/assets/person/images/${izkor[1]}.jpg`;

  const police = html.match(/PictureGallery\/(\d+)\/L_NP_\1_0\.(jpe?g|jfif)/i);
  if (police) {
    return `https://www.police.gov.il/gal-ed/noflim/PictureGallery/${police[1]}/L_NP_${police[1]}_0.${police[2]}`;
  }

  const idf = [
    ...html.matchAll(/https?:\/\/www\.idf\.il\/media\/[a-z0-9]+\/[^"'\\s>?]+\.(?:jpe?g|png|webp)/gi),
  ]
    .map((m) => m[0])
    .find(
      (u) =>
        !/(icon|footer|menu|search|logo|telegram|twitter|youtube|whatsapp|instagram|facebook|music|badge|svg|diary|recruitment|desktop|mobile|line-m|search-img|img-search)/i.test(
          u
        )
    );
  if (idf) return idf.split("?")[0];

  const img = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (img) return absolutize(img[1].trim(), pageUrl);

  return null;
}

async function fetchHtml(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      Referer: referer ? refererFor(referer) : refererFor(url),
    },
    redirect: "follow",
  });
  const html = await res.text();
  return { status: res.status, html, blocked: /Incapsula|challenge-platform|_Incapsula_Resource/i.test(html) };
}

async function verifyImageUrl(url, referer) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer ? refererFor(referer) : refererFor(url),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image") && !ct.includes("jfif")) return false;
    const reader = res.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    if (!first.value || first.value.length < 4) return false;
    const sig = Buffer.from(first.value.slice(0, 4)).toString("hex");
    return sig.startsWith("ffd8ff") || sig.startsWith("89504e47") || sig.startsWith("52494646");
  } catch {
    return false;
  }
}

function loadIdfCache() {
  const cachePath = path.join(SCRIPTS_DIR, "idf-image-cache.json");
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

async function resolveBtl(url) {
  const id = extractBtlId(url);
  if (!id) return { error: "no BTL ID in URL" };
  const padded = padBtlId(id);
  const imageUrl = `https://laad.btl.gov.il/view_files/Nofel_Pic/${padded}/NP_${padded}_10.jpg`;
  if (await verifyImageUrl(imageUrl, url)) {
    return { imageUrl, source: "btl-direct" };
  }
  const { html, blocked } = await fetchHtml(url);
  if (blocked) return { error: "BTL page blocked" };
  const scraped = getImageUrlFromHtml(html, url);
  if (scraped && (await verifyImageUrl(scraped, url))) {
    return { imageUrl: scraped, source: "btl-scrape" };
  }
  return { error: "BTL image not found" };
}

async function resolvePolice(url) {
  const nofelId = extractPoliceNofelId(url);
  if (!nofelId) return { error: "no police nofel ID in URL" };

  const padded = String(nofelId).padStart(6, "0");
  const candidates = [".jpeg", ".jpg", ".jfif"].map(
    (ext) => `https://www.police.gov.il/gal-ed/noflim/PictureGallery/${padded}/L_NP_${padded}_0${ext}`
  );

  for (const imageUrl of candidates) {
    if (await verifyImageUrl(imageUrl, url)) {
      return { imageUrl, source: "police-gallery" };
    }
  }

  const { html, blocked } = await fetchHtml(url);
  if (!blocked) {
    const scraped = getImageUrlFromHtml(html, url);
    if (scraped && (await verifyImageUrl(scraped, url))) {
      return { imageUrl: scraped, source: "police-scrape" };
    }
  }

  return { error: blocked ? "police page blocked from script" : "police gallery missing" };
}

async function resolveIzkor(url) {
  const encodedUrl = (() => {
    try {
      const u = new URL(url);
      return u.origin + encodeURI(decodeURI(u.pathname)) + u.search;
    } catch {
      return url;
    }
  })();
  const { html, blocked } = await fetchHtml(encodedUrl);
  if (blocked) return { error: "izkor page blocked" };
  const scraped = getImageUrlFromHtml(html, url);
  if (!scraped || scraped.includes("/defaults/person.jpg")) {
    return { error: "izkor image not found" };
  }
  if (await verifyImageUrl(scraped, url)) {
    return { imageUrl: scraped, source: "izkor-scrape" };
  }
  return { error: "izkor image invalid" };
}

async function resolveIdf(url, idfCache) {
  const cached = idfCache[url];
  if (cached?.imageUrl) {
    return { imageUrl: cached.imageUrl.split("?")[0], source: "idf-cache" };
  }

  const { html, blocked } = await fetchHtml(url, "https://www.idf.il/");
  if (!blocked) {
    const scraped = getImageUrlFromHtml(html, url);
    if (scraped && (await verifyImageUrl(scraped, "https://www.idf.il/"))) {
      return { imageUrl: scraped.split("?")[0], source: "idf-scrape" };
    }
  }
  return { error: blocked ? "idf page blocked (Incapsula)" : "idf image not in page HTML" };
}

async function resolveGeneric(url) {
  const { html, blocked } = await fetchHtml(url);
  if (blocked) return { error: "page blocked" };
  const scraped = getImageUrlFromHtml(html, url);
  if (scraped && (await verifyImageUrl(scraped, url))) {
    return { imageUrl: scraped, source: "generic-scrape" };
  }
  return { error: "no image on page" };
}

async function resolveFromMemorial(url, idfCache) {
  if (!url) return null;
  if (url.includes("laad.btl.gov.il")) return resolveBtl(url);
  if (url.includes("lezichram.police") || url.includes("police.gov.il")) return resolvePolice(url);
  if (url.includes("idf.il")) return resolveIdf(url, idfCache);
  if (url.includes("izkor.gov.il")) return resolveIzkor(url);
  return resolveGeneric(url);
}

async function fetchNliManifestImage(nliId) {
  if (!NLI_API_KEY) return null;
  const docIds = [`NNL_ALEPH${nliId}`, nliId];
  for (const docId of docIds) {
    const manifestUrl = `https://iiif.nli.org.il/IIIFv21/DOCID/${docId}/manifest`;
    try {
      const res = await fetch(manifestUrl, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const manifest = await res.json();
      const imageId =
        manifest?.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource?.["@id"] ||
        manifest?.items?.[0]?.items?.[0]?.items?.[0]?.body?.id;
      if (imageId && (await verifyImageUrl(imageId))) {
        return { imageUrl: imageId.split("?")[0], source: "nli-iiif-manifest" };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, ct: res.headers.get("content-type") || "" };
  } catch {
    return { ok: false, ct: "" };
  }
}

async function fetchNliIiifDirect(nliId) {
  const candidates = [
    `https://iiif.nli.org.il/IIIFv21/${nliId}/full/max/0/default.jpg`,
    `https://iiif.nli.org.il/IIIFv21/NNL_ALEPH${nliId}/full/max/0/default.jpg`,
  ];
  for (const imageUrl of candidates) {
    const probe = await probeUrl(imageUrl);
    if (probe.ok && probe.ct.includes("image") && (await verifyImageUrl(imageUrl))) {
      return { imageUrl, source: "nli-iiif-direct" };
    }
  }
  return null;
}

async function fetchNliSearch(nliId) {
  if (!NLI_API_KEY) return { error: "NLI_API_KEY not set" };

  const queries = [`recordid,exact,${nliId}`, `recordid,exact,NNL_ALEPH${nliId}`];
  for (const query of queries) {
    const u = `https://api.nli.org.il/openlibrary/search?api_key=${NLI_API_KEY}&query=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(u, { headers: { "User-Agent": UA } });
    if (res.status === 429) return { error: "NLI API rate limited" };
    if (!res.ok) continue;

    const data = await res.json();
    const record = data?.items?.[0] || data?.results?.[0];
    if (!record) continue;

    const thumb =
      record.thumbnail_url ||
      record.thumbnail ||
      record.image_url ||
      record.digital_image_url ||
      record?.digital?.[0]?.thumbnail_url;

    if (thumb && (await verifyImageUrl(thumb))) {
      return { imageUrl: thumb, source: "nli-search" };
    }

    const recordId = record.recordid || record.id || `NNL_ALEPH${nliId}`;
    const manifestResult = await fetchNliManifestImage(String(recordId).replace(/^NNL_ALEPH/, ""));
    if (manifestResult) return manifestResult;
  }

  return { error: "NLI search returned no image" };
}

async function resolveNli(nliId) {
  if (!nliId) return null;

  const direct = await fetchNliIiifDirect(nliId);
  if (direct) return direct;

  if (!NLI_API_KEY) {
    return { error: "NLI images not publicly accessible via IIIF; set NLI_API_KEY for search API" };
  }

  const manifest = await fetchNliManifestImage(nliId);
  if (manifest) return manifest;

  await sleep(1200);
  return fetchNliSearch(nliId);
}

async function resolveMako(nliId) {
  if (!nliId) return null;
  const id = String(nliId).trim();

  const directUrls = [
    `https://rcs.mako.co.il/image/item/${id}.jpg`,
    `https://f7img.mako.co.il/item/${id}.jpg`,
    `https://rcs.mako.co.il/image/${id}.jpg`,
    `https://img.mako.co.il/2024/01/01/${id}.jpg`,
  ];

  for (const imageUrl of directUrls) {
    if (await verifyImageUrl(imageUrl, "https://www.mako.co.il/")) {
      return { imageUrl, source: "mako-direct" };
    }
  }

  const ajaxUrl = `https://www.mako.co.il/pzm-Soldiers/AjaxPage?jspName=ajaxResponse.jsp&action=getVictimImage&id=${id}`;
  try {
    const res = await fetch(ajaxUrl, {
      headers: { "User-Agent": UA, Accept: "*/*", Referer: "https://www.mako.co.il/" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/https?:\/\/[^"'\s<>]+\.(?:jpe?g|png|webp)(?:\?[^"'\s<>]*)?/i);
      if (match && (await verifyImageUrl(match[0], "https://www.mako.co.il/"))) {
        return { imageUrl: match[0].split("?")[0], source: "mako-ajax" };
      }
    }
  } catch {
    /* fall through */
  }

  return { error: "mako image not found" };
}

module.exports = {
  UA,
  sleep,
  refererFor,
  padBtlId,
  extractPoliceNofelId,
  extractBtlId,
  verifyImageUrl,
  loadIdfCache,
  resolveFromMemorial,
  resolveNli,
  resolveMako,
};
