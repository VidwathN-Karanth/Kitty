import { Volume2, VolumeX } from 'lucide-react'

// System volume slider (reads and sets Windows master volume through the media helper)
export default function Volume({ vol, wide }: { vol?: { v: number; mute: boolean } | null; wide?: boolean }) {
  const v = vol?.v ?? 0
  return (
    <div className={'vol' + (wide ? ' wide' : '')}>
      <button onClick={() => window.kitty.mediaCmd('mute')} aria-label="Mute">{vol?.mute || v === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      <input type="range" min={0} max={100} value={Math.round(v * 100)} style={{ ['--p' as string]: `${v * 100}%` }}
        onChange={(e) => window.kitty.mediaCmd(`vol ${Number(e.target.value) / 100}`)} />
    </div>
  )
}
