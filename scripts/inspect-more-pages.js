async function dump(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  const html = await r.text();
  console.log("\n===", url, r.status, html.length);
  const patterns = [
    /og:image[^>]+content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]+og:image/gi,
    /PictureGallery\/\d+\/[^"'\s>]+/gi,
    /view_files\/[^"'\s>]+/gi,
    /"image[^"]*"\s*:\s*"([^"]+)"/gi,
    /src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-src=["']([^"']+)["']/gi,
  ];
  const found = new Set();
  for (const p of patterns) {
    for (const m of html.matchAll(p)) found.add(m[1] || m[0]);
  }
  console.log([...found].join("\n"));
}

(async () => {
  await dump("https://lezichram.police.gov.il/main/nofel/42181");
  await dump("https://www.izkor.gov.il/%D7%A9%D7%99-%D7%9E%D7%99%D7%9B%D7%90%D7%9C%D7%99/en_ec04401e4819cb670700008b373d9f20");
  await dump("https://www.gov.il/en/pages/ilia-nozadze");
})();
