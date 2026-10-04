#!/usr/bin/env bash
# Rebuild data.json + image assets from Nir's public Tableau workbook (frozen snapshot, rev 6.5).
set -euo pipefail
cd "$(dirname "$0")/.."
W=$(mktemp -d)
curl -sL -o "$W/wb.zip" "https://public.tableau.com/workbooks/Oct-7th_Otef.twb"
unzip -q "$W/wb.zip" -d "$W"
pip install --quiet tableauhyperapi pillow
python3 scripts/build_data.py "$W"/Data/Extracts/*.hyper src/data.json
python3 - "$W" <<'PY'
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
W=sys.argv[1]
im=Image.open(f'{W}/Image/new_map12.png').convert('RGB')
im.resize((4096,int(4096*im.height/im.width)),Image.LANCZOS).save('public/assets/relief.webp',quality=82,method=6)
import shutil
shutil.copy(f'{W}/Image/Frame 2095585935 (1).png','public/assets/legend.png')
shutil.copy(f'{W}/Image/WhatsApp Image 2026-02-07 at 17.41.41.png','public/assets/logo.png')
lg=Image.open('public/assets/legend.png')
for n,(cx,cy) in {'nova':(273,763),'psyduck':(273,1084)}.items():
    lg.crop((cx-105,cy-105,cx+105,cy+105)).resize((105,105),Image.LANCZOS).save(f'public/assets/{n}.png')
PY
