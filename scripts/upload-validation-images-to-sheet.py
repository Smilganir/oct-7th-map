"""Upload validation image URLs to Raw Images column F (image validation)."""

import argparse
import csv
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q"
SHEET_NAME = "Raw Images"
VALIDATION_COLUMN = "F"
KEY_FILE = Path(
    __import__("os").environ.get(
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE",
        r"C:\Users\smilg\credentials.json",
    )
)
CSV_FILE = Path(__file__).resolve().parent / "validation-images-sheet.csv"
BATCH_SIZE = 500


def pick_url(row):
    source = (row.get("source_url") or "").strip()
    validation = (row.get("validation_url") or "").strip()
    if source:
        return source
    if validation and "oct7database.com/validation-images" not in validation:
        return validation
    return ""


def sheet_value(url: str) -> str:
    """Use IMAGE() so URLs render visually in Google Sheets."""
    if not url:
        return ""
    escaped = url.replace('"', '""')
    return f'=IMAGE("{escaped}")'


def load_updates():
    updates = {}
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            pid = (row.get("pid") or "").strip()
            url = pick_url(row)
            if pid and url:
                updates[pid] = url
    return updates


def main():
    parser = argparse.ArgumentParser(description="Upload Raw Images column F validation URLs")
    parser.add_argument("--pid", action="append", help="Only sync these pid(s)")
    args = parser.parse_args()

    if not CSV_FILE.exists():
        print(f"Missing CSV: {CSV_FILE}", file=sys.stderr)
        sys.exit(1)

    updates = load_updates()
    if args.pid:
        allowed = {p.strip() for p in args.pid}
        updates = {k: v for k, v in updates.items() if k in allowed}
    if not updates:
        print("No rows to upload.", file=sys.stderr)
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_file(
        str(KEY_FILE), scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    svc = build("sheets", "v4", credentials=creds)

    pid_values = (
        svc.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET_NAME}'!A:A")
        .execute()
        .get("values", [])
    )

    batch = []
    updated = 0
    for row_idx, row in enumerate(pid_values, start=1):
        if row_idx == 1 or not row:
            continue
        pid = str(row[0]).strip()
        if pid not in updates:
            continue
        batch.append(
            {
                "range": f"'{SHEET_NAME}'!{VALIDATION_COLUMN}{row_idx}",
                "values": [[sheet_value(updates[pid])]],
            }
        )
        updated += 1

    if not batch:
        print("No matching PIDs in column A.", file=sys.stderr)
        sys.exit(1)

    total_cells = 0
    for i in range(0, len(batch), BATCH_SIZE):
        chunk = batch[i : i + BATCH_SIZE]
        result = (
            svc.spreadsheets()
            .values()
            .batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"valueInputOption": "USER_ENTERED", "data": chunk},
            )
            .execute()
        )
        total_cells += result.get("totalUpdatedCells", 0)
        print(f"Uploaded chunk {i // BATCH_SIZE + 1}: {len(chunk)} cells")

    print(
        f"Updated {updated} validation URLs in '{SHEET_NAME}' column {VALIDATION_COLUMN} "
        f"({total_cells} cells)."
    )


if __name__ == "__main__":
    try:
        main()
    except HttpError as err:
        print(err, file=sys.stderr)
        sys.exit(1)
