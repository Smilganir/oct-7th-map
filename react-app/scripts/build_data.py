"""Freeze the Tableau Public workbook data (Oct-7th_Otef rev 6.5, extract of 2026-04-22) into an anonymous static JSON.
Usage: python3 scripts/build_data.py <hyper file> <out.json>. No names/photos/URLs are written."""
import sys, json, collections as C
from tableauhyperapi import HyperProcess, Telemetry, Connection
hyper, out = sys.argv[1], sys.argv[2]
SEC = {'חייל': 'IDF', 'שוטר': 'Police', 'שב"כ': 'ISA', 'כבאי': 'FireFighter'}
def kind(s):
    if s == 'killed': return 'killed'
    if s.startswith('kidnapped; released') or s == 'kidnapped; rescued': return 'returned'
    return 'hostage_killed'
with HyperProcess(Telemetry.DO_NOT_SEND_USAGE_DATA_TO_TABLEAU) as h, Connection(h.endpoint, hyper) as c:
    names = {('DB' in str(t)): t for t in c.catalog.get_table_names('Extract')}
    ml = c.execute_list_query(f'select "Location","Visual_Lat (Y)","Visual_Lon (X)","Shape" from {names[False]}')
    db = c.execute_list_query(f'select "Gender","Age","Role","Status","Event date","front","new maub death loc" from {names[True]}')
loc_canon = {r[0].strip().lower(): r[0] for r in ml}
def locname(v): return loc_canon.get((v or '').strip().lower())
victims = []; counts = C.Counter()
for g, age, role, st, d, front, loc in db:
    if not d or str(d) > '2023-10-09':
        if d and str(d) < '2023-10-10': pass
        else: continue
    if str(d) < '2023-10-07': continue
    k = kind(st); ln = locname(loc)
    raw = (loc or '').strip().lower()
    outside = k == 'killed' and (raw == 'other' or front != 'Gaza')
    counts[ln] += 1  # dot size = all rows dated before Oct 10 (matches Tableau 'Killed Sum')
    if outside: continue
    victims.append({'l': ln, 'g': g, 'a': age, 'r': SEC.get(role, 'Civilian' if role == 'אזרח' else {'כיתת כוננות': 'Standby Unit', 'צוות רפואי': 'Medical'}.get(role, 'Civilian')), 'k': k})
for v in victims: v['s'] = v['r'] in ('IDF', 'Police', 'ISA', 'FireFighter')
# NOTE: dot counts include the 22 outside rows' locations only if they carry a map location; Other has no marker.
locs = [{'name': n, 'lat': la, 'lon': lo, 'shape': sh, 'count': counts.get(n, 0)} for n, la, lo, sh in ml if la is not None and lo is not None]
json.dump({'source': 'Tableau Public Oct-7th_Otef rev 6.5 (extract 2026-04-22)', 'locations': locs, 'victims': victims}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(locs), 'locations', len(victims), 'in-scope rows')
