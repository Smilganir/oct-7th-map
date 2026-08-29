const urls = [
  "https://www.idf.il/umbraco/delivery/api/v2/content?fetch=descendants:/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/&take=1",
  "https://www.idf.il/sitemap.xml",
  "https://www.idf.il/robots.txt",
];

(async () => {
  for (const u of urls) {
    const r = await fetch(u, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        "Accept-Language": "he-IL,he;q=0.9",
      },
    });
    const t = await r.text();
    console.log("\n", r.status, u, t.slice(0, 500).replace(/\s+/g, " "));
  }
})();
