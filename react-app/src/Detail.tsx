import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

type P = { n: string; a: number | null; k: 'k' | 'h' | 'a'; u: string; y: number | null; x: number | null }
type D = { photoPrefix: string; byLoc: Record<string, P[]> }
const COL = { k: '#b01212', h: '#4a1a54', a: '#3a9a9a' }
let cache: Promise<D> | null = null
const load = () => (cache ??= fetch(`${import.meta.env.BASE_URL}detail.json`).then(r => r.json()))
const photo = (d: D, u: string) => (!u ? '' : u.startsWith('!') ? u.slice(1) : d.photoPrefix + u)

export default function Detail({ name, onBack }: { name: string; onBack: () => void }) {
  const [d, setD] = useState<D | null>(null)
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => { load().then(setD) }, [])
  const list = d?.byLoc[name] ?? []
  useEffect(() => {
    if (!d || !el.current) return
    const pts = list.filter(p => p.y != null && p.x != null)
    const map = new maplibregl.Map({
      container: el.current, attributionControl: { compact: false },
      style: { version: 8, sources: { img: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } }, layers: [{ id: 'img', type: 'raster', source: 'img', paint: { 'raster-saturation': -1, 'raster-contrast': 0.1 } }] },
      center: [34.5, 31.4], zoom: 12,
    })
    map.on('load', () => {
      map.addSource('p', { type: 'geojson', data: { type: 'FeatureCollection', features: pts.map(p => ({ type: 'Feature', properties: { k: p.k }, geometry: { type: 'Point', coordinates: [p.x!, p.y!] } })) } })
      map.addLayer({ id: 'p', type: 'circle', source: 'p', paint: { 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-color': ['match', ['get', 'k'], 'k', COL.k, 'h', COL.h, COL.a] } })
      if (pts.length) {
        const b = new maplibregl.LngLatBounds()
        pts.forEach(p => b.extend([p.x!, p.y!]))
        map.fitBounds(b, { padding: 60, maxZoom: 16.5, duration: 0 })
      }
    })
    return () => map.remove()
  }, [d, name])
  const c = { k: 0, h: 0, a: 0 }
  list.forEach(p => c[p.k]++)
  const half = Math.ceil(list.length / 2)
  const card = (p: P, i: number) => (
    <div className="vc" key={i}>
      {d && p.u ? <img src={photo(d, p.u)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <span className="ph" />}
      <span className="vn">{p.n}{p.a != null && <><br />({p.a})</>}</span>
      <i style={{ background: COL[p.k] }} />
    </div>
  )
  return (
    <div className="detail">
      <div className="dh">
        <div><h2><b>{name === '?' ? 'Scattered locations' : name}</b> Vicinity <b>{list.length} victims</b></h2>
          <p><b style={{ color: COL.k }}>{c.k}</b> killed | <b style={{ color: COL.h }}>{c.h}</b> kidnapped and killed | <b style={{ color: COL.a }}>{c.a}</b> kidnapped and returned alive</p>
          <p><i>Victims&apos; locations are schematic and represent approximate event coordinates</i></p></div>
        <button onClick={onBack}>◄ Back to Regional Map</button>
      </div>
      <div className="db">
        <div className="col">{list.slice(0, half).map(card)}</div>
        <div className="dm"><div ref={el} className="dmap" />
          <div className="dl"><span><i style={{ background: COL.h }} />Kidnapped,Killed</span><span><i style={{ background: COL.a }} />Kidnapped,alive</span><span><i style={{ background: COL.k }} />Killed</span></div></div>
        <div className="col">{list.slice(half).map((p, i) => card(p, i + half))}</div>
      </div>
    </div>
  )
}
