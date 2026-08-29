/**
 * Download an image and apply a local portrait crop (no Cloudinary).
 * Uses top-weighted center crop — memorial ID photos are usually framed that way.
 */

const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TARGET_W = 150;
const TARGET_H = 195;
const TARGET_ASPECT = TARGET_W / TARGET_H;

function computePortraitCrop(width, height) {
  let cropW;
  let cropH;
  const imageAspect = width / height;

  if (imageAspect > TARGET_ASPECT) {
    cropH = height;
    cropW = Math.round(height * TARGET_ASPECT);
  } else {
    cropW = width;
    cropH = Math.round(width / TARGET_ASPECT);
  }

  const left = Math.max(0, Math.round((width - cropW) / 2));
  const top = Math.max(0, Math.round((height - cropH) * 0.12));
  const extractW = Math.min(cropW, width - left);
  const extractH = Math.min(cropH, height - top);

  return { left, top, width: extractW, height: extractH };
}

async function downloadImage(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: referer || url,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("image too small");
  return buf;
}

/**
 * @returns {{ ok: true, filePath: string, method: string } | { ok: false, error: string }}
 */
async function cropAndSave(pid, imageUrl, referer, outDir) {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    return { ok: false, error: "sharp not installed" };
  }

  try {
    const buf = await downloadImage(imageUrl, referer);
    const image = sharp(buf);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, error: "unknown dimensions" };
    }

    const crop = computePortraitCrop(meta.width, meta.height);
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `${pid}.jpg`);

    await sharp(buf)
      .extract(crop)
      .resize(TARGET_W, TARGET_H, { fit: "cover", position: "north" })
      .jpeg({ quality: 88 })
      .toFile(filePath);

    return { ok: true, filePath, method: "local-portrait-crop" };
  } catch (err) {
    return { ok: false, error: err.message || "crop failed" };
  }
}

module.exports = {
  TARGET_W,
  TARGET_H,
  downloadImage,
  cropAndSave,
};
