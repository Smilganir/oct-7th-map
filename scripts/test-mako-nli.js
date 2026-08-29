const id = "987012976371205171";
const urls = [
  `https://www.mako.co.il/pzm-Soldiers/AjaxPage?jspName=ajaxResponse.jsp&action=getVictimImage&id=${id}`,
  `https://api.mako.co.il/memorial/victim/${id}`,
  `https://rcs.mako.co.il/image/item/${id}.jpg`,
  `https://f7img.mako.co.il/item/${id}.jpg`,
  `https://img.mako.co.il/Crop.ashx?url=https://rcs.mako.co.il/image/item/${id}`,
];

(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        redirect: "manual",
      });
      const ct = r.headers.get("content-type") || "";
      let extra = "";
      if (ct.includes("json") || ct.includes("text")) {
        extra = (await r.text()).slice(0, 200).replace(/\s+/g, " ");
      }
      console.log(r.status, ct.split(";")[0], u, extra);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
