// A thin light around the island's sides and bottom while a song plays (the top edge touches the screen and stays
// dark). Two layers: a smooth, seamless blend of the colours that slowly circles the island, and a soft bright
// highlight running over it. Colours are mixed in OKLCH so neighbouring colours blend without muddy bands. They are
// drawn once and spun (see .runlight in style.css), which is much lighter than redrawing them every frame.
export default function RunningLight({ mode, palette }: { mode: 'adaptive' | 'rainbow' | 'white'; palette: string[] }) {
  const cols = mode === 'white' ? ['#ffffff', '#dfe6ff', '#ffffff', '#fff0e2'] : palette
  const loop = [...cols, cols[0]] // repeat the first colour at the end: no seam where the circle closes
  const stops = loop.map((c, i) => `${c} ${Math.round((i * 360) / (loop.length - 1))}deg`).join(', ')
  const glow = mode === 'white' ? '#ffffff' : `color-mix(in oklch, ${cols[0]} 40%, #ffffff)`
  const blend = `conic-gradient(in oklch, ${stops})`
  // highlight: fades in and out on both sides, so it never has a hard edge
  const comet = `conic-gradient(transparent 0deg, transparent 230deg, color-mix(in oklch, ${glow} 30%, transparent) 285deg, ${glow} 320deg, color-mix(in oklch, ${glow} 30%, transparent) 344deg, transparent 360deg)`
  return (
    <span className={'runlight ' + mode} aria-hidden>
      <i className="rl-blend"><b style={{ background: blend }} /></i>
      <i className="rl-blend soft"><b style={{ background: blend }} /></i>
      <i className="rl-comet"><b style={{ background: comet }} /></i>
    </span>
  )
}
