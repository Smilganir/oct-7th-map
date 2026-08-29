# Sync DB to New Images (GitHub Actions)

Manual workflow for syncing new victims from **Oct_7th_DB** into **New Images**, uploading images to Cloudinary, and exporting JSON for the full database.

## For Yuval (run the sync)

1. Open the repo on GitHub: [Smilganir/oct-7th-map](https://github.com/Smilganir/oct-7th-map)
2. Go to **Actions** → **Sync DB to New Images**
3. Click **Run workflow** (branch: `main`)
4. Leave options unchecked for a normal run, or:
   - **dry_run** — preview only, no sheet changes
   - **skip_upload** — copy rows / resolve raw URLs only, no Cloudinary
5. Wait for the green checkmark (~1–5 minutes if there are no new rows; longer if new images upload)
6. Open the completed run → **Artifacts** → download **new-images-export** (`new-images-export.json`)

The JSON contains every row from **Oct_7th_DB**: `pid`, `firstName`, `lastName`, `cloudinaryUrl`.

## One-time setup (repo admin)

Add these **repository secrets** under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `CLOUDINARY_CLOUD_NAME` | e.g. `dpol0pyoo` |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full contents of the service account JSON file (`gsheetsnirsm@tabelau-public.iam.gserviceaccount.com`) |

Optional: `NLI_API_KEY` for National Library image fallback.

The service account must be **Editor** on the [spreadsheet](https://docs.google.com/spreadsheets/d/1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q/edit).

Add collaborators (e.g. `yuvharpaz@gmail.com`) under **Settings → Collaborators** so they can run workflows.

## Local run (alternative)

```bash
npm install
npm run sync-db-new-images
```

Output: `scripts/new-images-export.json`
