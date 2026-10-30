import { SkipBack, SkipForward, Play, Pause } from 'lucide-react'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function Music({ media, now }: { media: Media; now: number }) {
  const m = media.state
  if (!m.active) return <div className="body">Play something in Spotify (or any media app) and it shows up here.</div>

  // position is reported about once a second; extend it locally while playing
  const end = m.end ?? 0
  const pos = Math.min(end || Infinity, (m.pos ?? 0) + (m.playing ? (now - (m.at ?? now)) / 1000 : 0))

  return (
    <div className="music">
      <div className="m-top">
        {media.art ? <img className="m-art" src={`data:${media.art.mime};base64,${media.art.data}`} /> : <div className="m-art" />}
        <div style={{ minWidth: 0 }}>
          <div className="m-title">{m.title}</div>
          <div className="m-artist">{m.artist}</div>
        </div>
      </div>
      <div className="m-bar">
        <span>{mmss(pos)}</span>
        <div className="m-track"><div className="m-fill" style={{ width: end ? `${(pos / end) * 100}%` : 0 }} /></div>
        <span>-{mmss(Math.max(0, end - pos))}</span>
      </div>
      <div className="m-ctl">
        <button onClick={() => window.kitty.mediaCmd('prev')}><SkipBack size={26} fill="#fff" /></button>
        <button onClick={() => window.kitty.mediaCmd('toggle')}>{m.playing ? <Pause size={34} fill="#fff" /> : <Play size={34} fill="#fff" />}</button>
        <button onClick={() => window.kitty.mediaCmd('next')}><SkipForward size={26} fill="#fff" /></button>
      </div>
      {m.app && <span className="m-src">{m.app.replace(/\.exe$/i, '')}</span>}
    </div>
  )
}
