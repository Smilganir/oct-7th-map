async function testNli(id) {
  const candidates = [
    `https://iiif.nli.org.il/IIIFv21/${id}/full/max/0/default.jpg`,
    `https://iiif.nli.org.il/IIIFv21/DOCID/${id}/manifest`,
    `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH${id}/manifest`,
    `https://iiif.nli.org.il/IIIFv21/DOCID/NNL_ALEPH00${id}/manifest`,
    `https://api.nli.org.il/openlibrary/search?api_key=DVQyidFLOAjp12ib92pNJPmflmB5IessOq1CJQDK&query=recordid,exact,${id}`,
    `https://api.nli.org.il/openlibrary/search?api_key=DVQyidFLOAjp12ib92pNJPmflmB5IessOq1CJQDK&query=recordid,exact,NNL_ALEPH${id}`,
  ];
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      const ct = r.headers.get("content-type") || "";
      let body = "";
      if (ct.includes("json") || u.includes("manifest")) body = (await r.text()).slice(0, 300);
      console.log(id, r.status, u.split("?")[0], body ? body.replace(/\s+/g, " ") : "");
    } catch (e) {
      console.log("ERR", u, e.message);
    }
  }
}

function getImageUrlFromPage(html, pageUrl) {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) {
    let src = ogMatch[1].trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = new URL(pageUrl).origin + src;
    return src;
  }
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (imgMatch) {
    let src = imgMatch[1].trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = new URL(pageUrl).origin + src;
    return src;
  }
  return null;
}

async function testMemorial(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  const html = await r.text();
  const img = getImageUrlFromPage(html, url);
  console.log("memorial", r.status, url, "->", img);
}

async function inspectMemorial(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  const html = await r.text();
  const urls = [...html.matchAll(/(?:src|href|content)=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((u) => /\.(jpg|jpeg|png|webp)|media|image|photo|og:/i.test(u));
  console.log("memorial inspect", r.status, url);
  console.log(urls.slice(0, 15).join("\n"));
  const jsonMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonMatch) console.log("next data snippet", jsonMatch[1].slice(0, 800));
}

(async () => {
  await inspectMemorial("https://lezichram.police.gov.il/main/nofel/42181");
  await inspectMemorial("https://www.idf.il/%D7%A0%D7%95%D7%A4%D7%9C%D7%99%D7%9D/%D7%97%D7%9C%D7%9C%D7%99-%D7%94%D7%9E%D7%9C%D7%97%D7%9E%D7%94/%D7%92-%D7%9E%D7%90%D7%9C-%D7%A2%D7%91%D7%90%D7%A1/");
})();
