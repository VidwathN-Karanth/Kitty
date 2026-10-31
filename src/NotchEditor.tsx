import { useState, type DragEvent, type ReactNode } from 'react'
import { AudioLines, BatteryFull, Bluetooth, CircleDot, Cpu, Gauge, MemoryStick, Music, Volume2, Wifi } from 'lucide-react'
import Cat from './Cat'
import { arrange, NOTCH_ITEMS, type NotchItem } from './notch'

const ICON: Record<NotchItem, ReactNode> = {
  wifi: <Wifi size={14} />, bt: <Bluetooth size={14} />, speaker: <Volume2 size={14} />, cpu: <Cpu size={14} />, ram: <MemoryStick size={14} />,
  gpu: <Gauge size={14} />, battery: <BatteryFull size={14} />, song: <Music size={14} />, light: <CircleDot size={14} />, bars: <AudioLines size={14} />,
}

// A little closed island: drag the items to either side of the cat and into any order. Both sides pack tight against
// the cat, like the real one. Only items that are switched on are shown.
export default function NotchEditor({ s, set }: { s: Settings; set: (p: SettingsPatch) => void }) {
  const [over, setOver] = useState<'l' | 'r' | null>(null)
  const on: Record<NotchItem, boolean> = {
    wifi: s.showWifi, bt: s.showBluetooth, speaker: s.showSpeaker, cpu: s.statsRest && s.stats.cpu, ram: s.statsRest && s.stats.ram,
    gpu: s.statsRest && s.stats.gpu, battery: s.showBattery, song: s.songTicker, light: true, bars: true,
  }
  const shown = (Object.keys(on) as NotchItem[]).filter((k) => on[k])
  const { left, right } = arrange(s, shown, (k) => NOTCH_ITEMS[k].w)

  const drop = (to: 'l' | 'r') => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setOver(null)
    const k = e.dataTransfer.getData('text/plain') as NotchItem
    if (!NOTCH_ITEMS[k]) return
    // where it lands: after every chip whose middle is left of the pointer
    const chips = [...e.currentTarget.querySelectorAll<HTMLElement>('.ne-chip')].filter((c) => c.dataset.k !== k)
    const at = chips.filter((c) => { const r = c.getBoundingClientRect(); return r.left + r.width / 2 < e.clientX }).length
    const l = left.filter((x) => x !== k), r = right.filter((x) => x !== k)
    ;(to === 'l' ? l : r).splice(at, 0, k)
    set({ notchMode: 'custom', notchLeft: l, notchRight: r })
  }
  const zone = (side: 'l' | 'r', list: NotchItem[]) => (
    <div className={'ne-side ' + side + (over === side ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(side) }} onDragLeave={() => setOver(null)} onDrop={drop(side)}>
      {list.map((k) => (
        <span key={k} data-k={k} className="ne-chip" title={NOTCH_ITEMS[k].label} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', k); e.dataTransfer.effectAllowed = 'move' }}>
          {ICON[k]}
        </span>
      ))}
    </div>
  )
  return (
    <div className="ne">
      <div className="ne-island">
        {zone('l', left)}
        <span className="ne-cat"><Cat size={30} follow={false} blink={false} /></span>
        {zone('r', right)}
      </div>
      <div className="ne-key">{shown.map((k) => <span key={k}>{ICON[k]}{NOTCH_ITEMS[k].label}</span>)}</div>
      <div className="ne-foot">
        <span>{s.notchMode === 'custom' ? 'Your order. New items go to their usual side.' : 'Automatic: the island keeps both sides even. Drag an item to arrange it yourself.'}</span>
        {s.notchMode === 'custom' && <button className="btn" onClick={() => set({ notchMode: 'auto', notchLeft: [], notchRight: [] })}>Back to automatic</button>}
      </div>
    </div>
  )
}
