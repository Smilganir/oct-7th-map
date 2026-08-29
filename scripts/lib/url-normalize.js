/**
 * URL normalization helpers for image validation.
 */

const { extractPoliceNofelId } = require("./image-resolve");

function extractFetchTarget(url) {
  if (!url || typeof url !== "string") return null;
  const marker = "/image/fetch/";
  let current = url;
  while (true) {
    const idx = current.indexOf(marker);
    if (idx === -1) break;
    const rest = current.slice(idx + marker.length);
    const httpsIdx = rest.indexOf("https://");
    const httpIdx = rest.indexOf("http://");
    const start =
      httpsIdx >= 0 && (httpIdx < 0 || httpsIdx <= httpIdx) ? httpsIdx : httpIdx;
    if (start < 0) break;
    current = rest.slice(start);
  }
  return current !== url ? current : null;
}

/**
 * Unwrap Cloudinary fetch/upload wrappers to the underlying source URL when possible.
 */
function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  let u = url.trim();
  if (!u) return "";

  for (let i = 0; i < 5; i++) {
    const inner = extractFetchTarget(u);
    if (!inner) break;
    u = inner;
  }

  try {
    const parsed = new URL(u);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return u.split("#")[0];
  }
}

/**
 * Extract pid embedded in a Cloudinary upload public_id (e.g. 1477_ssautx, pid_737).
 * Returns null when no pid pattern is found.
 */
function extractPidFromCloudinaryUrl(url) {
  if (!url || !url.includes("res.cloudinary.com")) return null;

  const inner = normalizeUrl(url);
  const target = inner || url;

  const pidExplicit = target.match(/pid_(\d+)/i);
  if (pidExplicit) return pidExplicit[1];

  const uploadSegment = target.match(/\/image\/upload\/(?:v\d+\/)?([^/?#]+)/i);
  if (uploadSegment) {
    const filename = uploadSegment[1].split("/").pop();
    const named = filename.match(/^(\d+)_[a-z0-9]/i);
    if (named) return named[1];
  }

  return null;
}

function extractPoliceGalleryId(url) {
  if (!url) return null;
  const normalized = normalizeUrl(url);
  const m = normalized.match(/PictureGallery\/(\d+)/i);
  return m ? m[1].replace(/^0+/, "") || "0" : null;
}

/**
 * Cross-check police memorial nofel id vs gallery id in image URL.
 */
function policeIdsConsistent(memorialUrl, imageUrl) {
  const nofelId = extractPoliceNofelId(memorialUrl);
  if (!nofelId) return { ok: true };

  const galleryId = extractPoliceGalleryId(imageUrl);
  if (!galleryId) return { ok: true };

  const a = String(nofelId).replace(/^0+/, "") || "0";
  const b = String(galleryId).replace(/^0+/, "") || "0";
  return { ok: a === b, nofelId: a, galleryId: b };
}

function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u || u === "#N/A" || u === "#REF!" || u === "#VALUE!") return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

function urlsEquivalent(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return normalizeUrl(a) === normalizeUrl(b);
}

module.exports = {
  extractFetchTarget,
  normalizeUrl,
  extractPidFromCloudinaryUrl,
  extractPoliceGalleryId,
  policeIdsConsistent,
  isValidImageUrl,
  urlsEquivalent,
};
