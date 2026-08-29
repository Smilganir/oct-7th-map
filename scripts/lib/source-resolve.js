/**
 * Resolve candidate source images from memorial, NLI, Mako, IDF, Police, caches, and sheet exports.
 */

const {
  sleep,
  resolveFromMemorial,
  resolveNli,
  resolveMako,
} = require("./image-resolve");
const { downloadAndHash } = require("./hash");
const { normalizeUrl, urlsEquivalent, isValidImageUrl } = require("./url-normalize");

function addCandidate(list, source, url, referer) {
  if (!isValidImageUrl(url)) return;
  const norm = normalizeUrl(url);
  if (list.some((c) => normalizeUrl(c.url) === norm)) return;
  list.push({ source, url, referer: referer || url });
}

function addCacheEntry(list, prefix, entry) {
  if (!entry || entry.error) return;
  if (entry.raw_url) addCandidate(list, `${prefix}:raw`, entry.raw_url);
  if (entry.upload_url) addCandidate(list, `${prefix}:upload`, entry.upload_url);
  if (entry.crop_url) addCandidate(list, `${prefix}:crop`, entry.crop_url);
}

function collectEmbeddedCandidates(row) {
  const candidates = [];
  const inner = normalizeUrl(row.imageUrl);
  if (!inner || inner === row.imageUrl.trim()) return candidates;
  if (
    inner.includes("laad.btl.gov.il") ||
    inner.includes("police.gov.il") ||
    inner.includes("idf.il/media") ||
    inner.includes("izkor.gov.il") ||
    inner.includes("mako.co.il") ||
    inner.includes("res.cloudinary.com")
  ) {
    addCandidate(candidates, "sheet-embedded", inner, row.memorialUrl);
  }
  return candidates;
}

function collectStaticCandidates(row, catalog) {
  const candidates = [];
  const pid = row.pid;

  for (const embedded of collectEmbeddedCandidates(row)) {
    addCandidate(candidates, embedded.source, embedded.url, embedded.referer);
  }

  const policeUrl = catalog.policeImages.get(pid);
  if (policeUrl) addCandidate(candidates, "police-sheet:raw", policeUrl);

  const policeUpload = catalog.policeUploads.get(pid);
  if (policeUpload) addCandidate(candidates, "police-sheet:upload", policeUpload);

  const policeCrop = catalog.policeCrops.get(pid);
  if (policeCrop) addCandidate(candidates, "police-sheet:crop", policeCrop);

  const idfCrop = catalog.idfCropUrls.get(pid);
  if (idfCrop) addCandidate(candidates, "idf-sheet:crop", idfCrop);

  const idfUpload = catalog.idfUploadUrls.get(pid);
  if (idfUpload) addCandidate(candidates, "idf-sheet:upload", idfUpload);

  const kidnapped = catalog.kidnapped.get(pid);
  if (kidnapped) addCandidate(candidates, "kidnapped-sheet", kidnapped);

  const fetched = catalog.fetchedUrls.get(pid);
  if (fetched) addCandidate(candidates, "fetch-new-images", fetched, row.memorialUrl);

  addCacheEntry(candidates, "raw-cache", catalog.rawCache[pid]);
  addCacheEntry(candidates, "new-cache", catalog.newCache[pid]);

  if (row.memorialUrl && catalog.idfCache[row.memorialUrl]?.imageUrl) {
    addCandidate(
      candidates,
      "idf-cache",
      catalog.idfCache[row.memorialUrl].imageUrl,
      row.memorialUrl
    );
  }

  return candidates;
}

async function collectDynamicCandidates(row, idfCache) {
  const candidates = [];

  if (row.memorialUrl) {
    const memorial = await resolveFromMemorial(row.memorialUrl, idfCache);
    if (memorial?.imageUrl) {
      addCandidate(candidates, memorial.source || "memorial", memorial.imageUrl, row.memorialUrl);
    }
  }

  if (row.nliId) {
    const nli = await resolveNli(row.nliId);
    if (nli?.imageUrl) {
      addCandidate(candidates, nli.source || "nli", nli.imageUrl);
    }

    const mako = await resolveMako(row.nliId);
    if (mako?.imageUrl) {
      addCandidate(candidates, mako.source || "mako", mako.imageUrl, "https://www.mako.co.il/");
    }
    await sleep(150);
  }

  return candidates;
}

async function getHash(url, referer, hashCache) {
  const key = `${normalizeUrl(url)}|${referer || ""}`;
  if (hashCache.has(key)) return hashCache.get(key);

  const result = await downloadAndHash(normalizeUrl(url), referer);
  const hash = result.hash || null;
  hashCache.set(key, hash);
  return hash;
}

async function actualMatchesCandidates(actualUrl, candidates, row, hashCache) {
  if (!isValidImageUrl(actualUrl)) return null;

  for (const candidate of candidates) {
    if (urlsEquivalent(candidate.url, actualUrl)) {
      return { source: candidate.source, via: "url" };
    }
  }

  const actualNorm = normalizeUrl(actualUrl);
  for (const candidate of candidates) {
    if (normalizeUrl(candidate.url) === actualNorm) {
      return { source: candidate.source, via: "normalized-url" };
    }
  }

  const needsHash = candidates.some((c) => !urlsEquivalent(c.url, actualUrl));
  if (!needsHash) return null;

  const actualHash = await getHash(actualUrl, row.memorialUrl, hashCache);
  if (actualHash) {
    for (const candidate of candidates) {
      const candidateHash = await getHash(candidate.url, candidate.referer, hashCache);
      if (candidateHash && candidateHash === actualHash) {
        return { source: candidate.source, via: "hash" };
      }
    }
  }

  return null;
}

async function resolveAllCandidates(row, catalog, idfCache, options = {}) {
  const merged = collectStaticCandidates(row, catalog);
  if (options.staticOnly) return merged;

  if (row.memorialUrl || row.nliId) {
    const dynamic = await collectDynamicCandidates(row, idfCache);
    for (const candidate of dynamic) {
      addCandidate(merged, candidate.source, candidate.url, candidate.referer);
    }
  }
  return merged;
}

module.exports = {
  collectStaticCandidates,
  collectDynamicCandidates,
  resolveAllCandidates,
  actualMatchesCandidates,
};
