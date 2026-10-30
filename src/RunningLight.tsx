// A thin light around the island's sides and bottom while a song plays (the top edge touches the screen and stays
// dark). Two layers: a smooth, seamless blend of the colours that slowly circles the island, and a soft bright
// highlight running over it. Colours are mixed in OKLCH so neighbouring colours blend without muddy bands.
export default function RunningLight({ mode, palette }: { mode: 'adaptive' | 'rainbow' | 'white'; palette: string[] }) {
  const cols = mode === 'white' ? ['#ffffff', '#dfe6ff', '#ffffff', '#fff0e2'] : palette
  const loop = [...cols, cols[0]] // repeat the first colour at the end: no seam where the circle closes
  const stops = loop.map((c, i) => `${c} ${Math.round((i * 360) / (loop.length - 1))}deg`).join(', ')
  const glow = mode === 'white' ? '#ffffff' : `color-mix(in oklch, ${cols[0]} 40%, #ffffff)`
  const style = {
    // only the colour lists are passed down; each ring builds its own gradient from its own animated angle
    ['--stops' as string]: stops,
    // highlight: fades in and out on both sides, so it never has a hard edge
    ['--cstops' as string]: `transparent 0deg, transparent 230deg, color-mix(in oklch, ${glow} 30%, transparent) 285deg, ${glow} 320deg, color-mix(in oklch, ${glow} 30%, transparent) 344deg, transparent 360deg`,
  }
  return (
    <span className={'runlight ' + mode} aria-hidden style={style}>
      <i className="rl-blend" /><i className="rl-blend soft" /><i className="rl-comet" />
    </span>
  )
}
