import { useEffect, useId, useRef, useState } from 'react'
import Outfits from './Outfits'
import { bodyColor, eyeColor, Outfit } from './catStyle'

export type Mood =
  | 'normal' | 'happy' | 'love' | 'surprised' | 'curious' | 'focused' | 'wink' | 'sad' | 'dizzy' | 'sleepy' | 'asleep'
  | 'listening' | 'angry' | 'excited' | 'crying' | 'laugh' | 'shy' | 'smug' | 'scared' | 'bored' | 'yawn'

// The "See emotions" list in Settings and the chat tab
export const EMOTIONS: [Mood, string, string][] = [
  ['happy', '\u{1F60A}', 'Happy'], ['love', '\u{1F60D}', 'In love'], ['surprised', '\u{1F62E}', 'Surprised'], ['curious', '\u{1F914}', 'Curious'],
  ['focused', '\u{1F913}', 'Focused'], ['wink', '\u{1F609}', 'Wink'], ['sad', '\u{1F622}', 'Sad'], ['dizzy', '\u{1F635}', 'Dizzy'], ['sleepy', '\u{1F634}', 'Sleepy'],
  ['angry', '\u{1F620}', 'Angry'], ['excited', '\u{1F929}', 'Excited'], ['crying', '\u{1F62D}', 'Crying'], ['laugh', '\u{1F602}', 'Laughing'],
  ['shy', '\u{1F633}', 'Shy'], ['smug', '\u{1F60F}', 'Smug'], ['scared', '\u{1F628}', 'Scared'], ['bored', '\u{1F611}', 'Bored'], ['yawn', '\u{1F971}', 'Yawning'],
  ['listening', '\u{1F3A7}', 'Listening'],
]

type Eye = 'open' | 'happy' | 'sleep' | 'love' | 'dizzy' | 'star' | 'wink'
type Brow = 'none' | 'angry' | 'sad' | 'raised' | 'flat' | 'one'
type Mouth = 'ww' | 'smile' | 'open' | 'big' | 'frown' | 'o' | 'flat' | 'wavy' | 'smirk' | 'cry' | 'yawn'
type Cfg = { eye: Eye; lid?: number; brow?: Brow; mouth: Mouth; pupil?: number; big?: boolean; blush?: number; extra?: string; gear?: 'headphones'; look?: 'down' }

const CFG: Record<Mood, Cfg> = {
  normal: { eye: 'open', mouth: 'ww' },
  happy: { eye: 'happy', mouth: 'open', blush: 0.45 },
  love: { eye: 'love', mouth: 'open', blush: 0.55, extra: 'hearts' },
  surprised: { eye: 'open', big: true, pupil: 0.5, brow: 'raised', mouth: 'o' },
  curious: { eye: 'open', big: true, brow: 'one', mouth: 'ww' },
  focused: { eye: 'open', lid: 0.28, brow: 'flat', mouth: 'flat' },
  wink: { eye: 'wink', mouth: 'open', blush: 0.4 },
  sad: { eye: 'open', lid: 0.3, brow: 'sad', mouth: 'frown', extra: 'tear' },
  dizzy: { eye: 'dizzy', mouth: 'wavy' },
  sleepy: { eye: 'open', lid: 0.55, mouth: 'ww' },
  asleep: { eye: 'sleep', mouth: 'ww', extra: 'zzz' },
  listening: { eye: 'open', lid: 0.38, mouth: 'smile', extra: 'music', gear: 'headphones' },
  angry: { eye: 'open', lid: 0.22, pupil: 0.8, brow: 'angry', mouth: 'frown', extra: 'vein' },
  excited: { eye: 'star', mouth: 'big', blush: 0.5, extra: 'sparkles' },
  crying: { eye: 'open', lid: 0.25, brow: 'sad', mouth: 'cry', extra: 'tears' },
  laugh: { eye: 'happy', mouth: 'big', blush: 0.5, extra: 'joy' },
  shy: { eye: 'open', lid: 0.15, brow: 'sad', mouth: 'smile', blush: 0.9, look: 'down' },
  smug: { eye: 'open', lid: 0.45, brow: 'one', mouth: 'smirk' },
  scared: { eye: 'open', big: true, pupil: 0.45, brow: 'sad', mouth: 'wavy', extra: 'sweat' },
  bored: { eye: 'open', lid: 0.5, mouth: 'flat' },
  yawn: { eye: 'sleep', mouth: 'yawn' },
}

const EYES = [{ cx: 35, cy: 46 }, { cx: 65, cy: 46 }]
const MAX = 4.5 // how far the pupil may travel inside the eye, in svg units
const INK = '#5a3224'
const STAR = 'M0 -10 L2.9 -3.1 L9.5 -3.1 L4.2 1.4 L6 8.1 L0 4.3 L-6 8.1 L-4.2 1.4 L-9.5 -3.1 L-2.9 -3.1 Z'

// Cartoon cat. Pupils follow the cursor when `follow` is on. `mood` sets eyes, brows, mouth and little extras;
// 'listening' puts headphones on. `wave` makes the cat wave a paw (startup greeting).
type CatProps = { size?: number; follow?: boolean; light?: string; mood?: Mood; dance?: boolean; body?: string; eyes?: string; outfit?: Outfit; blink?: boolean; wave?: boolean }
function VectorCat({ size = 36, follow = true, light, mood = 'normal', dance = false, body = 'orange', eyes = 'mint', outfit = 'none', blink = true, wave = false }: CatProps) {
  const uid = useId()
  const svg = useRef<SVGSVGElement>(null)
  const pupils = useRef<(SVGGElement | null)[]>([])
  const HEAD = bodyColor(body)
  const IRIS = light ?? eyeColor(eyes)
  const SHADE = `color-mix(in srgb, ${HEAD} 72%, #000)`
  const LIGHT = `color-mix(in srgb, ${HEAD} 86%, #fff)`
  const c = CFG[mood] ?? CFG.normal
  const rest = c.look === 'down' ? 'translate(-2 4)' : 'translate(0 0)'
  const track = follow && !c.look

  useEffect(() => {
    const reset = () => pupils.current.forEach((p) => p?.setAttribute('transform', rest))
    reset()
    if (!track) return
    const off = window.kitty.onCursor(({ x, y }) => {
      const r = svg.current?.getBoundingClientRect()
      if (!r) return
      EYES.forEach((e, i) => {
        const dx = x - (r.left + (e.cx / 100) * r.width)
        const dy = y - (r.top + (e.cy / 100) * r.height)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(d / 250, 1) * MAX // closer cursor = smaller move, far = full
        pupils.current[i]?.setAttribute('transform', `translate(${(dx / d) * k} ${(dy / d) * k})`)
      })
    })
    return () => { off(); reset() }
  }, [track, rest])

  const fancy = size >= 60 // outfits only show on the big cat; the small header cat stays clean
  const eyeKind = (i: number): Eye => (c.eye === 'wink' ? (i === 1 ? 'happy' : 'open') : c.eye)

  const eye = (e: { cx: number; cy: number }, i: number) => {
    const k = eyeKind(i)
    if (k === 'happy') return <path key={i} d={`M${e.cx - 9} ${e.cy + 3} Q${e.cx} ${e.cy - 9} ${e.cx + 9} ${e.cy + 3}`} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
    if (k === 'sleep') return <path key={i} d={`M${e.cx - 9} ${e.cy - 1} Q${e.cx} ${e.cy + 7} ${e.cx + 9} ${e.cy - 1}`} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
    if (k === 'love') return <path key={i} className="beat" style={{ transformOrigin: `${e.cx}px ${e.cy}px` }} d={`M${e.cx} ${e.cy + 9} C${e.cx - 15} ${e.cy - 1} ${e.cx - 9} ${e.cy - 12} ${e.cx} ${e.cy - 4} C${e.cx + 9} ${e.cy - 12} ${e.cx + 15} ${e.cy - 1} ${e.cx} ${e.cy + 9} Z`} fill="#ff4f74" />
    if (k === 'dizzy') return <path key={i} d={`M${e.cx - 7} ${e.cy - 7} L${e.cx + 7} ${e.cy + 7} M${e.cx + 7} ${e.cy - 7} L${e.cx - 7} ${e.cy + 7}`} stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
    if (k === 'star') return <g key={i} transform={`translate(${e.cx} ${e.cy})`}><path className="twinkle" d={STAR} fill="#ffd84a" stroke="#f0a030" strokeWidth="1.2" strokeLinejoin="round" /></g>
    const lid = c.lid ?? 0
    return (
      <g key={i} className={blink ? 'blink' : ''} style={{ transformOrigin: `${e.cx}px ${e.cy}px` }}>
        <clipPath id={`${uid}c${i}`}><ellipse cx={e.cx} cy={e.cy} rx="11.5" ry="12.5" /></clipPath>
        <ellipse cx={e.cx} cy={e.cy} rx={c.big ? 12.5 : 11.5} ry={c.big ? 13.5 : 12.5} fill="#fff" stroke="#00000022" strokeWidth="1" />
        <g ref={(n) => { pupils.current[i] = n }} style={{ transition: 'transform 70ms linear' }}>
          <ellipse cx={e.cx} cy={e.cy} rx="8" ry="10" fill={`url(#${uid}i)`} style={{ transition: 'fill 300ms' }} />
          <ellipse cx={e.cx} cy={e.cy} rx="8" ry="10" fill="none" stroke="#00000033" strokeWidth="1" />
          <ellipse cx={e.cx} cy={e.cy} rx={3.2 * (c.pupil ?? 1)} ry={7.2 * (c.pupil ?? 1)} fill="#0e0e12" />
          <circle cx={e.cx - 3} cy={e.cy - 4} r="2.8" fill="#fff" />
          <circle cx={e.cx + 3.2} cy={e.cy + 4.2} r="1.3" fill="#fff" opacity=".85" />
        </g>
        <rect x={e.cx - 13} y={e.cy - 14} width="26" height={28 * lid} fill={HEAD} clipPath={`url(#${uid}c${i})`} style={{ transition: 'height 250ms' }} />
        <path d={`M${e.cx - 11.5} ${e.cy - 3} Q${e.cx} ${e.cy - 16} ${e.cx + 11.5} ${e.cy - 3}`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".75" />
      </g>
    )
  }

  const brows: Record<Exclude<Brow, 'none'>, string> = {
    angry: 'M22 29 L43 37 M78 29 L57 37', sad: 'M24 37 L43 29 M76 37 L57 29', raised: 'M25 31 Q34 24 44 30 M56 30 Q66 24 75 31',
    flat: 'M26 33 H44 M56 33 H74', one: 'M26 33 H44 M56 31 Q66 23 75 30',
  }

  return (
    <svg ref={svg} width={size} height={size * 0.8} viewBox="0 0 100 80" className={dance ? 'dance' : ''} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${uid}i`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${IRIS} 55%, #fff)` }} />
          <stop offset="55%" style={{ stopColor: IRIS }} />
          <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${IRIS} 55%, #000)` }} />
        </radialGradient>
        <linearGradient id={`${uid}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: LIGHT }} /><stop offset="70%" style={{ stopColor: HEAD }} /><stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${HEAD} 90%, #000)` }} />
        </linearGradient>
      </defs>

      <g className="earl"><path d="M12 42 L15 3 L43 25 Z" fill={HEAD} stroke={SHADE} strokeWidth="1.4" strokeLinejoin="round" /><path d="M19 31 L21 13 L34 24 Z" fill="#f7b6c2" /></g>
      <g className="earr"><path d="M88 42 L85 3 L57 25 Z" fill={HEAD} stroke={SHADE} strokeWidth="1.4" strokeLinejoin="round" /><path d="M81 31 L79 13 L66 24 Z" fill="#f7b6c2" /></g>
      <path d="M11 53 L3 57 L11 60 L5 66 L17 65 Z" fill={HEAD} stroke={SHADE} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M89 53 L97 57 L89 60 L95 66 L83 65 Z" fill={HEAD} stroke={SHADE} strokeWidth="1.1" strokeLinejoin="round" />
      <ellipse cx="50" cy="48" rx="40" ry="29.5" fill={`url(#${uid}h)`} stroke={SHADE} strokeWidth="1.4" />
      <path d="M43 21 L46.5 32 M50 19 L50 31 M57 21 L53.5 32" stroke={SHADE} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="64" rx="15" ry="9.5" fill="#fff" opacity=".2" />
      <circle cx="21" cy="58" r="6" fill="#ff7a8a" opacity={0.14 + (c.blush ?? 0) * 0.5} />
      <circle cx="79" cy="58" r="6" fill="#ff7a8a" opacity={0.14 + (c.blush ?? 0) * 0.5} />

      {EYES.map(eye)}
      {c.brow && c.brow !== 'none' && <path d={brows[c.brow]} stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />}

      <path d="M46 57.5 Q50 55.5 54 57.5 Q53 61.5 50 63 Q47 61.5 46 57.5 Z" fill="#e0707f" stroke="#b04a5a" strokeWidth=".8" strokeLinejoin="round" />
      <circle cx="48.4" cy="58" r="1" fill="#fff" opacity=".6" />
      {c.mouth === 'ww' && <path d="M50 63 Q50 69 44 68 M50 63 Q50 69 56 68" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'smile' && <path d="M50 63 L50 66 M42.5 65 Q50 73 57.5 65" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'open' && <g><path d="M43 65 Q50 79 57 65 Z" fill="#7a2f3a" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" /><ellipse cx="50" cy="72.5" rx="3.6" ry="2.2" fill="#ff8aa0" /></g>}
      {c.mouth === 'big' && <g><path d="M39 63 Q50 86 61 63 Z" fill="#7a2f3a" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" /><ellipse cx="50" cy="75" rx="5.5" ry="3.2" fill="#ff8aa0" /></g>}
      {c.mouth === 'frown' && <path d="M50 63 L50 66 M43 72 Q50 65 57 72" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'o' && <ellipse cx="50" cy="69" rx="3.5" ry="4.5" fill="#7a2f3a" />}
      {c.mouth === 'flat' && <path d="M50 63 L50 66 M44 69 H56" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'wavy' && <path d="M42 68 Q46 64 50 68 T58 68" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'smirk' && <path d="M50 63 L50 66 M44 69 Q52 72 59 65" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'cry' && <path d="M42 72 Q46 66 50 70 Q54 66 58 72" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {c.mouth === 'yawn' && <ellipse className="yawn" cx="50" cy="70" rx="5.5" ry="8" fill="#7a2f3a" stroke={INK} strokeWidth="1.4" />}
      <path d="M2 54 L21 57 M2 64 L21 62 M98 54 L79 57 M98 64 L79 62" stroke="#ffffffcc" strokeWidth="1.5" strokeLinecap="round" />

      {c.extra === 'tear' && <path d="M33 60 q-3.5 6 0 9.5 q3.5 -3.5 0 -9.5" fill="#6ec6ff" />}
      {c.extra === 'tears' && <g className="drip"><path d="M30 60 q-3 6 0 9 q3 -3 0 -9" fill="#6ec6ff" /><path d="M70 60 q-3 6 0 9 q3 -3 0 -9" fill="#6ec6ff" /></g>}
      {c.extra === 'joy' && <g><path d="M22 52 q-5 2 -4 7 q4 -1 4 -7" fill="#6ec6ff" /><path d="M78 52 q5 2 4 7 q-4 -1 -4 -7" fill="#6ec6ff" /></g>}
      {c.extra === 'sweat' && <path className="drip" d="M84 22 q-4 7 0 10 q4 -3 0 -10" fill="#8fd3ff" />}
      {c.extra === 'vein' && <g className="beat" style={{ transformOrigin: '80px 20px' }} stroke="#ff4b4b" strokeWidth="2.2" fill="none" strokeLinecap="round"><path d="M75 16 Q79 18 77 22 M85 14 Q83 18 87 20 M75 26 Q79 24 77 20 M85 26 Q83 22 87 22" /></g>}
      {c.extra === 'hearts' && <><path className="note1" d="M90 14 c-2 -3 -6 -1 -4 3 l4 4 l4 -4 c2 -4 -2 -6 -4 -3z" fill="#ff6b8f" /><path className="note2" d="M6 20 c-2 -3 -6 -1 -4 3 l4 4 l4 -4 c2 -4 -2 -6 -4 -3z" fill="#ff6b8f" /></>}
      {c.extra === 'sparkles' && <g fill="#ffe27a" className="twinkle" style={{ transformOrigin: '50px 40px' }}><path d="M90 12 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6z" /><path d="M8 18 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2z" /><path d="M94 46 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1z" /></g>}
      {c.extra === 'zzz' && <><text x="80" y="10" className="zz" fontSize="16" fill="#cfe3ff">z</text><text x="90" y="-4" className="zz z2" fontSize="12" fill="#cfe3ff">z</text></>}
      {c.extra === 'music' && <><text x="88" y="14" className="note1" fontSize="15" fill="#cfe3ff">{'♪'}</text><text x="-6" y="20" className="note2" fontSize="13" fill="#cfe3ff">{'♫'}</text></>}

      {c.gear === 'headphones' && (
        <g>
          <path d="M12 42 Q50 -16 88 42" stroke="#2b2b33" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="4" y="36" width="11" height="22" rx="5" fill="#2b2b33" /><rect x="85" y="36" width="11" height="22" rx="5" fill="#2b2b33" />
          <rect x="6.5" y="40" width="3" height="14" rx="1.5" fill="#6fd06f" /><rect x="90.5" y="40" width="3" height="14" rx="1.5" fill="#6fd06f" />
        </g>
      )}
      {wave && <g className="wavepaw" style={{ transformOrigin: '86px 74px' }}><ellipse cx="86" cy="64" rx="7" ry="9" fill={HEAD} stroke={SHADE} strokeWidth="1.4" /><path d="M83 59 v4 M86 58 v5 M89 59 v4" stroke={SHADE} strokeWidth="1" strokeLinecap="round" /></g>}

      {fancy && <Outfits outfit={outfit} />}
    </svg>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Artwork mode. Drop the sliced PNGs from Gemini into src/assets/cat/ (see docs/CAT_ART_PROMPT.md) and Kitty uses
// them automatically; without them the drawn vector cat above is used. Frames are swapped, so fur and eye colour
// options only apply to the vector cat. Outfits are drawn on top of either.
// ---------------------------------------------------------------------------------------------------------------
const artFiles = import.meta.glob('./assets/cat/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const ART: Record<string, string> = Object.fromEntries(Object.entries(artFiles).map(([k, v]) => [k.split('/').pop()!.replace('.png', ''), v]))
export const HAS_ART = !!ART.normal

// artwork frame layout (see the prompt): head width 66% of the frame, centred at 50% / 58%, ear tips at about 20%
const OUTFIT_MAP = 'translate(50 58) scale(0.825) translate(-50 -48)'

function ArtCat({ size, follow, mood, dance, outfit, blink, wave }: { size: number; follow: boolean; mood: Mood; dance: boolean; outfit: Outfit; blink: boolean; wave: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [dir, setDir] = useState<'' | 'left' | 'right' | 'up' | 'down'>('')
  const [blinking, setBlinking] = useState(false)

  useEffect(() => { Object.values(ART).forEach((u) => { const i = new Image(); i.src = u }) }, []) // no flicker when swapping

  // look where the cursor is: pick the nearest of the four "look" frames
  useEffect(() => {
    if (!follow) { setDir(''); return }
    return window.kitty.onCursor(({ x, y }) => {
      const r = box.current?.getBoundingClientRect()
      if (!r) return
      const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2)
      const next = Math.hypot(dx, dy) < 90 ? '' : Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
      setDir((d) => (d === next ? d : next))
    })
  }, [follow])

  // blink every few seconds
  useEffect(() => {
    if (!blink || !ART.blink) return
    let t: number
    const loop = () => { t = window.setTimeout(() => { setBlinking(true); window.setTimeout(() => setBlinking(false), 130); loop() }, 3500 + Math.random() * 3000) }
    loop()
    return () => clearTimeout(t)
  }, [blink])

  const calm = mood === 'normal'
  const frame = wave && ART.wave ? 'wave' : calm && blinking && ART.blink ? 'blink' : calm && dir && ART['look-' + dir] ? 'look-' + dir : ART[mood] ? mood : 'normal'
  return (
    <div ref={box} className={dance ? 'dance' : ''} style={{ position: 'relative', width: size, height: size * 0.8, flexShrink: 0 }}>
      <img src={ART[frame]} alt="" draggable={false} style={{ position: 'absolute', left: 0, top: -size * 0.1, width: size, height: size, objectFit: 'contain', userSelect: 'none' }} />
      {size >= 60 && outfit !== 'none' && (
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', left: 0, top: -size * 0.1, width: size, height: size, overflow: 'visible' }}>
          <g transform={OUTFIT_MAP}><Outfits outfit={outfit} /></g>
        </svg>
      )}
    </div>
  )
}

// The cat everyone imports: artwork when it has been added, otherwise the drawn one
export default function Cat(props: CatProps) {
  return HAS_ART
    ? <ArtCat size={props.size ?? 36} follow={props.follow ?? true} mood={props.mood ?? 'normal'} dance={props.dance ?? false} outfit={props.outfit ?? 'none'} blink={props.blink ?? true} wave={props.wave ?? false} />
    : <VectorCat {...props} />
}
