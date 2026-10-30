import { Play, Pause, Video, CalendarClock } from 'lucide-react'
import ClaudeMark from './ClaudeMark'
import { FocusState, fmt } from './Focus'
import { when } from './useInfo'

const card = (from: string, to: string) => ({ background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` })

export default function Home({ focus, now, media, claude, info, hasCalendar, setFocus }: {
  focus: FocusState; now: number; media: Media; claude: ClaudeData; info: Info; hasCalendar: boolean; setFocus: (f: FocusState) => void
}) {
  const busy = claude.sessions.some((s) => s.state === 'working' || s.state === 'question')
  const m = media.state
  const running = focus.endAt !== null
  const left = running ? focus.endAt! - now : focus.left
  const w = info.weather
  const next = info.events.find((e) => e.end > now)

  return (
    <div className="home">
      <div className="cards">
        <div className="card" style={card('#120b08', '#7a4a38')}>
          <span className="card-t">Claude Code</span>
          <div className={'ring' + (busy ? ' spin' : '')}><ClaudeMark size={24} /></div>
          <div className="big">{claude.stats.today}<small>jobs today</small></div>
        </div>
        <div className="card" style={card('#14110a', '#8a7552')}>
          <span className="card-t">Music</span>
          {media.art && <img className="thumb" src={`data:${media.art.mime};base64,${media.art.data}`} />}
          <div className="big sm">{m.active ? m.title : 'Nothing playing'}<small>{m.active ? m.artist : '—'}</small></div>
          {m.active && <button className="round" onClick={() => window.kitty.mediaCmd('toggle')}>{m.playing ? <Pause size={16} fill="#000" /> : <Play size={16} fill="#000" />}</button>}
        </div>
        <div className="card" style={card('#0d0814', '#7b4cb0')}>
          <span className="card-t">Focus</span>
          <button className="round big-r" onClick={() => setFocus(running ? { ...focus, endAt: null, left: focus.endAt! - now } : { ...focus, endAt: now + focus.left })}>
            {running ? <Pause size={22} fill="#b36ee8" color="#b36ee8" /> : <Play size={22} fill="#b36ee8" color="#b36ee8" />}
          </button>
          <div className="big">{fmt(left)}<small>{running ? 'Focusing' : 'Ready to start'}</small></div>
        </div>
      </div>

      <div className="strip">
        <span className="chip-w">
          {w?.temp !== undefined ? <><span className="em">{w.emoji}</span><b>{w.temp}{'°'}</b><span className="dim">{w.text} · {w.city}</span></>
            : <span className="dim">{w?.error ?? 'Add your city in Settings to see the weather'}</span>}
        </span>
        <span className="chip-e">
          {next ? (
            <>
              <CalendarClock size={16} color="#6fb6e8" />
              <span className="ev"><b>{next.title}</b> <span className="dim">{when(next.start, next.end, now)}</span></span>
              {next.link && <button className="join" onClick={() => window.kitty.openUrl(next.link)}><Video size={14} />Join</button>}
            </>
          ) : <span className="dim">{hasCalendar ? 'No meetings coming up' : 'Add your calendar in Settings'}</span>}
        </span>
      </div>
    </div>
  )
}
