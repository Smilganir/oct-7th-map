// GA4 custom events. Never sends victim names or any personal data: only settlement, language and device class.
declare global { interface Window { gtag?: (...a: unknown[]) => void; __trk?: [string, Record<string, unknown>][] } }
const preview = /\/docs\//.test(location.pathname)
export const track = (name: string, params: Record<string, unknown> = {}) => {
  const p = { ...params, device: window.innerWidth < 760 ? 'mobile' : 'desktop' }
  try { (window.__trk ??= []).push([name, p]) } catch { /* ignore */ }
  if (preview) return
  try { window.gtag?.('event', name, p) } catch { /* ignore */ }
}
