/**
 * Read-only Google Sheets API helper for validation scripts.
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const DEFAULT_SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q";
const DEFAULT_KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
  "C:\\Users\\smilg\\credentials.json";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function getKeyFile() {
  const keyPath = path.resolve(DEFAULT_KEY_FILE);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Missing service account key: ${keyPath}`);
  }
  return keyPath;
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: getKeyFile(),
    scopes: SCOPES,
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/**
 * List sheet tab titles in a spreadsheet.
 */
async function listSheetTitles(spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
}

/**
 * Fetch all values from a tab (including header row).
 */
async function getTabValues(tabName, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const sheets = await getSheetsClient();
  const range = `'${tabName.replace(/'/g, "''")}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values || [];
}

/**
 * Convert raw sheet values to objects keyed by header names.
 */
function valuesToRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h ?? "").trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const rowValues = values[i] || [];
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      row[key] = String(rowValues[c] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Get tab rows as header-keyed objects.
 */
async function getTabRows(tabName, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const values = await getTabValues(tabName, spreadsheetId);
  return valuesToRows(values);
}

/**
 * Find a tab whose header row contains the given header text.
 */
async function findTabByHeader(headerText, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const titles = await listSheetTitles(spreadsheetId);
  for (const title of titles) {
    const values = await getTabValues(title, spreadsheetId);
    if (!values.length) continue;
    const headers = values[0].map((h) => String(h ?? "").trim());
    if (headers.includes(headerText)) {
      return { title, rows: valuesToRows(values), headers };
    }
  }
  return null;
}

/**
 * Build pid → memorial URL map from main DB tab (column הנצחה).
 */
async function getMemorialUrlMap(spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const found = await findTabByHeader("הנצחה", spreadsheetId);
  if (!found) {
    throw new Error("Could not find a tab with הנצחה column for memorial URL lookup");
  }

  const pidKey =
    found.headers.find((h) => /^pid$/i.test(h)) ||
    found.headers[0] ||
    "pid";

  const map = new Map();
  for (const row of found.rows) {
    const pid = String(row[pidKey] ?? "").trim();
    const memorial = String(row["הנצחה"] ?? "").trim();
    if (pid && memorial) map.set(pid, memorial);
  }
  return { map, tabName: found.title };
}

/**
 * Build pid → { memorialUrl, nliId, name } from main DB tab.
 */
async function getDbMetadataMap(spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const found = await findTabByHeader("הנצחה", spreadsheetId);
  if (!found) {
    throw new Error("Could not find a tab with הנצחה column for DB metadata lookup");
  }

  const pidKey =
    found.headers.find((h) => /^pid$/i.test(h)) ||
    found.headers[0] ||
    "pid";

  const map = new Map();
  for (const row of found.rows) {
    const pid = String(row[pidKey] ?? "").trim();
    if (!pid) continue;
    const memorialUrl = String(row["הנצחה"] ?? "").trim();
    const nliId = String(row["הספריה הלאומית"] ?? "").trim();
    const name =
      [row["שם פרטי"], row["שם משפחה"]].filter(Boolean).join(" ").trim() ||
      [row["first name"], row["last name"]].filter(Boolean).join(" ").trim();
    map.set(pid, {
      memorialUrl: memorialUrl && memorialUrl !== "#N/A" ? memorialUrl : "",
      nliId: nliId && nliId !== "#N/A" ? nliId : "",
      name,
    });
  }
  return { map, tabName: found.title };
}

module.exports = {
  DEFAULT_SPREADSHEET_ID,
  getSheetsClient,
  listSheetTitles,
  getTabValues,
  getTabRows,
  findTabByHeader,
  getMemorialUrlMap,
  getDbMetadataMap,
  valuesToRows,
};
