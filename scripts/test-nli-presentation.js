const id = "987012802851605171";
const urls = [
  `https://api.nli.org.il/openlibrary/presentation?id=${id}`,
  `https://api.nli.org.il/openlibrary/presentation?id=NNL_ALEPH${id}`,
  `https://api2.nli.org.il/openlibrary/presentation?id=${id}`,
];

(async () => {
  for (const u of urls) {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    console.log(r.status, u, t.slice(0, 800).replace(/\s+/g, " "));
  }
})();
