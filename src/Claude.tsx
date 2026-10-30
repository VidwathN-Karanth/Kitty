import { pickSession } from './useClaude'
import ClaudeMark from './ClaudeMark'

const STEPS = ['Read', 'Edit', 'Test', 'Done']
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Claude({ data, connected, now, usage }: { data: ClaudeData; connected: boolean; now: number; usage: { pct: number; used: number; budget: number } }) {
  const s = pickSession(data.sessions)

  if (!connected)
    return <div className="body">Claude Code isn&apos;t connected. Open <b>Settings → Connections</b> and turn on <b>Claude Code</b>.</div>
  if (!s)
    return <div className="body">No Claude Code activity yet. Start a session and it shows up here. {data.stats.today} jobs today.</div>

  const status = s.state === 'question' || s.state === 'error' ? s.label : s.state === 'done' ? `Done · ${mmss((s.endedAt ?? now) - s.startedAt)}` : `${s.label} · step ${s.step + 1} of 4`
  const light = s.state === 'done' ? '#5fe05f' : s.state === 'error' ? '#e5483d' : '#f0a030'

  return (
    <div className="claude">
      <div className="cl-left">
        <div className="cl-proj"><span className="cl-icon"><ClaudeMark size={16} color="#fff" /></span>{s.project}{data.sessions.length > 1 && <em> +{data.sessions.length - 1}</em>}</div>
        <div className="cl-time">{mmss((s.endedAt ?? now) - s.startedAt)}</div>
        <div className="cl-status" style={{ color: s.state === 'question' || s.state === 'error' ? light : '#ffffffb0' }}>{status}</div>
      </div>
      <div className="cl-bubble">
        <div className="cl-prompt">&ldquo;{s.prompt || '…'}&rdquo;</div>
        <div className="cl-sub">Claude is <b>{s.state === 'done' ? 'done' : s.state === 'question' ? 'asking you' : s.state === 'error' ? 'stuck' : 'working'}</b></div>
      </div>
      <div className="cl-usage" title={`${usage.used.toLocaleString()} of ${usage.budget.toLocaleString()} tokens in the last 5 hours`}><span>5-hour usage</span><div className="cl-meter"><i style={{ width: `${Math.min(100, usage.pct)}%`, background: usage.pct >= 90 ? '#e5483d' : usage.pct >= 70 ? '#f0a030' : '#7fd68a' }} /></div><b>{usage.pct}%</b></div>
      <div className="cl-steps">
        {STEPS.map((n, i) => (
          <div key={n} className="cl-step">
            <div className="cl-seg" style={{ background: i <= s.step ? light : '#3a3a3c' }} />
            <span style={{ color: i <= s.step ? '#fff' : '#777' }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
