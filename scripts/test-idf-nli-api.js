const tests = [
  "https://www.idf.il/umbraco/delivery/api/v2/content?fetch=children:/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%92-%D7%9E%D7%90%D7%9C-%D7%A2%D7%91%D7%90%D7%A1/",
  "https://www.idf.il/umbraco/delivery/api/v2/content/item/gamal-abas",
  "https://www.idf.il/media/culture/fallen-soldiers/jamal-abbas.jpg",
  "https://api.mako.co.il/memorial/victim/987012976371205171",
  "https://www.mako.co.il/pzm-Soldiers/AjaxPage?jspName=ajaxResponse.jsp&action=getVictimImage&id=987012976371205171",
  "https://img.mako.co.il/Crop.ashx?url=https://rcs.mako.co.il/image/item/987012976371205171",
  "https://rcs.mako.co.il/image/item/987012976371205171.jpg",
  "https://f7img.mako.co.il/item/987012976371205171.jpg",
  "https://www.nli.org.il/website/memorial-wall/images/987012976371205171.jpg",
  "https://memorial-wall.nli.org.il/api/victim/987012976371205171",
];

(async () => {
  for (const u of tests) {
    try {
      const r = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*",
        },
        redirect: "manual",
      });
      const ct = r.headers.get("content-type") || "";
      let extra = "";
      if (ct.includes("json") || r.status === 200) {
        const t = (await r.text()).slice(0, 250);
        extra = " :: " + t.replace(/\s+/g, " ");
      }
      console.log(r.status, ct.split(";")[0], u, extra);
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
})();
