const tests = [
  "https://www.izkor.gov.il/api/search?q=דביר%20ברזני",
  "https://www.izkor.gov.il/search?q=דביר%20ברזני",
  "https://www.izkor.gov.il/api/person/search?name=דביר%20ברזני",
];

(async () => {
  for (const u of tests) {
    const r = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json,text/html" },
      redirect: "manual",
    });
    const ct = r.headers.get("content-type") || "";
    const t = (await r.text()).slice(0, 300);
    console.log(r.status, ct.split(";")[0], u, t.replace(/\s+/g, " "));
  }
})();
