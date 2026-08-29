/**
 * Upload memorial images to Cloudinary with PID as public_id.
 * Run: node scripts/upload-memorial-to-cloudinary.js
 * Requires .env.local with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Options (in order of use):
 * 1) imageUrl: direct image URL → upload from URL
 * 2) local file scripts/memorial-images/{pid}.jpg or .png → upload from file
 * 3) url: memorial page URL → try to scrape image (often 403 from server)
 */

require("dotenv").config({ path: ".env.local" });
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");

const MEMORIAL_IMAGES_DIR = path.join(__dirname, "memorial-images");

const ENTRIES = [
  { pid: "316", url: "https://www.shabak.gov.il/memorial/סמדר-מור-עידן/" },
  { pid: "1298", url: "https://www.shabak.gov.il/memorial/מאור-רפאל-שלום/" },
  { pid: "1612", url: "https://www.shabak.gov.il/memorial/מיכאל-בן-משה/" },
  { pid: "1693", url: "https://www.shabak.gov.il/memorial/יוסי-טהר/" },
  { pid: "2008", url: "https://www.shabak.gov.il/memorial/עומר-גברה/" },
];

function getImageUrlFromPage(html, pageUrl) {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) {
    let src = ogMatch[1].trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) {
      const u = new URL(pageUrl);
      src = u.origin + src;
    }
    return src;
  }
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) {
    let src = imgMatch[1].trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) {
      const u = new URL(pageUrl);
      src = u.origin + src;
    }
    return src;
  }
  return null;
}

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET in .env.local");
    process.exit(1);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  for (const entry of ENTRIES) {
    const { pid, url, imageUrl: directImageUrl } = entry;
    let source = null;
    let uploadOptions = { public_id: pid, overwrite: true };

    try {
      if (directImageUrl) {
        source = directImageUrl;
        console.log(`Uploading ${pid} from direct URL`);
      } else {
        const localJpg = path.join(MEMORIAL_IMAGES_DIR, `${pid}.jpg`);
        const localPng = path.join(MEMORIAL_IMAGES_DIR, `${pid}.png`);
        if (fs.existsSync(localJpg)) {
          source = localJpg;
          console.log(`Uploading ${pid} from local file: ${path.basename(localJpg)}`);
        } else if (fs.existsSync(localPng)) {
          source = localPng;
          console.log(`Uploading ${pid} from local file: ${path.basename(localPng)}`);
        } else if (url) {
          console.log(`Fetching ${pid}: ${url}`);
          const res = await fetch(url, {
            headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0" },
          });
          if (!res.ok) {
            console.error(`  Failed to fetch: ${res.status}. Use direct imageUrl or save images as scripts/memorial-images/{pid}.jpg`);
            continue;
          }
          const html = await res.text();
          source = getImageUrlFromPage(html, url);
          if (!source) {
            console.error(`  No image found on page`);
            continue;
          }
          console.log(`  Image URL: ${source}`);
        }
      }

      if (!source) {
        console.error(`  No source for ${pid}. Add imageUrl to ENTRIES or put ${pid}.jpg in scripts/memorial-images/`);
        continue;
      }

      const result = await cloudinary.uploader.upload(source, uploadOptions);
      console.log(`  Uploaded: ${result.secure_url}`);
    } catch (err) {
      console.error(`  Error:`, err.message);
    }
  }
  console.log("Done.");
}

main();
