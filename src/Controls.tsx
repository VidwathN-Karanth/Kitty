import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sun, Volume2, VolumeX, Wifi, WifiHigh, WifiLow, WifiOff, Bluetooth, BluetoothOff, ChevronRight, ChevronLeft, Lock, RotateCw, Moon, MonitorCog, Speaker, ArrowUpRight, Check, Eye, EyeOff, LoaderCircle } from 'lucide-react'

const WIN = navigator.userAgent.includes('Windows')
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const POWER: [PowerMode, string][] = [['eff', 'Battery'], ['bal', 'Balanced'], ['perf', 'Performance']]

// A tall slider like a phone's control centre: press anywhere and drag. It follows the hand right away (transform
// only, so it stays smooth) and sends at most one value every 60 ms; the last one always goes out on release.
// `wide` lays it on its side (the night light strength bar).
function VSlider({ value, onChange, icon, label, wide }: { value: number; onChange: (v: number) => void; icon?: ReactNode; label: string; wide?: boolean }) {
  const [drag, setDrag] = useState<number | null>(null)
  const held = useRef(false), last = useRef(0), settle = useRef<number | undefined>(undefined)
  const v = drag ?? value
  const go = (x: number, now = false) => {
    setDrag(x); clearTimeout(settle.current)
    if (now || performance.now() - last.current > 60) { last.current = performance.now(); onChange(x) }
    if (!held.current) settle.current = window.setTimeout(() => setDrag(null), 500) // let the system's own value catch up
  }
  const at = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); return clamp(wide ? (e.clientX - r.left) / r.width : (r.bottom - e.clientY) / r.height) }
  return (
    <div className={(wide ? 'vs hs' : 'vs') + (held.current ? ' drag' : '')} style={{ ['--p' as string]: v }} role="slider" tabIndex={0} aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); held.current = true; go(at(e), true) }}
      onPointerMove={(e) => { if (held.current) go(at(e)) }}
      onPointerUp={(e) => { held.current = false; go(at(e), true) }}
      onPointerCancel={() => { held.current = false; go(v, true) }}
      onWheel={(e) => go(clamp(v - Math.sign(e.deltaY) * 0.05), true)}
      onKeyDown={(e) => { const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0; if (d) { e.preventDefault(); go(clamp(v + d), true) } }}>
      <i className="vs-fill" />
      {!wide && <><b>{Math.round(v * 100)}%</b><span className="vs-ico">{icon}</span></>}
    </div>
  )
}

function Tile({ on, color, icon, title, sub, onClick, more, link }: { on?: boolean; color: string; icon: ReactNode; title: string; sub: string; onClick: () => void; more?: () => void; link?: boolean }) {
  return (
    <div className="qt-wrap">
      <button className={'qt' + (on ? ' on' : '')} style={{ ['--c' as string]: color }} onClick={onClick} aria-pressed={link ? undefined : !!on}>
        <span className="qt-ico">{icon}</span>
        <span className="qt-txt"><b>{title}</b><small>{sub}</small></span>
        {link && <ArrowUpRight size={13} className="qt-link" />}
      </button>
      {more && <button className="qt-more" onClick={more} aria-label={`${title} options`}><ChevronRight size={15} /></button>}
    </div>
  )
}

const bars = (s: number) => (s >= 66 ? <Wifi size={16} /> : s >= 33 ? <WifiHigh size={16} /> : <WifiLow size={16} />)

// Wi-Fi networks around: click one to join; a new secured network asks for its password right in the row
function Networks({ back }: { back: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<Window['kitty']['wifiList']>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState<string | null>(null) // network waiting for its password
  const [pw, setPw] = useState(''), [show, setShow] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [err, setErr] = useState<{ ssid: string; text: string } | null>(null)
  // ask for a fresh scan, show what is known now, and look again once the scan is in
  const load = (scan = true) => { setBusy(true); window.kitty.wifiList(scan).then(setData).finally(() => setBusy(false)); if (scan) setTimeout(() => window.kitty.wifiList().then(setData), 3500) }
  useEffect(() => { load(); const t = setInterval(() => load(false), 8000); return () => clearInterval(t) }, [])
  const join = async (n: WifiNet, password: string | null) => {
    if (joining || n.ssid === data?.current) return
    setJoining(n.ssid); setErr(null)
    const r = await window.kitty.wifiJoin(n.ssid, password, n.secure)
    setJoining(null)
    if (r.needPassword) { setAsk(n.ssid); setPw(''); return }
    if (r.error) { setErr({ ssid: n.ssid, text: r.error }); return }
    setAsk(null); setPw(''); load(false)
  }
  return (
    <div className="nets">
      <div className="nets-head">
        <button onClick={back} className="nets-back"><ChevronLeft size={16} />Wi-Fi networks</button>
        <button onClick={() => load()} className={'nets-ref' + (busy ? ' spin' : '')} aria-label="Refresh"><RotateCw size={14} /></button>
      </div>
      <div className="nets-list">
        {data?.error && <div className="nets-msg">{data.error}{data.fix && <button onClick={() => window.kitty.openUrl(data.fix!)}>Open settings</button>}</div>}
        {data && !data.error && !data.nets.length && <div className="nets-msg">No networks found yet. Windows looks again every few seconds.</div>}
        {!data && <div className="nets-msg">Looking for networks…</div>}
        {data?.nets.map((n) => {
          const cur = n.ssid === data.current
          return (
            <div key={n.ssid} className={'net' + (cur ? ' cur' : '') + (ask === n.ssid ? ' asking' : '')}>
              <button className="net-row" onClick={() => join(n, null)}>
                <span className="net-sig">{bars(n.signal)}</span>
                <span className="net-name">{n.ssid}</span>
                {n.secure && <Lock size={12} className="net-lock" />}
                <span className="net-state">{joining === n.ssid ? <><LoaderCircle size={13} className="spin" />Connecting</> : cur ? <><Check size={13} />Connected</> : ''}</span>
              </button>
              {err?.ssid === n.ssid && <small className="net-err">{err.text}</small>}
              {ask === n.ssid && (
                <form className="net-pw" onSubmit={(e) => { e.preventDefault(); join(n, pw) }}>
                  <input autoFocus type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" spellCheck={false}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAsk(null) }} />
                  <button type="button" className="net-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button type="submit" className="net-join" disabled={pw.length < 8 || !!joining}>Join</button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Night light: on/off and its strength (0-100, the same Strength as in Windows Settings)
function NightPanel({ on, strength, back, toggle, panels }: { on: boolean; strength: number | null; back: () => void; toggle: () => void; panels: boolean }) {
  const [shown, setShown] = useState(strength ?? 50) // follows the bar while dragging, then the PC's own value
  useEffect(() => { if (strength != null) setShown(strength) }, [strength])
  return (
    <div className="np">
      <div className="nets-head">
        <button onClick={back} className="nets-back"><ChevronLeft size={16} />Night light</button>
        <button className={'np-switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label="Night light" onClick={toggle}><i /></button>
      </div>
      <div className={'np-card' + (on ? '' : ' off')}>
        <div className="np-row"><span><Moon size={15} />Strength</span><b>{shown}%</b></div>
        {strength != null
          ? <VSlider wide label="Night light strength" value={strength / 100} onChange={(x) => { const n = Math.round(x * 100); setShown(n); window.kitty.mediaCmd(`nightstr ${n}`) }} />
          : <small className="np-note">The strength can't be changed from here on this PC.</small>}
        <div className="np-scale"><span>Less warm</span><span>{on ? '' : 'Turn it on to see the change'}</span><span>Warmer</span></div>
      </div>
      {panels && <button className="np-link" onClick={() => window.kitty.openPanel('nightlight')}>Schedule and more in {WIN ? 'Windows Settings' : 'Settings'}<ArrowUpRight size={13} /></button>}
    </div>
  )
}

// Control Center: brightness + volume sliders, Wi-Fi / Bluetooth / mute that really switch the PC's own, power mode,
// night light, and shortcuts into Windows Settings for what Windows doesn't let apps switch (display, sound output).
export default function Controls({ media }: { media: Media }) {
  const [page, setPage] = useState<'main' | 'wifi' | 'night'>('main')
  const [pend, setPend] = useState<{ wifi?: boolean; bt?: boolean; power?: PowerMode; night?: boolean }>({}) // shown right away, until the PC reports back
  const [ssid, setSsid] = useState<string | null>(null)
  // shortcuts into the system's settings: Windows Settings, or GNOME / KDE settings when one is installed
  const [panels, setPanels] = useState(WIN)
  useEffect(() => { window.kitty.canPanels().then(setPanels).catch(() => {}) }, [])
  const r = media.radios
  useEffect(() => setPend({}), [r?.wifi, r?.bt, media.power, media.night])
  useEffect(() => { window.kitty.wifiList().then((x) => setSsid(x.current)).catch(() => {}) }, [r?.wifi])
  const later = (k: keyof typeof pend) => setTimeout(() => setPend((p) => ({ ...p, [k]: undefined })), 8000)
  const radio = (k: 'wifi' | 'bt', on: boolean) => {
    setPend((p) => ({ ...p, [k]: on })); later(k)
    window.kitty.mediaCmd(`radio ${k === 'wifi' ? 'WiFi' : 'Bluetooth'} ${on ? 'on' : 'off'}`)
  }
  const wifiOn = pend.wifi ?? (r?.wifi === 'on' || r?.wifi === 'connected')
  const btOn = pend.bt ?? r?.bt === 'on'
  const muted = !!media.vol?.mute
  const power = pend.power ?? media.power
  const hasBright = typeof media.bright === 'number'
  const night = pend.night ?? media.night
  const hasNight = typeof media.night === 'boolean'

  const toggleNight = () => { const on = !night; setPend((p) => ({ ...p, night: on })); later('night'); window.kitty.mediaCmd(`night ${on ? 'on' : 'off'}`) }
  if (page === 'wifi') return <Networks back={() => setPage('main')} />
  if (page === 'night') return <NightPanel on={!!night} strength={media.nightStrength ?? null} back={() => setPage('main')} toggle={toggleNight} panels={panels} />
  return (
    <div className="qs" style={{ gridTemplateColumns: hasBright ? '62px 62px 1fr' : '62px 1fr' }}>
      {hasBright && <VSlider label="Brightness" value={media.bright! / 100} onChange={(x) => window.kitty.mediaCmd(`bright ${Math.max(1, Math.round(x * 100))}`)} icon={<Sun size={18} />} />}
      <VSlider label="Volume" value={media.vol?.v ?? 0} onChange={(x) => window.kitty.mediaCmd(`vol ${x.toFixed(3)}`)} icon={muted ? <VolumeX size={18} /> : <Volume2 size={18} />} />
      <div className="qs-grid" style={{ gridTemplateRows: [(panels || hasNight) && '1fr', '1fr', power && 'auto'].filter(Boolean).join(' ') }}>
        <Tile on={wifiOn} color="#4f9dff" icon={wifiOn ? <Wifi size={16} /> : <WifiOff size={16} />} title="Wi-Fi"
          sub={!r?.wifi ? 'Not found' : !wifiOn ? 'Off' : r.wifi === 'connected' ? ssid ?? 'Connected' : 'Not connected'}
          onClick={() => r?.wifi && radio('wifi', !wifiOn)} more={r?.wifi ? () => setPage('wifi') : undefined} />
        <Tile on={btOn} color="#4f9dff" icon={btOn ? <Bluetooth size={16} /> : <BluetoothOff size={16} />} title="Bluetooth"
          sub={!r?.bt ? 'Not found' : btOn ? 'On' : 'Off'} onClick={() => r?.bt && radio('bt', !btOn)}
          more={panels ? () => window.kitty.openPanel('bluetooth') : undefined} />
        <Tile on={muted} color="#ff5a4a" icon={muted ? <VolumeX size={16} /> : <Volume2 size={16} />} title="Mute" sub={muted ? 'Muted' : 'Sound on'} onClick={() => window.kitty.mediaCmd('mute')} />
        {hasNight
          ? <Tile on={!!night} color="#f0b44a" icon={<Moon size={16} />} title="Night light"
              sub={(night ? 'On' : 'Off') + (media.nightStrength != null ? ` · ${media.nightStrength}%` : '')}
              onClick={toggleNight} more={() => setPage('night')} />
          : panels && <Tile link color="#f0b44a" icon={<Moon size={16} />} title="Night light" sub="Settings" onClick={() => window.kitty.openPanel('nightlight')} />}
        {panels && <>
          <Tile link color="#b79bff" icon={<MonitorCog size={16} />} title="Display" sub="Settings" onClick={() => window.kitty.openPanel('display')} />
          <Tile link color="#6fd0a0" icon={<Speaker size={16} />} title="Sound" sub="Output" onClick={() => window.kitty.openPanel('sound')} />
        </>}
        {power && (
          <div className="qs-seg" role="radiogroup" aria-label="Power mode">
            {POWER.map(([m, l]) => (
              <button key={m} role="radio" aria-checked={power === m} className={power === m ? 'on' : ''}
                onClick={() => { setPend((p) => ({ ...p, power: m })); later('power'); window.kitty.mediaCmd(`power ${m}`) }}>
                {power === m && <motion.i layoutId="qs-pow" className="qs-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
                <span>{l}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
