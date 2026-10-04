import { useEffect, useMemo, useRef, useState } from 'react'
import Detail from './Detail'
import Sources from './Sources'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AgeBars, Donut } from './charts'
import { fmt, locations, stats, victims } from './stats'

// Image (Tableau "mapped image") bounds, taken from the workbook: left 34.2, right 34.9, bottom 31.15, top 31.75.
const L = 34.2, R = 34.9, B = 31.15, T = 31.75
const IMG_W = 11334, IMG_H = 5906
const VH = 2, VW = (VH * IMG_W) / IMG_H // virtual degrees (image keeps its native aspect, like Tableau)
const vx = (lon: number) => ((lon - L) / (R - L)) * VW
// Tableau draws the image ~2.6% flatter than its native aspect (measured from 17 dots, rms 2 px); keep that.
const YS = 0.97396
const vy = (lat: number) => (VH / 2 - ((T - lat) / (T - B)) * VH) * YS
// Initial view = what the Tableau dashboard shows by default.
const VIEW = { w: vx(34.24572), e: vx(34.68362), s: vy(31.17538), n: vy(31.69728) }
const DASH_W = 1400

const RED = 'radial-gradient(circle at 35% 30%, #ff6b5e 0%, #e01010 45%, #8f0000 100%)'
const SIDE: Record<string, 'left' | 'top' | 'bottom'> = { 'Kibbutz Nahal Oz': 'bottom', "Re'im": 'top', 'Gama jct': 'bottom', Kisufim: 'left', 'Kisufim Base': 'top', 'Nir Am': 'left', Nirim: 'left', Sufa: 'left' }
const diameter = (n: number) => 6 + 2.4 * Math.sqrt(n)

export default function App() {
  const wrap = useRef<HTMLDivElement>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [showSrc, setShowSrc] = useState(false)
  const [det, setDet] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [mobile, setMobile] = useState(false)
  const all = useMemo(() => stats(victims), [])
  const one = useMemo(() => (sel ? stats(victims.filter(v => v.l === sel)) : null), [sel])
  const s = one ?? all

  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() => { const w = el.clientWidth; setMobile(w < 760); setScale(w < 760 ? w / 700 : w / DASH_W) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current!,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }] },
      bounds: [[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], fitBoundsOptions: { padding: 0 },
      maxBounds: [[0, (-VH / 2) * YS], [VW, (VH / 2) * YS]], renderWorldCopies: false, attributionControl: false,
      dragRotate: false, touchPitch: false, fadeDuration: 0, pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.on('load', () => {
      map.addSource('relief', { type: 'image', url: `${import.meta.env.BASE_URL}assets/relief.webp`, coordinates: [[0, (VH / 2) * YS], [VW, (VH / 2) * YS], [VW, (-VH / 2) * YS], [0, (-VH / 2) * YS]] })
      map.addLayer({ id: 'relief', type: 'raster', source: 'relief', paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } })
    })
    mapRef.current = map
    let lastW = 0
    const ro = new ResizeObserver(() => { map.resize(); const w = mapEl.current!.clientWidth; if (w !== lastW) { lastW = w; map.fitBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0, duration: 0 }) } })
    ro.observe(mapEl.current!)
    return () => { ro.disconnect(); map.remove() }
  }, [])

  const markers = useRef<maplibregl.Marker[]>([])
  useEffect(() => {
    const map = mapRef.current!
    markers.current.forEach(m => m.remove()); markers.current = []
    for (const loc of locations) {
      const d = diameter(loc.count) * scale
      const el = document.createElement('div')
      el.className = 'mk'
      const dot = document.createElement('div')
      dot.className = 'dot'
      dot.style.width = dot.style.height = `${d}px`
      if (loc.shape === 'Base') { dot.style.border = `${Math.max(2, 3 * scale)}px solid #0a32d6`; dot.style.background = 'rgba(255,255,255,0.15)'; dot.style.borderRadius = '50%' }
      else if (loc.shape === 'Nova' || loc.shape === 'Psyduck') { dot.style.width = dot.style.height = `${30 * scale + 4}px`; dot.style.backgroundImage = `url(${import.meta.env.BASE_URL}assets/${loc.shape.toLowerCase()}.png)`; dot.style.backgroundSize = 'cover'; dot.style.borderRadius = '50%' }
      else if (loc.shape === 'Rest') { dot.style.background = 'radial-gradient(circle, #ff5a4a 0%, rgba(255,60,50,.55) 55%, rgba(255,60,50,.15) 100%)'; dot.style.borderRadius = '50%' }
      else { dot.style.background = RED; dot.style.borderRadius = '50%'; dot.style.boxShadow = '0 1px 2px rgba(0,0,0,.35)' }
      const label = document.createElement('span')
      label.className = 'lb'
      label.textContent = loc.name === '?' ? 'Scattered locations' : loc.name
      label.style.fontSize = `${Math.max(9, 11.5 * scale)}px`
      const side = SIDE[loc.name]
      if (side) el.classList.add('side-' + side)
      el.append(dot, label)
      el.title = `${label.textContent}: ${loc.count}`
      el.addEventListener('click', e => { e.stopPropagation(); setSel(loc.name) })
      el.dataset.name = loc.name
      const anchor = side === 'left' ? 'right' : side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : 'left'
      const offset: [number, number] = side === 'left' ? [d / 2, 0] : side === 'top' ? [0, d / 2] : side === 'bottom' ? [0, -d / 2] : [-d / 2, 0]
      markers.current.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([vx(loc.lon), vy(loc.lat)]).addTo(map))
    }
  }, [scale, mobile])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const loc = locations.find(l => l.name === sel)
    if (loc) {
      const base = map.cameraForBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0 })?.zoom ?? 0
      map.flyTo({ center: [vx(loc.lon), vy(loc.lat)], zoom: base + 1.7, duration: 900, essential: true })
    } else {
      map.fitBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0, duration: 700 })
    }
  }, [sel])

  const pct = (n: number, t: number) => Math.round((n / (t || 1)) * 100)
  return (
    <div className="viewport">
      <div className={`dash${mobile ? ' mobile' : ''}`} ref={wrap} style={{ ['--u' as string]: `${mobile ? scale * 0.62 : scale}px` }}>
        <header className="head">
          <h1>Oct-7th Hamas Massacre in Gaza Envelope</h1>
          <p className="tot"><span className="lead">Total {fmt(all.fatalities)} Fatalities, Total {fmt(all.hostages)} hostages:</span> <b className="c1">{fmt(all.killed)}</b> <small className="c1">({fmt(all.killedCiv)} civilians)</small> killed, <b className="c2">{fmt(all.hk)}</b> <small className="c2">({fmt(all.hkCiv)} civilians)</small> kidnapped and killed or killed and kidnapped</p>
          <p className="add">Additional <b className="c3">{fmt(all.ret)}</b> <small className="c3">({fmt(all.retCiv)} civilians)</small> kidnapped and returned alive</p>
          <div className="notes"><i>*&nbsp; Numbers refer to victims of events occurring between October 7–9, 2023, including individuals injured during the attacks and subsequently died.<br />&nbsp;&nbsp;&nbsp; The majority of the victims were murdered within a few hours of the attack.</i><br /><i>** An additional 22 (including 4 females) individuals were killed outside the Gaza Envelope; their locations are therefore not reflected on this map.</i></div>
          <img className="logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="The Civil Commission on Oct 7th crimes by Hamas against women and children" />
        </header>
        <div className="mapzone" ref={mapEl} onClick={() => setSel(null)} />
        <img className="legend" src={`${import.meta.env.BASE_URL}assets/legend.png?v=3`} alt="" />
        <div className="sizeleg"><span>{'# of victims'}<br />per location</span>
          <svg viewBox="0 0 60 50">{[200, 100, 50, 5].map(n => { const r = diameter(n) / 2 / 1.1833; const y = 44 - 2 * r; return <g key={n}><circle cx="22" cy={44 - r} r={r} fill="none" stroke="#222" strokeWidth=".8" /><line x1="22" y1={y} x2="44" y2={y} stroke="#222" strokeWidth=".4" /><text x="46" y={y + 1.7} fontSize="5">{n}</text></g> })}</svg></div>
        <div className="hint">Click on the map locations to zoom in</div>
        <section className="card c-civ"><h2>Civilian Victims Distribution</h2>
          <div className="dn"><Donut a={s.civilians} b={s.security} /><span className="l tl">Security Forces on Duty<br /><b>{fmt(s.security)}</b> ({pct(s.security, s.total)}%)</span><span className="l br">Civilians<br /><b>{fmt(s.civilians)}</b> ({pct(s.civilians, s.total)}%)</span></div></section>
        <section className="card c-gen"><h2>Victims&apos; Gender <small>(including hostages)</small></h2>
          <div className="dn"><Donut a={s.female} b={s.male} /><span className="l tr">Female<br /><b>{fmt(s.female)}</b></span><span className="l bl">Male<br /><b>{fmt(s.male)}</b></span></div></section>
        <section className="card c-age"><h2>Victims&apos; Age Distribution</h2><small className="sub">*excluding {s.noAge} victims with no age data</small><AgeBars ages={s.ages} /></section>
        <footer className="foot"><b>Data:</b> <a href="https://oct7database.com/" target="_blank" rel="noreferrer">https://oct7database.com/</a><br /><i><b>Disclaimer:</b> All data is accurate to the best of our knowledge at the time of publication</i><br /><a className="srcl" onClick={() => setShowSrc(true)}><b>Sources &amp; policy</b></a><br /><br /><b>Design:</b> Nir Smilga<br />Based on &apos;Return to October&apos; exhibition at the Israel Heritage &amp; Commemoration Center (IICC)</footer>
        {sel && (<aside className="panel" onClick={e => e.stopPropagation()}><button onClick={() => setSel(null)} aria-label="Close">×</button><h3>{sel === '?' ? 'Scattered locations' : sel}</h3><p><b>{fmt(s.total)}</b> victims · {fmt(s.killed)} killed · {fmt(s.hk)} kidnapped and killed · {fmt(s.ret)} returned alive</p><p><button className="vbtn" onClick={() => setDet(sel)}>View victims</button></p><p>Civilians {fmt(s.civilians)} · Security forces {fmt(s.security)} · Female {fmt(s.female)} · Male {fmt(s.male)}</p></aside>)}
        {showSrc && <Sources onClose={() => setShowSrc(false)} />}
        {det && <Detail name={det} onBack={() => setDet(null)} />}
      </div>
    </div>
  )
}
