const tests = [
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/04306440/L_NP_04306440_0.jpg",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/043064/L_NP_043064_0.jpg",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpg",
];

(async () => {
  for (const u of tests) {
    const r = await fetch(u, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://lezichram.police.gov.il/",
      },
      redirect: "manual",
    });
    console.log(r.status, r.headers.get("content-type"), u);
  }
})();
