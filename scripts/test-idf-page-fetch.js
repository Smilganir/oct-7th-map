const url =
  "https://www.idf.il/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%93%D7%91%D7%99%D7%A8-%D7%91%D7%A8%D7%96%D7%A0%D7%99/";

fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    Referer: "https://www.idf.il/",
  },
})
  .then((r) => r.text())
  .then((t) => {
    console.log("len", t.length, "incap", t.includes("Incapsula"));
    const matches = [
      ...t.matchAll(/idf\.il\/media\/[a-z0-9]+\/[^"'\\s>?]+\.(?:jpe?g)/gi),
    ].map((m) => m[0]);
    console.log("matches", matches.slice(0, 5));
  });
