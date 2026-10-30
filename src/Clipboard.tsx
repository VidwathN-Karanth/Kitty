import { useEffect, useState } from 'react'

type Clip = { text: string; t: number }
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000)
  return m < 1 ? 'now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h`
}

export default function Clipboard() {
  const [clips, setClips] = useState<Clip[]>([])
  useEffect(() => {
    window.kitty.clips().then(setClips)
    return window.kitty.onClips(setClips)
  }, [])

  return (
    <div className="clips">
      {clips.length === 0 && <div className="body">Copy something and it shows up here.</div>}
      {clips.slice(0, 4).map((c) => (
        <button key={c.t} className="clip" onClick={() => window.kitty.copyClip(c.text)} title="Click to copy again">
          <span className="clip-text">{c.text.replace(/\s+/g, ' ')}</span>
          <span className="clip-age">{ago(c.t)}</span>
        </button>
      ))}
      {clips.length > 0 && <button className="clear" onClick={() => window.kitty.clearClips()}>Clear history</button>}
    </div>
  )
}
