const id = "987012976371205171";

const urls = [
  `https://www.nli.org.il/media/${id}/photo.jpg`,
  `https://www.nli.org.il/media/${id}.jpg`,
  `https://www.nli.org.il/media/${id}`,
  `https://iiif.nli.org.il/IIIFv21/${id}/full/!800,800/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH00${id}/full/max/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH${id}/full/max/0/default.jpg`,
  `https://api.nli.org.il/openlibrary/presentation?id=${id}`,
  `https://www.nli.org.il/he/visit/exhibitions-and-displays/displays/7-october-victims/${id}`,
  `https://www.nli.org.il/he/visit/exhibitions-and-displays/displays/7-october-victims?id=${id}`,
  `https://www.nli.org.il/umbraco/api/memorial/victim/${id}`,
  `https://www.nli.org.il/api/memorial/victim/${id}`,
  `https://www.nli.org.il/website/api/memorial/${id}`,
];

(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
      });
      const ct = r.headers.get("content-type") || "";
      console.log(r.status, ct.split(";")[0], u);
      if (ct.includes("json")) {
        const t = await r.text();
        console.log("  ", t.slice(0, 200));
      }
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
