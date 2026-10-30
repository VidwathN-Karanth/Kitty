// Traffic-light sounds, generated with WebAudio so no audio files are needed
let ctx: AudioContext | null = null
let level = 1

export const setSoundLevel = (l: 'soft' | 'normal' | 'loud') => { level = l === 'soft' ? 0.45 : l === 'loud' ? 1.8 : 1 }

function tone(freq: number, at: number, len = 0.18, vol = 0.12) {
  ctx ??= new AudioContext()
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(vol * level, ctx.currentTime + at)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len)
}

export const sounds = {
  done: () => { tone(784, 0); tone(1175, 0.12, 0.3) },   // ding
  question: () => { tone(1568, 0, 0.25) },                // pling
  error: () => { tone(196, 0, 0.35, 0.18) },              // low
  fanfare: () => { tone(523, 0); tone(659, 0.1); tone(784, 0.2); tone(1047, 0.32, 0.4) },
}
