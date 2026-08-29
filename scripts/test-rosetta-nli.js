const id = "987012976371205171";

const urls = [
  `https://rosetta.nli.org.il/delivery/DeliveryManagerServlet?dps_func=thumbnail&dps_pid=${id}`,
  `https://rosetta.nli.org.il/delivery/DeliveryManagerServlet?dps_func=thumbnail&dps_pid=NNL_ALEPH${id}`,
  `https://iiif.nli.org.il/IIIFv21/NNL_ALEPH${id}/full/max/0/default.jpg`,
  `https://www.mako.co.il/news-fallen/api/GetImage?id=${id}`,
  `https://www.mako.co.il/pzm-Soldiers/api/image/${id}`,
  `https://img.mako.co.il/Crop.ashx?url=https://rcs.mako.co.il/image/Editor/2023/${id}.jpg`,
];

(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
      const ct = r.headers.get("content-type") || "";
      const b = Buffer.from(await r.arrayBuffer());
      console.log(r.status, ct.split(";")[0], b.length, u);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
