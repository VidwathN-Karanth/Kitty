import { useEffect, useState } from 'react'

const none: Media = { state: { active: false }, art: null, vol: null }

// Colourful default when a song has no artwork
export const RAINBOW = ['#ff4d6d', '#ffb340', '#f9f871', '#4dffa6', '#4dc8ff', '#a66bff']

type Look = { tint: string; palette: string[]; bg: string[] }
const EMPTY: Look = { tint: '', palette: [], bg: [] }

// Reads the album art once per song and returns:
//  - palette: up to 4 vivid versions of its main colours, for the running light and the bars
//  - bg:      the real average colour of each of those groups, for the Music tab background
// Pixels are grouped by hue; grey, very dark and washed-out pixels are ignored.
function readArt(src: string): Promise<Look> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const S = 40, c = document.createElement('canvas'); c.width = c.height = S
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0, S, S)
      const d = g.getImageData(0, 0, S, S).data
      let r = 0, gr = 0, b = 0
      const bins = Array.from({ length: 12 }, () => ({ w: 0, h: 0, r: 0, g: 0, b: 0, n: 0 }))
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; gr += d[i + 1]; b += d[i + 2]
        const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, ch = mx - mn
        if (ch < 0.1 || l < 0.1 || l > 0.95) continue
        const s = ch / (1 - Math.abs(2 * l - 1))
        let h = mx === R ? ((G - B) / ch) % 6 : mx === G ? (B - R) / ch + 2 : (R - G) / ch + 4
        h = (h * 60 + 360) % 360
        const bin = bins[Math.floor(h / 30) % 12]
        bin.w += s; bin.h += h * s; bin.r += d[i]; bin.g += d[i + 1]; bin.b += d[i + 2]; bin.n++
      }
      const n = d.length / 4
      const top = bins.filter((x) => x.w > 2.5).sort((a, z) => z.w - a.w).slice(0, 4)
      resolve({
        tint: `rgb(${Math.round((r / n) * 0.75)}, ${Math.round((gr / n) * 0.75)}, ${Math.round((b / n) * 0.75)})`,
        palette: top.map((x) => `hsl(${Math.round(x.h / x.w)} 92% 63%)`),
        bg: top.map((x) => `rgb(${Math.round(x.r / x.n)}, ${Math.round(x.g / x.n)}, ${Math.round(x.b / x.n)})`),
      })
    }
    img.onerror = () => resolve(EMPTY)
    img.src = src
  })
}

export function useMedia() {
  const [media, setMedia] = useState<Media>(none)
  const [look, setLook] = useState<Look>(EMPTY)

  useEffect(() => {
    window.kitty.media().then(setMedia)
    return window.kitty.onMedia(setMedia)
  }, [])

  const art = media.art
  useEffect(() => {
    if (!art) { setLook(EMPTY); return }
    readArt(`data:${art.mime};base64,${art.data}`).then(setLook)
  }, [art?.data])

  // always at least two colours so the light has something to blend
  const palette = look.palette.length >= 2 ? look.palette : look.palette.length === 1 ? [look.palette[0], '#ffffff'] : RAINBOW
  return { media, tint: look.tint, palette, bg: look.bg }
}

// Background for the Music tab: the album's own colours, softly blended, darkened enough for white text,
// and fading to black at the top so it melts into the notch
export function musicBackground(bg: string[]) {
  if (!bg.length) return ''
  const [a, b = bg[0], c = bg[1] ?? bg[0]] = bg
  const deep = (x: string, k: number) => `color-mix(in oklab, ${x} ${k}%, #000)`
  return [
    'linear-gradient(180deg, #000 0%, rgb(0 0 0 / 0.55) 18%, rgb(0 0 0 / 0.15) 55%, rgb(0 0 0 / 0.35) 100%)',
    `radial-gradient(90% 110% at 12% 100%, ${deep(a, 70)} 0%, transparent 72%)`,
    `radial-gradient(80% 110% at 92% 85%, ${deep(b, 62)} 0%, transparent 70%)`,
    `linear-gradient(115deg in oklab, ${deep(c, 45)} 0%, ${deep(a, 50)} 50%, ${deep(b, 45)} 100%)`,
  ].join(', ')
}
