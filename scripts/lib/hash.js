/**
 * Download image bytes and compute SHA-256 hash.
 */

const crypto = require("crypto");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function refererFor(url) {
  try {
    const u = new URL(url);
    return u.origin + encodeURI(decodeURI(u.pathname)) + u.search;
  } catch {
    return "https://www.google.com/";
  }
}

/**
 * Stream download and return SHA-256 hex digest of image bytes.
 * @returns {{ hash: string, bytes: number } | { error: string }}
 */
async function downloadAndHash(url, referer, timeoutMs = 20000) {
  if (!url || !url.startsWith("http")) {
    return { error: "invalid url" };
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer ? refererFor(referer) : refererFor(url),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      bytes += value.length;
    }
    if (bytes < 4) {
      return { error: "empty response" };
    }
    return { hash: hash.digest("hex"), bytes };
  } catch (err) {
    return { error: err.message || "download failed" };
  }
}

module.exports = {
  UA,
  refererFor,
  downloadAndHash,
};
