// What sits on each side of the cat in the closed island, and in what order.
// Lists are in screen order (left to right); both sides pack tight against the cat.
export type NotchItem = 'wifi' | 'bt' | 'speaker' | 'cpu' | 'ram' | 'gpu' | 'battery' | 'song' | 'light' | 'bars'

// label for the Settings editor, default side, and a width guess (px) until the real one is measured
export const NOTCH_ITEMS: Record<NotchItem, { label: string; side: 'l' | 'r'; w: number }> = {
  wifi: { label: 'Wi-Fi', side: 'l', w: 15 }, bt: { label: 'Bluetooth', side: 'l', w: 15 }, speaker: { label: 'Speaker', side: 'l', w: 15 },
  cpu: { label: 'CPU', side: 'l', w: 48 }, ram: { label: 'RAM', side: 'l', w: 72 }, gpu: { label: 'GPU', side: 'l', w: 48 },
  battery: { label: 'Battery', side: 'r', w: 50 }, song: { label: 'Song title', side: 'r', w: 96 }, light: { label: 'Status light', side: 'r', w: 10 },
  bars: { label: 'Music bars', side: 'r', w: 18 },
}
const DEFAULT_LEFT: NotchItem[] = ['wifi', 'bt', 'speaker', 'cpu', 'ram', 'gpu']
const DEFAULT_RIGHT: NotchItem[] = ['battery', 'song', 'light', 'bars']

const sum = (l: NotchItem[], w: (k: NotchItem) => number, gap: number) => l.reduce((a, k) => a + w(k), 0) + Math.max(0, l.length - 1) * gap

// Automatic: start from the usual sides, then move the outermost item of the heavier side over to the outer end of
// the lighter side while that makes the wider side narrower. Items next to the cat never move, so nothing jumps.
export function balance(left: NotchItem[], right: NotchItem[], w: (k: NotchItem) => number, gap = 8) {
  const l = [...left], r = [...right]
  for (;;) {
    const wl = sum(l, w, gap), wr = sum(r, w, gap)
    if (wl > wr && l.length > 1) {
      const nl = l.slice(1), nr = [...r, l[0]]
      if (Math.max(sum(nl, w, gap), sum(nr, w, gap)) < Math.max(wl, wr)) { r.push(l.shift()!); continue }
    } else if (wr > wl && r.length > 1) {
      const nr = r.slice(0, -1), nl = [r[r.length - 1], ...l]
      if (Math.max(sum(nl, w, gap), sum(nr, w, gap)) < Math.max(wl, wr)) { l.unshift(r.pop()!); continue }
    }
    return { left: l, right: r }
  }
}

// The arrangement for the items showing right now. Custom: the user's order, with anything new added on its usual
// side (at the outer end). Automatic: the usual order, balanced.
export function arrange(s: { notchMode: string; notchLeft: string[]; notchRight: string[] }, present: NotchItem[], w: (k: NotchItem) => number) {
  const has = new Set(present)
  if (s.notchMode === 'custom') {
    const left = (s.notchLeft as NotchItem[]).filter((k) => has.has(k)), right = (s.notchRight as NotchItem[]).filter((k) => has.has(k))
    for (const k of present) if (!left.includes(k) && !right.includes(k)) NOTCH_ITEMS[k].side === 'l' ? left.unshift(k) : right.push(k)
    return { left, right }
  }
  return balance(DEFAULT_LEFT.filter((k) => has.has(k)), DEFAULT_RIGHT.filter((k) => has.has(k)), w)
}
