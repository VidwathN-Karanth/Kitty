import { useEffect, useState } from 'react'

const none: Media = { state: { active: false }, art: null, vol: null }

// Average colour of the album art, used to tint the island
function averageColor(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 8
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, 8, 8)
      const d = g.getImageData(0, 0, 8, 8).data
      let r = 0, gr = 0, b = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2] }
      const n = d.length / 4
      resolve(`rgb(${Math.round((r / n) * 0.75)}, ${Math.round((gr / n) * 0.75)}, ${Math.round((b / n) * 0.75)})`)
    }
    img.onerror = () => resolve('')
    img.src = src
  })
}

export function useMedia() {
  const [media, setMedia] = useState<Media>(none)
  const [tint, setTint] = useState('')

  useEffect(() => {
    window.kitty.media().then(setMedia)
    return window.kitty.onMedia(setMedia)
  }, [])

  const art = media.art
  useEffect(() => {
    if (!art) { setTint(''); return }
    averageColor(`data:${art.mime};base64,${art.data}`).then(setTint)
  }, [art?.data])

  return { media, tint }
}
