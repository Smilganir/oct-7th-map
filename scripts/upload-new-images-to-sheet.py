"""Upload columns G (Raw Image) and H (Cloudinary Image) to the New Images sheet."""

import csv
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SPREADSHEET_ID = "1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q"
SHEET_NAME = "New Images"
KEY_FILE = Path(
    os.environ.get(
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE",
        r"C:\Users\smilg\credentials.json",
    )
)
CSV_FILE = Path(__file__).resolve().parent / "new-images-gh-update.csv"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def load_rows():
    rows = []
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append([row.get("raw_image", ""), row.get("cloudinary_image", "")])
    return rows


def main():
    if not KEY_FILE.exists():
        print(f"Missing service account key: {KEY_FILE}", file=sys.stderr)
        sys.exit(1)
    if not CSV_FILE.exists():
        print(f"Missing update CSV: {CSV_FILE}", file=sys.stderr)
        sys.exit(1)

    values = load_rows()
    if not values:
        print("No rows to upload.", file=sys.stderr)
        sys.exit(1)

    start_row = 2
    end_row = start_row + len(values) - 1
    range_name = f"'{SHEET_NAME}'!G{start_row}:H{end_row}"

    creds = service_account.Credentials.from_service_account_file(str(KEY_FILE), scopes=SCOPES)
    svc = build("sheets", "v4", credentials=creds)

    try:
        result = (
            svc.spreadsheets()
            .values()
            .update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption="USER_ENTERED",
                body={"values": values},
            )
            .execute()
        )
    except HttpError as err:
        if err.resp.status == 403:
            print(
                "Write failed: service account lacks Editor access on the spreadsheet.\n"
                f"Share the sheet with Editor permission for:\n  {creds.service_account_email}\n"
                "Then rerun: npm run upload-new-images-sheet",
                file=sys.stderr,
            )
        raise SystemExit(1) from err

    filled = sum(1 for r in values if r[0])
    print(
        f"Updated {result.get('updatedCells', '?')} cells in {range_name} "
        f"({filled}/{len(values)} rows with raw image URLs)."
    )


if __name__ == "__main__":
    main()
