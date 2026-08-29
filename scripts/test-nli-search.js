const API_KEY = process.env.NLI_API_KEY || "DVQyidFLOAjp12ib92pNJPmflmB5IessOq1CJQDK";
const id = process.argv[2] || "987012976371205171";

async function search(query) {
  const u = `https://api.nli.org.il/openlibrary/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&limit=1`;
  const r = await fetch(u);
  const j = await r.json();
  console.log("\nquery:", query, "status:", r.status);
  console.log(JSON.stringify(j, null, 2).slice(0, 3000));
}

(async () => {
  await search(`recordid,exact,${id}`);
  await search(`recordid,exact,NNL_ALEPH${id}`);
  await search(`recordid,exact,NNL_ALEPH00${id}`);
})();
