"""Upload column B (Image URL) updates to the Raw Images sheet."""

import argparse
import csv
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q"
SHEET_NAME = "Raw Images"
KEY_FILE = Path(
    os.environ.get(
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE",
        r"C:\Users\smilg\credentials.json",
    )
)
CSV_FILE = Path(__file__).resolve().parent / "raw-images-gh-update.csv"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def load_updates():
    updates = {}
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = (row.get("pid") or "").strip()
            image_url = (row.get("image_url") or "").strip()
            if pid and image_url:
                updates[pid] = image_url
    return updates


def main():
    parser = argparse.ArgumentParser(description="Upload Raw Images column B from gh-update CSV")
    parser.add_argument("--pid", action="append", help="Only sync these pid(s); repeatable")
    args = parser.parse_args()

    if not KEY_FILE.exists():
        print(f"Missing service account key: {KEY_FILE}", file=sys.stderr)
        sys.exit(1)
    if not CSV_FILE.exists():
        print(f"Missing update CSV: {CSV_FILE}", file=sys.stderr)
        sys.exit(1)

    updates = load_updates()
    if args.pid:
        allowed = {p.strip() for p in args.pid}
        updates = {k: v for k, v in updates.items() if k in allowed}
    if not updates:
        print("No rows to upload.", file=sys.stderr)
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_file(str(KEY_FILE), scopes=SCOPES)
    svc = build("sheets", "v4", credentials=creds)

    try:
        pid_values = (
            svc.spreadsheets()
            .values()
            .get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET_NAME}'!A:A")
            .execute()
            .get("values", [])
        )
    except HttpError as err:
        if err.resp.status == 403:
            print(
                "Read failed: service account lacks access on the spreadsheet.\n"
                f"Share the sheet with Editor permission for:\n  {creds.service_account_email}",
                file=sys.stderr,
            )
        raise SystemExit(1) from err

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
                "range": f"'{SHEET_NAME}'!B{row_idx}",
                "values": [[updates[pid]]],
            }
        )
        updated += 1

    if not batch:
        print("No matching PIDs found in sheet column A.", file=sys.stderr)
        sys.exit(1)

    try:
        result = (
            svc.spreadsheets()
            .values()
            .batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"valueInputOption": "USER_ENTERED", "data": batch},
            )
            .execute()
        )
    except HttpError as err:
        if err.resp.status == 403:
            print(
                "Write failed: service account lacks Editor access on the spreadsheet.\n"
                f"Share the sheet with Editor permission for:\n  {creds.service_account_email}\n"
                "Then rerun: npm run upload-raw-images-sheet",
                file=sys.stderr,
            )
        raise SystemExit(1) from err

    print(
        f"Updated {updated} image URLs in '{SHEET_NAME}' "
        f"({result.get('totalUpdatedCells', '?')} cells)."
    )


if __name__ == "__main__":
    main()
