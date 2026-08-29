const tests = [
  "https://lezichram.police.gov.il/assets/img/42181.jpg",
  "https://lezichram.police.gov.il/assets/img/091617111655.png",
  "https://lezichram.police.gov.il/main/nofel/42181/photo",
  "https://www.police.gov.il/gal-ed/noflim/PictureGallery/042181/L_NP_042181_0.jpg",
  "https://img.mako.co.il/2024/01/01/987012976371205171.jpg",
  "https://rcs.mako.co.il/image/987012976371205171.jpg",
  "https://www.nli.org.il/website/memorial/987012976371205171.jpg",
  "https://www.nli.org.il/website/memorial-images/987012976371205171",
  "https://memorial.mako.co.il/api/victim/987012976371205171",
  "https://www.mako.co.il/pzm-Soldiers/api/GetSoldierImage?id=987012976371205171",
];

(async () => {
  for (const u of tests) {
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        redirect: "follow",
      });
      const ct = r.headers.get("content-type") || "";
      console.log(r.status, ct.split(";")[0], u);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
