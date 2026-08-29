# Image validation proposal

Handoff doc for continuing work in a new chat. Summarizes the problem, validation strategy, existing code, and recommended implementation.

## Context

- **Data source:** Google Sheet `Oct_7th_DB`, published as CSV.
- **Site:** `oct7database.com` / Next.js map app reads sheet data at runtime.
- **Key columns:**
  - **A** — `pid` (unique person ID)
  - **W** — `הנצחה` (memorial page URL; source of truth for expected image)
  - **AJ** — `Image URL` (what the site displays)
- **App parsing:** `src/lib/data.ts` maps column A → `pid`, column AJ → `imageUrl`.

The app must keep **pid ↔ imageUrl** aligned per row. Swaps or wrong-column imports show the wrong person's photo while the row metadata (age, location, etc.) stays correct.

## Known failure mode (example)

Reported swap: **Ido Adri (pid 737)** ↔ **Eli Nachman (pid 1477)**.

In `scripts/raw-images-sheet.csv` the Cloudinary URLs themselves were crossed:

| pid  | name        | Image URL contains |
|------|-------------|--------------------|
| 737  | עידו אדרי   | `1477_ssautx.png`  |
| 1477 | עילי נחמן   | `737_gy5hps.png`   |

This is detectable without face recognition: row pid does not match pid embedded in the URL filename.

**Harder case:** Cloudinary `public_id` is correct (`pid_737`) but uploaded bytes are another person's photo. URL/pid checks pass; only comparison against an independent source (memorial page) catches it.

## What validation cannot do alone

- **URL/pid structural checks** do not detect content swaps when naming is correct.
- **No automatic face recognition** is planned; memorial-page comparison is the practical approach.
- If both sheet and memorial source are wrong the same way, only manual review catches it.

## Validation layers (recommended order)

### Layer 1 — Structural (fast, local, seconds)

Run on CSV export; no network required (optional HTTP 200 check).

| Check | What it catches |
|-------|-----------------|
| `pid` in Cloudinary path | Row 737 with `pid_1477` or `1477_` in URL |
| Duplicate `imageUrl` across different pids | Same URL on two rows → likely swap |
| Police ID consistency | `nofel/42181` in memorial URL ↔ `042181` in PictureGallery URL |
| Missing / invalid | `#N/A`, empty, non-http URL |

**Estimated effort:** ~1 hour, ~50–100 lines Node.  
**Coverage:** ~60–70% of swap mistakes (especially copy/paste and Cloudinary upload mix-ups).

### Layer 2 — Memorial source comparison (medium, network)

For each row with a memorial URL:

1. Resolve **expected** image URL from memorial page (reuse `fetch-new-images.js` logic).
2. Read **actual** image URL from column AJ (normalize Cloudinary wrappers to underlying source if needed).
3. Compare URLs directly, or compare content hashes after download.

**Reuse existing code:**

- `scripts/fetch-new-images.js` — `resolveFromMemorial()`, `resolveNli()`, `verifyImageUrl()`, `loadIdfCache()`
- `scripts/idf-image-cache.json` — IDF pages that block simple fetch
- `scripts/build-idf-image-cache.js` — rebuild IDF cache when needed

**Suggested CLI:**

```bash
node scripts/validate-images.js              # structural + memorial compare
node scripts/validate-images.js --structural   # layer 1 only
node scripts/validate-images.js --pid 737      # single row
node scripts/validate-images.js --limit 20
```

**Output:** CSV or JSON report, e.g.:

```text
MISMATCH pid=737   expected=<memorial-url>  actual=<sheet-url>  name=עידו אדרי
DUPLICATE url=...  pids=1203,1207
MISSING pid=2111   column AJ empty
OK 172/178
```

**Estimated effort:** ~2–4 hours (extend existing fetch script or new `validate-images.js`).  
**Runtime:** ~5–30 minutes for ~180 rows (rate limits, IDF/Shabak blocks).  
**Coverage:** ~90%+ when memorial URL exists.

**Swap-pair detection (bonus):** If pid A's sheet image hash equals pid B's memorial image hash and vice versa, flag as `SWAP_PAIR`.

### Layer 3 — Manual review (human)

HTML review page or iframe grid: pid, name, sheet image, link to memorial page.  
Run only on Layer 1–2 failures.

**Estimated effort:** ~1–2 hours for a simple static review page.

## Existing scripts (inventory)

| File | Role | Gap |
|------|------|-----|
| `scripts/fetch-new-images.js` | Fetch expected URLs from memorial / NLI | Does not compare to column AJ |
| `scripts/verify-images.js` | Smoke-test 3 hardcoded URLs | Not tied to sheet |
| `scripts/raw-images-sheet.csv` | pid + Image URL (+ names in some rows) | Good input for validation |
| `scripts/oct-7th-db-sheet.csv` | Full DB snapshot | Column AJ often `#N/A` in local copy |
| `scripts/new-images-sheet.csv` | pid, names, הנצחה, NLI | Subset for new image pipeline |
| `scripts/upload-*-to-cloudinary.js` | Upload with pid as public_id | Manual entry lists |

## Data URLs (live app)

From `src/lib/data.ts`:

- Map Locations CSV: `gid=0`
- Oct_7th_DB CSV: `gid=1`
- Parser expects AJ at index 35 (`imageUrl`).

Validation should prefer the same published CSV or a fresh export saved under `scripts/` for reproducible runs.

## Implementation sketch for `scripts/validate-images.js`

```text
1. Load rows (pid, name, memorial URL, image URL) from CSV or live publish URL
2. structuralChecks(rows) → issues[]
3. For each row with memorial URL (and optional --skip-ok):
     expected = await resolveFromMemorial(memorialUrl, idfCache)
     actual   = normalizeUrl(row.imageUrl)
     if expected.url !== actual && hash(expected) !== hash(actual):
       issues.push({ type: 'MISMATCH', pid, expected, actual })
4. Write scripts/validation-report.csv + console summary
5. Exit code 1 if any MISMATCH / DUPLICATE / SWAP_PAIR
```

**Normalization helpers to add:**

- Strip Cloudinary `image/fetch/.../` wrapper to inner URL
- Extract `pid_NNN` from upload path
- Extract police `042181` / nofel `42181` for cross-check

**Hash comparison:**

- SHA-256 on downloaded image bytes (exact match)
- Optional: perceptual hash if sources apply different crops (Cloudinary face crop vs raw memorial)

## Edge cases

| Source | Notes |
|--------|--------|
| IDF | Often Incapsula-blocked; use `idf-image-cache.json` or headless `build-idf-image-cache.js` |
| Shabak | Manual upload via `scripts/memorial-images/{pid}.jpg` |
| NLI | Fallback when memorial fails; needs `NLI_API_KEY` for search API |
| BTL / Police / izkor | Generally scrapable; police gallery ID should match nofel ID |

## Suggested next steps (for new chat)

1. Create `scripts/validate-images.js` with Layer 1 structural checks first; run on `raw-images-sheet.csv`.
2. Confirm 737 / 1477 are flagged as `MISMATCH` (pid in URL).
3. Add Layer 2: import or require logic from `fetch-new-images.js` (refactor shared `resolveFromMemorial` into `scripts/lib/image-resolve.js` if needed).
4. Run full validation; write `scripts/validation-report.csv`.
5. Optionally add `docs/validation-review.html` generated from report for manual pass on failures only.

## Open questions

- Which CSV is canonical for validation: live publish, `raw-images-sheet.csv`, or full `Oct_7th_DB` export?
- Should CI run Layer 1 on every sheet export commit?
- Compare URL only vs always hash bytes (slower but catches content swaps with correct URLs)?

## Related conversation points

- JSON export from Google Apps Script was discussed as a cleaner `{ pid, imageUrl }` API than parsing CSV by column index; validation is complementary—not a replacement.
- Column AJ was confirmed as the correct image column after earlier confusion.
