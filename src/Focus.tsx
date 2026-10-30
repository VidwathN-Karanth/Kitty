import { Play, Pause, RotateCcw } from 'lucide-react'

// left = ms remaining while paused/idle; endAt is set while running
export type FocusState = { mins: number; endAt: number | null; left: number }

export const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// A scroll wheel: roll the mouse wheel over it (or click the faded numbers) to change the value
function Wheel({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (v: number) => void }) {
  const wrap = (v: number) => (v + max + 1) % (max + 1)
  return (
    <div className="wheel" onWheel={(e) => onChange(wrap(value + (e.deltaY > 0 ? 1 : -1)))}>
      <button className="n" onClick={() => onChange(wrap(value - 1))} aria-label={`less ${label}`}>{wrap(value - 1)}</button>
      <span className="cur"><b>{value}</b> {label}</span>
      <button className="n" onClick={() => onChange(wrap(value + 1))} aria-label={`more ${label}`}>{wrap(value + 1)}</button>
    </div>
  )
}

export default function Focus({ f, set, now }: { f: FocusState; set: (f: FocusState) => void; now: number }) {
  const running = f.endAt !== null
  const left = running ? f.endAt! - now : f.left
  const doneAt = new Date(running ? f.endAt! : now + f.left).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const pick = (m: number) => { const t = Math.max(1, m); set({ mins: t, endAt: null, left: t * 60000 }) }
  const hr = Math.floor(f.mins / 60), mn = f.mins % 60

  return (
    <div className="focus">
      <div className="focus-row">
        <button className="ghost" onClick={() => pick(f.mins)}><RotateCcw size={16} /> Reset</button>
        <div className="focus-pick">
          {running || f.left !== f.mins * 60000
            ? <div className="focus-time">{fmt(left)}</div>
            : <><Wheel value={hr} max={12} label="hr" onChange={(h) => pick(h * 60 + mn)} /><Wheel value={mn} max={59} label="min" onChange={(m) => pick(hr * 60 + m)} /></>}
        </div>
        <button className="start" onClick={() => set(running ? { ...f, endAt: null, left: f.endAt! - now } : { ...f, endAt: now + f.left })}>
          {running ? <Pause size={16} /> : <Play size={16} />} {running ? 'Pause' : 'Start'}
        </button>
      </div>
      <div className="focus-row small">
        <span className="presets">
          {[5, 15, 25, 50].map((m) => (
            <button key={m} className={'chip' + (f.mins === m ? ' on' : '')} onClick={() => pick(m)}>{m} min</button>
          ))}
        </span>
        <span style={{ color: '#888' }}>Done at {doneAt}</span>
      </div>
    </div>
  )
}
