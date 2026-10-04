import data from './data.json'
export type Victim = { l: string | null; g: string; a: number | null; r: string; k: string; s: boolean }
export const victims = data.victims as Victim[]
export const locations = data.locations as { name: string; lat: number; lon: number; shape: string; count: number }[]
export function stats(v: Victim[]) {
  const killed = v.filter(x => x.k === 'killed')
  const hk = v.filter(x => x.k === 'hostage_killed')
  const ret = v.filter(x => x.k === 'returned')
  const civ = (a: Victim[]) => a.filter(x => !x.s).length
  const ages = new Array(10).fill(0); let noAge = 0
  for (const x of v) { if (x.a == null) noAge++; else ages[Math.min(9, Math.floor(x.a / 10))]++ }
  return {
    total: v.length, killed: killed.length, killedCiv: civ(killed), hk: hk.length, hkCiv: civ(hk), ret: ret.length, retCiv: civ(ret),
    fatalities: killed.length + hk.length, hostages: hk.length + ret.length,
    civilians: civ(v), security: v.filter(x => x.s).length,
    female: v.filter(x => x.g === 'F').length, male: v.filter(x => x.g === 'M').length, ages, noAge,
  }
}
export const fmt = (n: number) => n.toLocaleString('en-US')
