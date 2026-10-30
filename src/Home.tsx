import { Play, Pause, SkipBack, SkipForward, Video, CalendarClock, Music as MusicIcon, CloudOff } from 'lucide-react'
import ClaudeMark from './ClaudeMark'
import { FocusState, fmt } from './Focus'
import { pickSession } from './useClaude'
import { when } from './useInfo'
import type { TabId } from './tabs'

const CLAUDE_STATE: Record<string, [string, string]> = {
  working: ['Working', '#f0a030'], question: ['Needs you', '#f0a030'], error: ['Error', '#e5483d'], done: ['Done', '#5fe05f'], idle: ['Idle', '#8a8a90'],
}

// Stop the click on a card's own buttons from also opening the card
const only = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

export default function Home({ focus, now, media, claude, info, hasCalendar, setFocus, go, connected }: {
  focus: FocusState; now: number; media: Media; claude: ClaudeData; info: Info; hasCalendar: boolean
  setFocus: (f: FocusState) => void; go: (t: TabId) => void; connected: boolean
}) {
  const m = media.state
  const session = pickSession(claude.sessions)
  const [cLabel, cColor] = !connected ? ['Off', '#6b6b70'] : CLAUDE_STATE[session?.state ?? 'idle']
  const busy = session?.state === 'working' || session?.state === 'question'

  const running = focus.endAt !== null
  const total = focus.mins * 60000
  const left = running ? focus.endAt! - now : focus.left
  const progress = running || left !== total ? 1 - left / total : 0
  const R = 22, C = 2 * Math.PI * R

  const end = m.end ?? 0
  const pos = Math.min(end || Infinity, (m.pos ?? 0) + (m.playing ? (now - (m.at ?? now)) / 1000 : 0))
  const art = media.art ? `data:${media.art.mime};base64,${media.art.data}` : ''

  const w = info.weather
  const next = info.events.find((e) => e.end > now)

  return (
    <div className="home">
      <div className="hcards">
        {/* Claude Code */}
        <div className="hc hc-claude" role="button" tabIndex={0} onClick={() => go('claude')} onKeyDown={(e) => e.key === 'Enter' && go('claude')}>
          <div className="hc-top">
            <span className="hc-ico"><ClaudeMark size={14} /></span><span className="hc-name">Claude</span>
            <span className="hc-badge" style={{ color: cColor, background: cColor + '22' }}>{busy && <i className="hc-pulse" style={{ background: cColor }} />}{cLabel}</span>
          </div>
          <div className="hc-big">{claude.stats.today}<small>jobs today</small></div>
          <div className="hc-foot">{session ? session.project : connected ? 'Waiting for a job' : 'Turn it on in Settings'}</div>
        </div>

        {/* Music */}
        <div className="hc hc-music" role="button" tabIndex={0} onClick={() => go('music')} onKeyDown={(e) => e.key === 'Enter' && go('music')}>
          {art && <div className="hc-bg" style={{ backgroundImage: `url(${art})` }} />}
          <div className="hc-top">
            <span className="hc-ico"><MusicIcon size={14} /></span><span className="hc-name">Music</span>
            {art && <img className="hc-art" alt="" src={art} />}
          </div>
          {m.active ? (
            <>
              <div className="hc-song"><b>{m.title}</b><small>{m.artist || m.app}</small></div>
              <div className="hc-prog"><i style={{ width: end ? `${(pos / end) * 100}%` : 0 }} /></div>
              <div className="hc-ctl">
                <button onClick={only(() => window.kitty.mediaCmd('prev'))} aria-label="Previous"><SkipBack size={15} fill="currentColor" /></button>
                <button className="play" onClick={only(() => window.kitty.mediaCmd('toggle'))} aria-label={m.playing ? 'Pause' : 'Play'}>{m.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
                <button onClick={only(() => window.kitty.mediaCmd('next'))} aria-label="Next"><SkipForward size={15} fill="currentColor" /></button>
              </div>
            </>
          ) : (
            <div className="hc-empty"><b>Nothing playing</b><small>Play something in Spotify</small></div>
          )}
        </div>

        {/* Focus */}
        <div className="hc hc-focus" role="button" tabIndex={0} onClick={() => go('focus')} onKeyDown={(e) => e.key === 'Enter' && go('focus')}>
          <div className="hc-top"><span className="hc-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg></span><span className="hc-name">Focus</span></div>
          <button className="hc-ring" onClick={only(() => setFocus(running ? { ...focus, endAt: null, left: focus.endAt! - now } : { ...focus, endAt: now + focus.left }))} aria-label={running ? 'Pause' : 'Start'}>
            <svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r={R} fill="none" stroke="#ffffff26" strokeWidth="3.5" /><circle cx="27" cy="27" r={R} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 27 27)" style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
            <span>{running ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</span>
          </button>
          <div className="hc-big">{fmt(left)}<small>{running ? 'Focusing' : left !== total ? 'Paused' : 'Ready to start'}</small></div>
        </div>
      </div>

      <div className="strip">
        <span className="chip-w">
          {w?.temp !== undefined ? <><span className="em">{w.emoji}</span><b>{w.temp}{'°'}</b><span className="dim">{w.text} · {w.city}</span></>
            : <><CloudOff size={15} /><span className="dim">{w?.error ?? 'Add your city in Settings for the weather'}</span></>}
        </span>
        <span className="chip-e">
          {next ? (
            <>
              <CalendarClock size={16} color="#6fb6e8" />
              <span className="ev"><b>{next.title}</b> <span className="dim">{when(next.start, next.end, now)}</span></span>
              {next.link && <button className="join" onClick={() => window.kitty.openUrl(next.link)}><Video size={14} />Join</button>}
            </>
          ) : <><CalendarClock size={16} /><span className="dim">{hasCalendar ? 'No meetings coming up' : 'Add your calendar in Settings'}</span></>}
        </span>
      </div>
    </div>
  )
}
