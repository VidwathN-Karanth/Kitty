import { useEffect, useState } from 'react'
import { Smartphone, Copy, ExternalLink, GripVertical, Check, LoaderCircle } from 'lucide-react'
import { usePhone, phoneLabel } from './usePhone'

const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000)
  return m < 1 ? 'now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h`
}
// drag the picture (as a PNG file) into any app, chat or folder
const drag = (c: Clip) => ({ draggable: true, onDragStart: (e: React.DragEvent) => { e.preventDefault(); window.kitty.dragClip(c.image!) } })

// Clipboard history: text and pictures. A picture that was just copied (a screenshot) is shown big, ready to drag
// anywhere, send to the phone, copy again or open.
export default function Clipboard() {
  const [clips, setClips] = useState<Clip[]>([])
  const [copied, setCopied] = useState<number | null>(null)
  const { device, status, send } = usePhone()
  useEffect(() => {
    window.kitty.clips().then(setClips)
    return window.kitty.onClips(setClips)
  }, [])
  const top = clips[0]
  const hero = top?.image ? top : null
  const rest = (hero ? clips.slice(1) : clips).slice(0, hero ? 1 : 4) // with a picture shown big, one more line fits
  const flash = (t: number) => { setCopied(t); setTimeout(() => setCopied((c) => (c === t ? null : c)), 1200) }

  return (
    <div className="clips">
      {clips.length === 0 && <div className="body">Copy something (text or a screenshot) and it shows up here.</div>}
      {hero && (
        <div className="cb-hero">
          <div className="cb-shot" {...drag(hero)} title="Drag me into any app, chat or folder">
            <img src={hero.thumb} alt="" draggable={false} />
            <span className="cb-grip"><GripVertical size={13} />Drag</span>
          </div>
          <div className="cb-info">
            <b>Picture copied</b>
            <small>{hero.w}×{hero.h} · {ago(hero.t)}</small>
            <span className="cb-hint">{status ? phoneLabel(status, device ? device.name : undefined) : 'Drag it into any app or chat'}</span>
            <div className="cb-actions">
              {device && <button className="lk-btn" disabled={status?.state === 'sending'} onClick={() => send([hero.image!])} title={`Send to ${device.name}`}>{status?.state === 'sending' ? <LoaderCircle size={14} className="spin" /> : <Smartphone size={14} />}Phone</button>}
              <button className="lk-btn" onClick={() => { window.kitty.copyClipImage(hero.image!); flash(hero.t) }}>{copied === hero.t ? <Check size={14} /> : <Copy size={14} />}Copy</button>
              <button className="lk-btn" onClick={() => window.kitty.openClip(hero.image!)}><ExternalLink size={14} />Open</button>
            </div>
          </div>
        </div>
      )}
      {rest.map((c) => c.image ? (
        <div key={c.t} className="clip img" {...drag(c)} onClick={() => { window.kitty.copyClipImage(c.image!); flash(c.t) }} title="Click to copy again · drag into any app">
          <img src={c.thumb} alt="" draggable={false} />
          <span className="clip-text">{copied === c.t ? 'Copied' : `Picture ${c.w}×${c.h}`}</span>
          <span className="clip-age">{ago(c.t)}</span>
        </div>
      ) : (
        <button key={c.t} className="clip" onClick={() => { window.kitty.copyClip(c.text!); flash(c.t) }} title="Click to copy again">
          <span className="clip-text">{copied === c.t ? 'Copied' : c.text!.replace(/\s+/g, ' ')}</span>
          <span className="clip-age">{ago(c.t)}</span>
        </button>
      ))}
      {clips.length > 0 && <button className="clear" onClick={() => window.kitty.clearClips()}>Clear history</button>}
    </div>
  )
}
