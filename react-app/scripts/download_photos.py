# Downloads the 150x195 face-cropped victim photos listed in public/detail.json (via the same Cloudinary fetch URLs)
# into public/photos/<fnv-hash>.jpg. The hash must match hid() in src/Detail.tsx. Run from react-app/.
import json,os,urllib.request,concurrent.futures as cf
d=json.load(open('public/detail.json'));pre=d['photoPrefix']
us=sorted({p['u'] for v in d['byLoc'].values() for p in v if p.get('u')})
def fnv(s,h):
    for c in s: h^=ord(c); h=(h*16777619)&0xffffffff
    return h
def hid(u): return '%08x%08x'%(fnv(u,2166136261),fnv(u,0x9747b28c))
os.makedirs('public/photos',exist_ok=True)
def get(u):
    f='public/photos/%s.jpg'%hid(u)
    if os.path.exists(f): return 1
    cu=u[1:] if u.startswith('!') else pre+u
    for _ in range(3):
        try:
            b=urllib.request.urlopen(urllib.request.Request(cu,headers={'User-Agent':'Mozilla/5.0'}),timeout=20).read()
            if len(b)>500: open(f,'wb').write(b);return 1
        except Exception: pass
    return 0
with cf.ThreadPoolExecutor(8) as ex: print(sum(ex.map(get,us)),'of',len(us))
