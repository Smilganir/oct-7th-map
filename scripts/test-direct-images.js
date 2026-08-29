const tests = [
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpg",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpeg",
  "https://laad.btl.gov.il/view_files/Nofel_Pic/045652/NP_045652_10.jpg",
  "https://www.idf.il/media/culture/fallen-soldiers/jamal-abbas.jpeg",
];

(async () => {
  for (const u of tests) {
    const r = await fetch(u, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*,*/*",
        Referer: u.includes("police") ? "https://lezichram.police.gov.il/" : "https://www.idf.il/",
      },
      redirect: "follow",
    });
    console.log(r.status, r.headers.get("content-type"), u);
  }
})();
