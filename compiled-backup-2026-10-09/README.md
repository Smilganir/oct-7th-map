# Compiled backup of the live Oct-7 map, 2026-10-09

This folder is a verbatim snapshot of every compiled file the live page https://smilganir.github.io/oct-7th-map/ loads. It was taken on 2026-10-09 (Asia/Jerusalem) while main was at e467b5a.

**react-app/src does NOT reflect the live site.** The last source commit is 973519e (2026-10-06 13:09). A build of it differs from the live site. Do not rebuild and deploy from it until the source has been brought back in line.

## What the live page loads, and where each file came from

| Live URL | Snapshot file | Origin |
|---|---|---|
| ./groups-live.js (repo root) | groups-live.js | Built bundle of 2026-10-06 evening with hand edits of 2026-10-07 and 08 written directly into it (regroupDetail, Erez/MASA/Zikim/Mivtahim groups and labels, Nova/Psyduck marker size and frame, event note, Hebrew singular forms, aria labels). First committed in 0b9f1a3 (2026-10-07), last changed in e467b5a (2026-10-08). The version in the repo root is the live one. |
| worker /assets/index-Ds_8uBXu.css | assets/index-Ds_8uBXu.css | Stylesheet of the 2026-10-06 evening build, served by the Cloudflare worker (oct7-map-assets.smilganir.workers.dev). Not changed by the later hand edits. |
| worker /assets/index-vrbANcj3.js | assets/index-vrbANcj3.js | The base JS bundle of that same build. The live page no longer loads it, but groups-live.js is this file plus the hand edits above. Kept so the edits can be diffed. Referenced from index.html since 0f3ae7d (2026-10-06 20:18). |
| worker /detail.json, /he.json, /suppress.json, /credits.json | same names | Data files fetched at runtime. detail.json and he.json are read-only copies as of 2026-10-09. The live ones stay on the worker. |
| worker /assets/*.png, *.svg, *.webp, *.ttf | assets/ | Images and font used by the page: relief.webp, logo.png, legend.png, nova.png, psyduck.png, ynet-head.svg, ynet-logo.svg, ynet-bg.svg, MosesText_Inter-VF.ttf. |
| ./index.html | index.html.live-2026-10-09 | The page at the time of the snapshot. |

Not copied: the victim photos under worker /photos/ (they are already in the repo at photos/ on main).

## Where the source stands
- The build for 2026-10-05 (index-BFyKSXh9) is reproducible from branch ynet-mid-preview. It is already in assets/ on main.
- The evening-of-2026-10-06 build (header for ynet, white page background, legend circles, photo source line, 740 layout, footer lines) was shipped through the cf-site branch and its source was never committed. About 54 CSS rules and some JS exist only in the compiled files here.
- Rebuild instructions: react-app/README.md. It needs two public, referrer-restricted client keys at build time: VITE_ARC_KEY and VITE_MAPBOX_TOKEN.

## Integrity
SHA-256 of every file in this folder is in SHA256SUMS.txt.
