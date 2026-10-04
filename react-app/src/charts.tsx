const DARK = '#5f6670', LIGHT = '#d4d6d9'
export function Donut({ a, b, ca = DARK, cb = LIGHT }: { a: number; b: number; ca?: string; cb?: string }) {
  const r = 40, C = 2 * Math.PI * r, fa = a / (a + b || 1)
  return (
    <svg viewBox="0 0 100 100" className="donut">
      <circle cx="50" cy="50" r={r} fill="none" stroke={cb} strokeWidth="13" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={ca} strokeWidth="13" strokeDasharray={`${C * fa} ${C}`} transform="rotate(-90 50 50)" />
    </svg>
  )
}
export function AgeBars({ ages }: { ages: number[] }) {
  const max = Math.max(...ages, 1)
  return (
    <div className="bars">
      {ages.map((n, i) => (
        <div key={i} className="bar">
          <span className="bv">{n}</span>
          <div className="bf" style={{ height: `${(n / max) * 100}%` }} />
          <span className="bl">{i * 10}-{i * 10 + 10}</span>
        </div>
      ))}
    </div>
  )
}
