import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Detail from './Detail'
import Sources from './Sources'
import { track } from './track'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AgeBars, Donut } from './charts'
import { HE_NAMES, S, initLang, type Lang } from './i18n'
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
  const [lang, setLang] = useState<Lang>(initLang)
  const t = S[lang], rtl = lang === 'he'
  const nm = (n: string) => (rtl ? HE_NAMES[n] ?? n : n === '?' ? 'Scattered locations' : n)
  const toggleLang = () => { const n: Lang = rtl ? 'en' : 'he'; track('lang_toggle', { to: n, where: 'header' }); setLang(n); try { localStorage.setItem('o7lang', n) } catch { /* ignore */ } }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const [sel, setSel] = useState<string | null>(null)
  const [showSrc, setShowSrc] = useState(false)
  const [det, setDet] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [dscale0, setDscale] = useState(1)
  const [boost, setBoost] = useState(1)
  const dscale = dscale0 * boost
  const [mobile, setMobile] = useState(false)
  const [mid, setMid] = useState(false)
  const mobileRef = useRef(false)
  const [hideL, setHideL] = useState(false)
  const legRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { const d = wrap.current; const l = legRef.current; if (!d) return; if (!(mobile && l)) { d.style.removeProperty('--lh'); d.style.removeProperty('--lw'); return } const m = () => { d.style.setProperty('--lh', l.offsetHeight + 'px'); d.style.setProperty('--lw', l.offsetWidth + 'px') }; m(); const ro = new ResizeObserver(m); ro.observe(l); return () => ro.disconnect() }, [mobile, hideL, lang, scale])
  const [hideS, setHideS] = useState(false)
  const fitRef = useRef<() => void>(() => {})
  const fitting = useRef(false), baseZ = useRef<number | null>(null), lzRef = useRef<() => void>(() => {})
  const declutterRef = useRef<() => void>(() => {})
  const all = useMemo(() => stats(victims), [])
  const one = useMemo(() => (sel ? stats(victims.filter(v => v.l === sel)) : null), [sel])
  const s = one ?? all

  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() => { const w = el.clientWidth; mobileRef.current = w < 1100; setMobile(w < 1100); setMid(w >= 600 && w < 1100); document.documentElement.style.setProperty('--mk', String(w < 1100 ? Math.max(1, Math.min(1.7, w / 430)) : 1)); document.documentElement.style.setProperty('--mz', String(Math.max(1, Math.min(1.5, w / 740)))); setScale(w < 1100 ? w / 700 : w / DASH_W); setDscale(Math.max(0.45, w < 1100 ? (1300 / DASH_W) * Math.sqrt(w / 1300) : w / DASH_W)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current!,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }] },
      bounds: [[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], fitBoundsOptions: { padding: 0 },
      maxBounds: [[0, (-VH / 2) * YS], [VW, (VH / 2) * YS]], renderWorldCopies: false, attributionControl: false,
      dragRotate: false, touchPitch: false, locale: { 'CooperativeGesturesHandler.MobileHelpText': 'Use two fingers to move the map', 'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + scroll to zoom the map', 'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + scroll to zoom the map' }, fadeDuration: 0, pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.on('load', () => {
      map.addSource('relief', { type: 'image', url: `${import.meta.env.BASE_URL}assets/relief.webp`, coordinates: [[0, (VH / 2) * YS], [VW, (VH / 2) * YS], [VW, (-VH / 2) * YS], [0, (-VH / 2) * YS]] })
      map.addLayer({ id: 'relief', type: 'raster', source: 'relief', paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } })
    })
    mapRef.current = map
    fitRef.current = () => {
      const box = mapEl.current!.getBoundingClientRect()
      fitting.current = true; mapEl.current!.style.setProperty('--lz', '1')
      map.fitBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0, duration: 0 })
      const done = () => { fitting.current = false; baseZ.current = map.getZoom(); lzRef.current() }
      if (!mobileRef.current) { done(); return }
      let pass = 0
      const step = () => {
        declutterRef.current()
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        const ext = (r: DOMRect) => { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom) }
        markers.current.forEach(m => {
          const el = m.getElement(); ext(el.querySelector('.dot')!.getBoundingClientRect())
          if (!el.classList.contains('lbh')) ext((el.querySelector('.lb') as HTMLElement).getBoundingClientRect())
        })
        if (x1 < x0) { done(); return }
        const M = 5
        const k = Math.min((box.width - 2 * M) / (x1 - x0), (box.height - 2 * M) / (y1 - y0))
        if (Math.abs(k - 1) < 0.01 || k < 0.6 || k > 3) { done(); return }
        const c = map.unproject([(x0 + x1) / 2 - box.left, (y0 + y1) / 2 - box.top])
        map.jumpTo({ zoom: map.getZoom() + Math.log2(k), center: c })
        if (++pass < 5) requestAnimationFrame(() => requestAnimationFrame(step)); else done()
      }
      requestAnimationFrame(() => requestAnimationFrame(step))
    }
    let lastW = 0
    const ro = new ResizeObserver(() => { map.resize(); const w = mapEl.current!.clientWidth; if (w !== lastW) { lastW = w; fitRef.current() } })
    ro.observe(mapEl.current!)
    return () => { ro.disconnect(); map.remove() }
  }, [])

  useEffect(() => {
    const map = mapRef.current!
    map.cooperativeGestures.disable() // mobile: one-finger pan, two-finger zoom; page scrolls from the strip below the map
  }, [mobile])

  const tipRef = useRef<HTMLDivElement | null>(null)
  const placeTip = useCallback(() => {
    const map = mapRef.current, tip = tipRef.current, host = mapEl.current
    if (!map || !tip || !host || !sel) return
    const loc = locations.find(l => l.name === sel); if (!loc) return
    const p = map.project([vx(loc.lon), vy(loc.lat)])
    const W = host.clientWidth, H = host.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight
    const r = (diameter(loc.count) * dscale) / 2 + 4
    let x = p.x + r; if (x + tw > W - 2) x = p.x - r - tw; x = Math.max(2, Math.min(x, W - tw - 2))
    let y = p.y - th / 2; y = Math.max(2, Math.min(y, H - th - 2))
    tip.style.left = `${host.offsetLeft + x}px`; tip.style.top = `${host.offsetTop + y}px`
  }, [sel, dscale])
  useEffect(() => {
    const map = mapRef.current; if (!map || !sel) return
    placeTip(); map.on('move', placeTip); map.on('moveend', placeTip)
    return () => { map.off('move', placeTip); map.off('moveend', placeTip) }
  }, [sel, placeTip, mobile])

  useEffect(() => {
    setBoost(1); return
    const t = setTimeout(() => {
      const map = mapRef.current; if (!map) return
      const base = dscale0
      const pts = locations.filter(l => !l.shape || l.shape === 'Circle' || l.shape === 'Rest' || (l.shape !== 'Base' && l.shape !== 'Nova' && l.shape !== 'Psyduck')).map(l => { const p = map.project([vx(l.lon), vy(l.lat)]); return { x: p.x, y: p.y, d: diameter(l.count) * base } })
      const rs: number[] = []
      for (let a = 0; a < pts.length; a++) { let m = Infinity; for (let b = 0; b < pts.length; b++) if (a !== b) { const dist = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); m = Math.min(m, dist / ((pts[a].d + pts[b].d) / 2)) } rs.push(m) }
      rs.sort((x, y) => x - y)
      const f = rs.length ? rs[Math.floor(rs.length * 0.12)] : 1
      const W = mapEl.current?.clientWidth ?? 600
      const maxD = Math.max(...pts.map(p => p.d)) || 1
      const cap = Math.max(1, (1300 / DASH_W) / base)
      void maxD
      setBoost(Math.max(1, Math.min(cap, f * 0.97)))
    }, 700)
    return () => clearTimeout(t)
  }, [dscale0, mobile, mid, lang])

  const markers = useRef<maplibregl.Marker[]>([])
  useEffect(() => {
    const map = mapRef.current!
    markers.current.forEach(m => m.remove()); markers.current = []
    for (const loc of locations) {
      const d = diameter(loc.count) * dscale
      const el = document.createElement('div')
      el.className = 'mk'
      const dot = document.createElement('div')
      dot.className = 'dot'
      dot.style.width = dot.style.height = `${d}px`
      if (loc.shape === 'Base') { dot.style.border = `${Math.max(2, 3 * dscale)}px solid #0a32d6`; dot.style.background = 'rgba(255,255,255,0.15)'; dot.style.borderRadius = '50%' }
      else if (loc.shape === 'Nova' || loc.shape === 'Psyduck') { dot.style.width = dot.style.height = `${30 * dscale + 4}px`; dot.style.backgroundImage = `url(${import.meta.env.BASE_URL}assets/${loc.shape.toLowerCase()}.png)`; dot.style.backgroundSize = 'cover'; dot.style.borderRadius = '50%' }
      else if (loc.shape === 'Rest') { dot.style.background = 'radial-gradient(circle, #ff5a4a 0%, rgba(255,60,50,.55) 55%, rgba(255,60,50,.15) 100%)'; dot.style.borderRadius = '50%' }
      else { dot.style.background = RED; dot.style.borderRadius = '50%'; dot.style.boxShadow = '0 1px 2px rgba(0,0,0,.35)' }
      const label = document.createElement('span')
      label.className = 'lb'
      label.textContent = nm(loc.name)
      label.style.fontSize = mobile ? `calc(${Math.max(9, 11.5 * scale)}px * var(--lz, 1))` : `${Math.max(9, 11.5 * scale)}px`
      const side = SIDE[loc.name]
      if (side) el.classList.add('side-' + side)
      el.append(dot, label)
      el.title = `${label.textContent}: ${loc.count}`
      el.addEventListener('click', e => { e.stopPropagation(); track('settlement_select', { settlement: loc.name, lang: document.documentElement.lang }); setSel(loc.name) })
      el.dataset.name = loc.name
      const anchor = side === 'left' ? 'right' : side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : 'left'
      const offset: [number, number] = side === 'left' ? [d / 2, 0] : side === 'top' ? [0, d / 2] : side === 'bottom' ? [0, -d / 2] : [-d / 2, 0]
      markers.current.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([vx(loc.lon), vy(loc.lat)]).addTo(map))
    }
  if (mobile) fitRef.current()
    const declutter = () => {
      const items = markers.current.map((m, i) => ({ el: m.getElement(), n: locations[i].count, nm: locations[i].name }))
      items.forEach(it => it.el.classList.remove('lbh'))
      const placed: DOMRect[] = []
      for (const it of [...items].sort((x, y) => y.n - x.n)) {
        const lb = it.el.querySelector('.lb') as HTMLElement | null
        if (!lb) continue
        const r = lb.getBoundingClientRect()
        const pad = 1
        const hit = placed.some(p => r.left < p.right + pad && r.right > p.left - pad && r.top < p.bottom + pad && r.bottom > p.top - pad)
        if (hit) it.el.classList.add('lbh'); else placed.push(r)
      }
    }
    declutterRef.current = declutter
    let raf = 0
    const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(declutter) }
    const lz = () => { const dz = fitting.current || baseZ.current === null ? 0 : Math.max(0, map.getZoom() - baseZ.current); mapEl.current?.style.setProperty('--lz', mobile ? String(Math.min(2.2, 1 + 0.6 * dz)) : '1') }
    lzRef.current = lz; map.on('zoom', lz); lz()
    map.on('zoom', sched); map.on('moveend', sched); map.on('resize', sched)
    sched()
    return () => { map.off('zoom', lz); map.off('zoom', sched); map.off('moveend', sched); map.off('resize', sched); cancelAnimationFrame(raf) }
  }, [scale, dscale, mobile, lang])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const loc = locations.find(l => l.name === sel)
    if (loc) {
      const base = map.cameraForBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0 })?.zoom ?? 0
      map.flyTo({ center: [vx(loc.lon), vy(loc.lat)], zoom: base + 1.7, duration: 900, essential: true })
    } else if (mobile) {
      fitRef.current()
    } else {
      map.fitBounds([[VIEW.w, VIEW.s], [VIEW.e, VIEW.n]], { padding: 0, duration: 700 })
    }
  }, [sel]) // eslint-disable-line

  const pct = (n: number, t: number) => Math.round((n / (t || 1)) * 100)
  return (
    <div className="viewport">
      <div className={`dash${mobile ? ' mobile' : ''}${mid ? ' mid' : ''}${rtl ? ' he' : ''}`} ref={wrap} style={{ ['--u' as string]: `${mobile ? scale * 0.62 : scale}px` }}>
        <header className="head" dir={rtl ? 'rtl' : 'ltr'}>
          <h1>{t.title}</h1>
          <div className="totwrap"><p className="tot"><span className="lead">{t.tot1} {fmt(all.fatalities)} {t.fat}, {t.tot1} {fmt(all.hostages)} {t.hostages}:</span> <b className="c1">{fmt(all.killed)}</b> <small className="c1">({fmt(all.killedCiv)} {t.civ})</small> {t.killed}, <b className="c2">{fmt(all.hk)}</b> <small className="c2">({fmt(all.hkCiv)} {t.civ})</small> {t.hk}<span className="mp">.</span></p>{' '}
          <p className="add">{t.additional} <b className="c3">{fmt(all.ret)}</b> <small className="c3">({fmt(all.retCiv)} {t.civ})</small> {t.ret}</p></div>
          <div className="notes"><div className="fn"><i className="mk">*</i><i>{t.fn1}<br />{t.fn1b}</i></div><div className="fn"><i className="mk">**</i><i>{t.fn2}</i></div></div>
          <a href={rtl ? 'https://www.civilc.org/home-heb/silenced-no-more-heb' : 'https://www.civilc.org/silenced-no-more'} target="_blank" rel="noopener noreferrer" aria-label="The Civil Commission report" className="logol" onClick={() => track('outbound_click', { target: 'civil_commission', lang })}><img className="logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="The Civil Commission on Oct 7th crimes by Hamas against women and children" /></a>
          <button className="langb" onClick={toggleLang} aria-label="Language">{t.toggle}</button>
        </header>
        <div className="mapwrap"><div className="mapzone" ref={mapEl} onClick={() => setSel(null)} />
        {!(mobile && hideL) && (rtl ? <div className="legend hel" dir="rtl" ref={legRef}>{[<i key="a" className="ib" />, <i key="b" className="ic" />, <img key="c" src={`${import.meta.env.BASE_URL}assets/nova.png`} alt="" />, <img key="d" src={`${import.meta.env.BASE_URL}assets/psyduck.png`} alt="" />, <i key="e" className="ia">←</i>, <i key="f" className="id" />, <i key="g" className="ig" />].map((ic, k) => <div key={k} className="lr"><span className="li">{ic}</span><span>{t.leg[k]}</span></div>)}</div> : <img className="legend" ref={legRef as React.RefObject<HTMLImageElement>} src={`${import.meta.env.BASE_URL}assets/legend.png?v=3`} alt="" />)}
        {mobile && !hideL && <button className="lx lx1" aria-label={t.hideLeg} onClick={() => { setHideL(true); setHideS(true) }}><svg viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg></button>}
        {mobile && (hideL || hideS) && <button className="lx lx3" aria-label="Show legend" onClick={() => { setHideL(false); setHideS(false) }}>{t.legendBtn}</button>}
        {!(mobile && hideS) && <div className="sizeleg" dir={rtl ? 'rtl' : 'ltr'}><span>{t.sizeLeg1}<br />{t.sizeLeg2}</span>
          {(() => { const f = (n: number) => diameter(n) * dscale / 2; const R = f(200), fs = 9, gap = 10.5, ns = [200, 100, 50, 5]; const tys = ns.map(n => 2 * R + 1.5 - 2 * f(n)); const ly: number[] = []; tys.forEach((y, k) => ly.push(k ? Math.max(y, ly[k - 1] + gap) : Math.max(y, fs * 0.7))); const H = Math.max(2 * R + 3, ly[3] + 6), Wd = 2 * R + 6 + 8 + 28, bx = 2 * R + 5; return <svg width={Wd} height={H} viewBox={`0 0 ${Wd} ${H}`} style={{ width: Wd, height: H, direction: "ltr" }}>{ns.map((n, k) => { const r = f(n); const y = tys[k]; return <g key={n}><circle cx={R + 2} cy={2 * R + 1.5 - r} r={r} fill="none" stroke="#222" strokeWidth="1" /><polyline points={`${R + 2},${y} ${bx},${y} ${bx + 11},${ly[k]}`} fill="none" stroke="#222" strokeWidth=".6" /><text x={bx + 13} y={ly[k] + fs * 0.35} fontSize={fs} textAnchor="start" direction="ltr">{n}</text></g> })}</svg> })()}</div>}
        {sel && one && (<div className="tip" dir={rtl ? 'rtl' : 'ltr'} ref={tipRef} onClick={e => e.stopPropagation()}><h4>{nm(sel)}</h4><div className="tt">{fmt(one.total)} {t.victims}:</div>
          <div className="tr"><span>{t.ttK}</span><b className="c1">{fmt(one.killed)}</b></div>
          <div className="tr"><span>{t.ttHK}</span><b className="m2">{fmt(one.hk)}</b></div>
          <div className="tr"><span>{t.ttR}</span><b className="c3">{fmt(one.ret)}</b></div>
          <button className="tgo" onClick={() => { track('settlement_open', { settlement: sel, lang }); setDet(sel) }}>{t.view}</button></div>)}
        </div>
        <div className="hint">{t.hint}</div>
        <section className="card c-civ"><h2>{t.cCiv}</h2>
          <div className="dn"><Donut a={s.civilians} b={s.security} /><span className="l tl">{t.sec}<br /><b>{fmt(s.security)}</b> ({pct(s.security, s.total)}%)</span><span className="l br">{t.civs}<br /><b>{fmt(s.civilians)}</b> ({pct(s.civilians, s.total)}%)</span></div></section>
        <section className="card c-gen"><h2>{t.cGen} <small>{t.incl}</small></h2>
          <div className="dn"><Donut a={s.female} b={s.male} /><span className="l tr">{t.fem}<br /><b>{fmt(s.female)}</b></span><span className="l bl">{t.male}<br /><b>{fmt(s.male)}</b></span></div></section>
        <section className="card c-age"><h2>{t.cAge}</h2><small className="sub">{t.excl(s.noAge)}</small><AgeBars ages={s.ages} /></section>
        <footer className="foot" dir={rtl ? 'rtl' : 'ltr'}><b>{t.data}</b> <a href="https://oct7database.com/" target="_blank" rel="noreferrer" onClick={() => track('outbound_click', { target: 'oct7database', lang })}>https://oct7database.com/</a><br /><i><b>{t.disc}</b> {t.discT}</i><br /><a className="srcl" onClick={() => { track('sources_open', { lang }); setShowSrc(true) }}><b>{t.src}</b></a><br /><br /><b>{t.design}</b> <a className="byl" href="https://smilganir.github.io/" target="_blank" rel="noopener noreferrer" onClick={() => track('outbound_click', { target: 'homepage', lang })}>{t.dname}</a><br />{t.based}</footer>
        {showSrc && <Sources lang={lang} onClose={() => setShowSrc(false)} />}
        {det && <Detail name={det} lang={lang} onBack={() => { track('detail_back', { settlement: det, lang }); setDet(null); setSel(null); setTimeout(() => { mapRef.current?.resize(); fitRef.current() }, 60) }} />}
      </div>
    </div>
  )
}
