const urls = [
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpg",
  "https://lezichram.police.gov.il/assets/img/091617111655.png",
  "https://laad.btl.gov.il/Uploads/FacebookShare/45652facebookShare.jpg",
];

(async () => {
  for (const u of urls) {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(u);
    console.log(" status", r.status, "ct", r.headers.get("content-type"), "bytes", buf.length, "magic", buf.slice(0, 4).toString("hex"));
  }
})();
