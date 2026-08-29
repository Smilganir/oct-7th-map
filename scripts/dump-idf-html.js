const url = "https://www.idf.il/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%92-%D7%9E%D7%90%D7%9C-%D7%A2%D7%91%D7%90%D7%A1/";
fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } })
  .then((r) => r.text())
  .then((h) => console.log(h))
  .catch((e) => console.error(e));
