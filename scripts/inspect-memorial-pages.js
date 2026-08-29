async function inspect(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/json",
    },
  });
  const html = await r.text();
  console.log("\n===", url, "status", r.status, "len", html.length);
  const patterns = [
    /https?:\/\/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)/gi,
    /\/media\/[a-z0-9]+\/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)/gi,
    /PictureGallery\/\d+\/[^\"'\s>]+/gi,
    /assets\/img\/[^\"'\s>]+/gi,
    /"image(?:Url|_url|Src)?"\s*:\s*"([^"]+)"/gi,
    /"photo(?:Url|_url)?"\s*:\s*"([^"]+)"/gi,
    /"picture(?:Url|_url)?"\s*:\s*"([^"]+)"/gi,
    /"mainImage"\s*:\s*"([^"]+)"/gi,
    /"url"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
  ];
  const found = new Set();
  for (const p of patterns) {
    for (const m of html.matchAll(p)) {
      found.add(m[1] || m[0]);
    }
  }
  console.log([...found].slice(0, 20).join("\n"));
}

(async () => {
  await inspect("https://lezichram.police.gov.il/main/nofel/42181");
  await inspect("https://www.idf.il/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%92-%D7%9E%D7%90%D7%9C-%D7%A2%D7%91%D7%90%D7%A1/");
  await inspect("https://laad.btl.gov.il/Web/He/TerrorVictims/Page/Default.aspx?ID=45652");
})();
