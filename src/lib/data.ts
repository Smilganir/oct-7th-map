import Papa from "papaparse";
import type { MapLocationRow, Oct7thDBRow, OverviewLocation } from "@/types/data";

const MAP_LOCATIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0T4vDFyLtNKmuRF0TW31psjY8qMWkPbZCoE74D6hchs4JW5WP0An7PuOjW12dYr3IrAdA-tHox5Sw/pub?output=csv&gid=0";
const OCT_7TH_DB_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0T4vDFyLtNKmuRF0TW31psjY8qMWkPbZCoE74D6hchs4JW5WP0An7PuOjW12dYr3IrAdA-tHox5Sw/pub?output=csv&gid=1";

const OCT_10_2023 = new Date("2023-10-10");

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(s: string): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Parse Map Locations CSV. Columns: A=0 Location, B=1 Visual_Lat (Y), C=2 Visual_Lon (X), D=3 Shape.
 */
function parseMapLocations(csvText: string): MapLocationRow[] {
  const result = Papa.parse<string[]>(csvText, { header: false });
  const rows = result.data ?? [];
  const out: MapLocationRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    const location = String(row[0] ?? "").trim();
    if (!location) continue;
    out.push({
      location,
      visualLatY: parseNum(row[1]),
      visualLonX: parseNum(row[2]),
      shape: String(row[3] ?? "").trim(),
    });
  }
  return out;
}

/**
 * Oct_7th_DB columns: A=0 pid, K=10 age, P=15 status, Q=16 Event date,
 * AC=28 Lat (alternate), AD=29 Long (alternate), AG=32 new maub death loc, AJ=35 Image URL.
 */
function parseOct7thDB(csvText: string): Oct7thDBRow[] {
  const result = Papa.parse<string[]>(csvText, { header: false });
  const rows = result.data ?? [];
  const out: Oct7thDBRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 36) continue;
    const pid = String(row[0] ?? "").trim();
    if (!pid) continue;
    out.push({
      pid,
      age: String(row[10] ?? "").trim(),
      status: String(row[15] ?? "").trim(),
      eventDate: String(row[16] ?? "").trim(),
      latAlternate: parseNum(row[28]),
      longAlternate: parseNum(row[29]),
      newMaubDeathLoc: String(row[32] ?? "").trim(),
      imageUrl: String(row[35] ?? "").trim(),
    });
  }
  return out;
}

/**
 * Distinct count of pid in Oct_7th_DB where Event date < Oct 10, 2023
 * and new maub death loc = locationName and new maub death loc <> 'Other'.
 */
function distinctPidCount(
  db: Oct7thDBRow[],
  locationName: string
): number {
  const set = new Set<string>();
  for (const r of db) {
    if (r.newMaubDeathLoc !== locationName) continue;
    if (r.newMaubDeathLoc === "Other") continue;
    const d = parseDate(r.eventDate);
    if (!d || d >= OCT_10_2023) continue;
    set.add(r.pid);
  }
  return set.size;
}

/** Normalize shape for display: '?' -> 'rest'. */
function shapeDisplay(shape: string): string {
  const s = shape.trim();
  return s === "?" ? "rest" : s || "rest";
}

export type DataLoadResult = {
  mapLocations: MapLocationRow[];
  oct7thDB: Oct7thDBRow[];
  overviewLocations: OverviewLocation[];
};

/**
 * Fetch both CSVs, parse, and compute overview aggregates.
 * If a sheet fails (e.g. wrong gid), that array is empty.
 */
export async function loadData(): Promise<DataLoadResult> {
  const [mapLocText, dbText] = await Promise.all([
    fetch(MAP_LOCATIONS_CSV_URL).then((r) => (r.ok ? r.text() : "")),
    fetch(OCT_7TH_DB_CSV_URL).then((r) => (r.ok ? r.text() : "")),
  ]);

  const mapLocations = mapLocText ? parseMapLocations(mapLocText) : [];
  const oct7thDB = dbText ? parseOct7thDB(dbText) : [];

  const overviewLocations: OverviewLocation[] = mapLocations.map((loc) => {
    const dotSize = distinctPidCount(oct7thDB, loc.location);
    const firstAtLoc = oct7thDB.find(
      (r) => r.newMaubDeathLoc === loc.location && r.latAlternate && r.longAlternate
    );
    return {
      ...loc,
      dotSize,
      shapeDisplay: shapeDisplay(loc.shape),
      centerLat: firstAtLoc?.latAlternate,
      centerLon: firstAtLoc?.longAlternate,
    };
  });

  return { mapLocations, oct7thDB, overviewLocations };
}
