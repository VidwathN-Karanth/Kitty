import { useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

// System volume slider (reads and sets Windows master volume through the media helper). While you drag, the slider
// follows your hand right away and only the latest value is sent (at most every 50 ms), so it never lags behind.
export default function Volume({ vol, wide }: { vol?: { v: number; mute: boolean } | null; wide?: boolean }) {
  const [drag, setDrag] = useState<number | null>(null)
  const last = useRef(0)
  const v = drag ?? vol?.v ?? 0
  const send = (x: number, now = false) => {
    if (!now && performance.now() - last.current < 50) return
    last.current = performance.now()
    window.kitty.mediaCmd(`vol ${x}`)
  }
  return (
    <div className={'vol' + (wide ? ' wide' : '')}>
      <button onClick={() => window.kitty.mediaCmd('mute')} aria-label="Mute">{vol?.mute || v === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      <input type="range" min={0} max={100} value={Math.round(v * 100)} style={{ ['--p' as string]: `${v * 100}%` }}
        onChange={(e) => { const x = Number(e.target.value) / 100; setDrag(x); send(x) }}
        onPointerUp={() => { if (drag !== null) send(drag, true); setTimeout(() => setDrag(null), 400) }} />
    </div>
  )
}
