import { useEffect, useRef } from 'react'

const COLORS = ['#f0a030', '#5fe05f', '#6ec6ff', '#ff6fae', '#b79bff', '#ffd84a']

// Fire with: window.dispatchEvent(new Event('kitty-confetti')). Draws on a see-through canvas over the island window.
export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!
    let parts: { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; life: number }[] = []
    let raf = 0
    const frame = () => {
      g.clearRect(0, 0, cv.width, cv.height)
      parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 20)
      for (const p of parts) {
        p.vy += 0.18; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life / 40); g.fillStyle = p.c
        g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore()
      }
      raf = parts.length ? requestAnimationFrame(frame) : 0
    }
    const burst = () => {
      for (let i = 0; i < 110; i++) {
        const a = Math.PI * (0.15 + Math.random() * 0.7) // fan out downwards from the notch
        const sp = 3 + Math.random() * 6
        parts.push({ x: cv.width / 2, y: 18, vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * sp * 0.6, r: 3 + Math.random() * 3, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 90 + Math.random() * 60 })
      }
      if (!raf) raf = requestAnimationFrame(frame)
    }
    window.addEventListener('kitty-confetti', burst)
    return () => { window.removeEventListener('kitty-confetti', burst); cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={ref} width={720} height={360} className="confetti" />
}
