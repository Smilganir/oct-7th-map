import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { HE_NAMES, S, type Lang } from './i18n'

type P = { n: string; a: number | null; k: 'k' | 'h' | 'a'; u: string; y: number | null; x: number | null }
type D = { photoPrefix: string; byLoc: Record<string, P[]> }
const COL = { k: '#b01212', h: '#4a1a54', a: '#3a9a9a' }
let cache: Promise<D> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}detail.json`).then(r => r.json()))
let hc: Promise<Record<string, [string, string]>> | null = null
const loadHe = () => (hc ??= fetch(`${import.meta.env.BASE_URL}he.json`).then(r => r.json()).catch(() => ({})))
const photo = (d: D, u: string) => (!u ? '' : u.startsWith('!') ? u.slice(1) : d.photoPrefix + u)

export default function Detail({ name, onBack, lang }: { name: string; onBack: () => void; lang: Lang }) {
  const t = S[lang], rtl = lang === 'he'
  const nm = rtl ? HE_NAMES[name] ?? name : name === '?' ? 'Scattered locations' : name
  const [d, setD] = useState<D | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const [he, setHe] = useState<Record<string, [string, string]>>({})
  useEffect(() => { load().then(setD); loadHe().then(setHe) }, [])
  const list = d?.byLoc[name] ?? []
  useEffect(() => {
    if (!d || !el.current) return
    const pts = list.filter(p => p.y != null && p.x != null)
    const map = new maplibregl.Map({
      container: el.current, attributionControl: { compact: false },
      style: { version: 8, sources: { img: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Source: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community | Powered by Esri', tiles: [(import.meta.env.VITE_ALLOW_FBTEST && new URLSearchParams(location.search).has('fbtest')) ? 'https://esri-fail.invalid/{z}/{y}/{x}' : 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + import.meta.env.VITE_ARC_KEY] } }, layers: [{ id: 'img', type: 'raster', source: 'img', paint: { 'raster-saturation': -1, 'raster-contrast': -0.25, 'raster-brightness-min': 0.3, 'raster-brightness-max': 1 } }] },
      center: [34.5, 31.4], zoom: 12,
    })
    const addPts = () => {
      if (map.getLayer('p')) return
      if (map.getSource('p')) map.removeSource('p')
      map.addSource('p', { type: 'geojson', data: { type: 'FeatureCollection', features: pts.map(p => ({ type: 'Feature', properties: { k: p.k }, geometry: { type: 'Point', coordinates: [p.x!, p.y!] } })) } })
      map.addLayer({ id: 'p', type: 'circle', source: 'p', paint: { 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-color': ['match', ['get', 'k'], 'k', COL.k, 'h', COL.h, COL.a] } })
    }
    const fit = () => {
      if (!pts.length) return
      const b = new maplibregl.LngLatBounds()
      pts.forEach(p => b.extend([p.x!, p.y!]))
      map.fitBounds(b, { padding: 60, maxZoom: 16.5, duration: 0 })
    }
    const MB = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
    const rs = (tiles: string, attribution: string, paint: any, maxzoom = 19): any => ({ version: 8, sources: { img: { type: 'raster', tileSize: 256, maxzoom, attribution, tiles: [tiles] } }, layers: [{ id: 'img', type: 'raster', source: 'img', paint }] })
    const stages: any[] = []
    if (MB) stages.push(rs('https://api.mapbox.com/styles/v1/smilganir/cmm698oih004t01s49c9f5pxb/tiles/256/{z}/{x}/{y}@2x?access_token=' + MB, '© Mapbox © OpenStreetMap', {}, 22))
    stages.push(rs((import.meta.env.VITE_ALLOW_FBTEST && new URLSearchParams(location.search).has('fbtest3')) ? 'https://osm-fail.invalid/{z}/{x}/{y}' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap contributors', { 'raster-saturation': -1, 'raster-contrast': -0.1 }, 19))
    let stage = -1, errs = 0
    const advance = () => {
      if (stage >= stages.length - 1) return
      stage++; errs = 0
      map.setStyle(stages[stage]); let n = 0
      const t = setInterval(() => { if (map.isStyleLoaded() && !map.getLayer('p')) { addPts(); fit() } if (map.getLayer('p') || ++n > 40) clearInterval(t) }, 250)
    }
    map.on('error', (e: any) => {
      if (e?.sourceId !== 'img') return
      if (++errs >= 4) advance()
    })
    const fell = false
    map.on('load', () => { addPts(); if (!fell) fit() })
    return () => map.remove()
  }, [d, name])
  const c = { k: 0, h: 0, a: 0 }
  list.forEach(p => c[p.k]++)
  const half = Math.ceil(list.length / 2)
  const hk = (p: P) => he[p.n + '|' + (p.a ?? '')]
  const card = (p: P, i: number) => (
    <div className="vc" key={i}>
      {d && p.u ? <img src={photo(d, p.u)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <span className="ph" />}
      <div className="cap"><span className="vn">{(rtl && hk(p)?.[0]) || p.n}{p.a != null && <><br />({p.a})</>}</span><span className="ic"><i style={{ background: COL[p.k] }} />{hk(p)?.[1] && <a className="ml" href={hk(p)[1]} target="_blank" rel="noopener noreferrer" title={rtl ? 'אתר ההנצחה' : 'Memorial page'} aria-label="memorial page" onClick={e => e.stopPropagation()}><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></a>}</span></div>
    </div>
  )
  return (
    <div className="detail" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="dh">
        <div><h2><b>{nm}</b> {rtl ? t.vicinity : 'Vicinity'} <b>{list.length} {t.vic}</b></h2>
          <p><b style={{ color: COL.k }}>{c.k}</b> {rtl ? t.dK : 'killed'} | <b style={{ color: COL.h }}>{c.h}</b> {rtl ? t.ttHK : 'kidnapped and killed'} | <b style={{ color: COL.a }}>{c.a}</b> {rtl ? t.ttR : 'kidnapped and returned alive'}</p>
          <p className="subd"><i>{t.schem}</i></p></div>
        <button onClick={onBack}>{t.back}</button>
      </div>
      <p className="subm"><i>{t.schem}</i></p>
      <div className="db">
        <div className="col">{list.slice(0, half).map(card)}</div>
        <div className="dm"><div ref={el} className="dmap" />
          <div className="dl"><span><i style={{ background: COL.h }} />{t.dKK}</span><span><i style={{ background: COL.a }} />{t.dKA}</span><span><i style={{ background: COL.k }} />{t.dK}</span></div></div>
        <div className="col">{list.slice(half).map((p, i) => card(p, i + half))}</div>
      </div>
    </div>
  )
}
