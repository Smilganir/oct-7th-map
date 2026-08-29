const id = "987012976371205171";
const urls = [
  `https://iiif.nli.org.il/IIIFv21/${id}/full/max/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/NNL_ALEPH${id}/full/max/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/NNL_ALEPH00${id}/full/max/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH${id}/manifest`,
  `https://api.nli.org.il/openlibrary/search?query=${id}&limit=1`,
  `https://www.idf.il/umbraco/delivery/api/v2/content?fetch=children:/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%92-%D7%9E%D7%90%D7%9C-%D7%A2%D7%91%D7%90%D7%A1/`,
];

(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
      });
      const ct = r.headers.get("content-type") || "";
      let extra = "";
      if (ct.includes("json") || r.status === 200) {
        extra = " :: " + (await r.text()).slice(0, 400).replace(/\s+/g, " ");
      }
      console.log(r.status, ct.split(";")[0], u, extra);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
