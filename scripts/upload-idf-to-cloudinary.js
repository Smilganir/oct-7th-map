/**
 * Upload IDF media images to Cloudinary with PID as public_id.
 * Fetches each image with browser-like headers (bypass) then uploads.
 * Run: node scripts/upload-idf-to-cloudinary.js
 */

require("dotenv").config({ path: ".env.local" });
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");
const os = require("os");

const IDF_ENTRIES = [
  { pid: "263", url: "https://www.idf.il/media/mk4ohsxy/אלכסנדר-מאסלי.jpeg" },
  { pid: "265", url: "https://www.idf.il/media/uaado1jl/אפיק-רוזנטל.jpeg" },
  { pid: "276", url: "https://www.idf.il/media/lugcb5lt/אברהם-אבי-קורין.jpeg" },
  { pid: "307", url: "https://www.idf.il/media/kh5dtq1n/ים-גולדשטיין-אלמוג.jpeg" },
  { pid: "334", url: "https://www.idf.il/media/myzo5kwj/71e12a05-9b20-44ee-bb21-eca63bc3f899.jpg" },
  { pid: "338", url: "https://www.idf.il/media/zgnjpfsl/אופיר-שושני.jpeg" },
  { pid: "370", url: "https://www.idf.il/media/3v3dmxjf/עמיחי-יעקב-ונינו.jpeg" },
  { pid: "392", url: "https://www.idf.il/media/gwvn3thu/יונתן-סביצקי.jpeg" },
  { pid: "397", url: "https://www.idf.il/media/cn4dga1b/עמית-פלד.jpeg" },
  { pid: "420", url: "https://www.idf.il/media/njwnsbgr/ירין-מארי-פלד.jpeg" },
  { pid: "429", url: "https://www.idf.il/media/hv5hmbng/תומר-ליבוביץ.jpeg" },
  { pid: "463", url: "https://www.idf.il/media/xckdttox/שי-אשרם.jpeg" },
  { pid: "464", url: "https://www.idf.il/media/2m3px2h3/סיון-שמחה-אסראף.jpeg" },
  { pid: "465", url: "https://www.idf.il/media/4q2dv3aa/נטע-בר-עם.jpeg" },
  { pid: "475", url: "https://www.idf.il/media/hf3pzjcq/אדיר-אשטו-בוגלה.jpeg" },
  { pid: "486", url: "https://www.idf.il/media/ttuaqyhx/שחף-ניסני.jpeg" },
  { pid: "487", url: "https://www.idf.il/media/fyphuefl/איתי-גליסקו.jpeg" },
  { pid: "489", url: "https://www.idf.il/media/mvph52ek/חביב-קיעאן.jpeg" },
  { pid: "492", url: "https://www.idf.il/media/tpvjhbvd/שלמה-רשטניקוב.jpeg" },
  { pid: "850", url: "https://www.idf.il/media/h53gnyrz/קארין-שוורצמן.jpeg" },
  { pid: "994", url: "https://www.idf.il/media/gv3clnul/רום-שלומי.jpeg" },
  { pid: "1033", url: "https://www.idf.il/media/yenldxia/גד-אביעד-כהן.jpeg" },
  { pid: "1555", url: "https://www.idf.il/media/uc0oyrp1/עומרי-פרץ.jpeg" },
  { pid: "1580", url: "https://www.idf.il/media/v5zluex4/עידן-רז.jpeg" },
  { pid: "1587", url: "https://www.idf.il/media/dogfqp5n/אביאל-מלקמו.jpeg" },
  { pid: "1695", url: "https://www.idf.il/media/dlvh1mrr/מחמד-אלאטרש.jpeg" },
  { pid: "1726", url: "https://www.idf.il/media/nombhbf5/עוז-דניאל.jpg" },
  { pid: "1732", url: "https://www.idf.il/media/et0ofz5y/ראוכברגר-שילה.jpeg" },
];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Referer": "https://www.idf.il/",
  "Accept-Language": "en-US,en;q=0.9",
};

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing CLOUDINARY_* in .env.local");
    process.exit(1);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  for (const { pid, url } of IDF_ENTRIES) {
    let tmpPath = null;
    try {
      console.log(`Fetching ${pid}: ${url}`);
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if (!res.ok) {
        console.error(`  Failed: ${res.status} ${res.statusText}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      tmpPath = path.join(os.tmpdir(), `idf-${pid}-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buf);
      const result = await cloudinary.uploader.upload(tmpPath, {
        public_id: pid,
        overwrite: true,
      });
      console.log(`  Uploaded: ${result.secure_url}`);
    } catch (err) {
      console.error(`  Error:`, err.message);
    } finally {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
  console.log("Done.");
}

main();
