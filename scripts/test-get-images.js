const tests = [
  "https://laad.btl.gov.il/view_files/Nofel_Pic/045652/NP_045652_10.jpg",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpg",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042156/L_NP_042156_0.jpg",
];

(async () => {
  for (const u of tests) {
    try {
      const r = await fetch(u, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/*,*/*",
          Referer: u.includes("police") ? "https://lezichram.police.gov.il/" : "https://laad.btl.gov.il/",
        },
        redirect: "manual",
      });
      const ct = r.headers.get("content-type") || "";
      const loc = r.headers.get("location") || "";
      console.log(r.status, ct.split(";")[0], loc, u);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
