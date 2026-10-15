# Decisions and open items

## 2026-10-15: reader-complaint closeout and age-cohort audit

Scope: read-only verification and reply drafts. No public replies or email sent. No map code/data changed.

### Verified current published state

- Erez crossing/kibbutz group remains 13 people. Placement was previously published in abe4b95; no further move requested here.
- Mivtahim Junction is a separate 13-person group; all 13 listed as killed. Existing broader Mivtahim group retains 20. The regrouping is in groups-live.js, not a change to raw detail.json.
- Yated appears as a text note under scattered locations, with the ynet inquiry link. It says there was infiltration and no one killed or abducted within the village. Do not move residents killed elsewhere into Yated.

### Age cohort: correction to prior analysis

- The displayed 20-30 bar means ages 20 through 29, not inclusive age 30.
- Current published cohort: 571 people, including 515 killed, 24 abducted/killed, and 32 returned alive. Use נפגעים, not all נרצחים.
- Matched 571/571 published detail records to current Oct_7th_DB source rows by English/Hebrew name and exact age. Exact English spelling resolves the Yakir Levy / Yakir Levi duplicate Hebrew-name tie.
- Party labels in source column O: Nova 298; Psyduck 7; blank 266. These are source-record labels, not a new biographical audit.
- Mutually exclusive split: party-labelled 305; IDF soldiers 161; other 105. Parties plus IDF: 466/571 = 81.6%.
- Broader security roles total 178, with one Nova-labelled police overlap. Mutually exclusive alternative: party 305; non-party security 177; other 89.
- Prior 125 Nova figure counted the map-location group, not attendance. Do not repeat the earlier ~50% party-plus-soldiers conclusion.

### Open items and limits

- Source sublabel inconsistency: 12 people in the map's Psyduck location group are labelled Nova in source Party. Do not publish a precise Nova-vs-Psyduck split without checking this classification. The combined party count is unaffected by that mismatch.
- Reader's red-mail address remains unknown. The original Oct 7 user message pasted the complaint without an address. Live Gmail search covered the connected smilganir@gmail.com account, including hello@ delivered/forwarded mail and spam/trash, exact complaint phrases and ynet sender searches; no matching message found. No separate hello@ Gmail connection was listed.
- Reply to the red-mail reader needs the original ynet delivery route/address. Do not infer the reader's identity or which victim was their father.
- Public replies require per-item review. Use עדכון, not תיקון, and concede only verified facts.
- Original LinkedIn screenshot/comment not recovered in this pass; proposed reply is grounded in the age question relayed in the conversation, not a new inspection of the LinkedIn thread. Check the live thread before sending.

### Sources

- https://smilganir.github.io/oct-7th-map/?lang=he
- https://smilganir.github.io/oct-7th-map/groups-live.js
- https://oct7-map-assets.smilganir.workers.dev/detail.json
- https://oct7-map-assets.smilganir.workers.dev/he.json
- https://docs.google.com/spreadsheets/d/1Up9yy0YisTzjid47U7jud3Goejg3J5f__szZPtoSm-Q/edit?authuser=smilganir%40gmail.com
- https://www.ynet.co.il/news/article/sjysrsqzze
- https://www.ynet.co.il/news/article/pb1nyqls4
