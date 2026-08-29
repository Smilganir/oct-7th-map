const id = "987012976371205171";

const urls = [
  `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH${id}/manifest`,
  `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH${id}/full/max/0/default.jpg`,
  `https://iiif.nli.org.il/IIIFv21/NNL_ALEPH${id}/full/max/0/default.jpg`,
];

(async () => {
  for (const u of urls) {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    console.log("---", r.status, u);
    console.log(t.slice(0, 500));
  }
})();
