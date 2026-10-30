// A light that runs around the island's sides and bottom while a song plays (the top edge stays dark, it touches
// the screen edge). 'adaptive' uses the album art's colours, 'rainbow' every colour, 'white' a plain white light.
export default function RunningLight({ mode, palette }: { mode: 'adaptive' | 'rainbow' | 'white'; palette: string[] }) {
  const cols = mode === 'white' ? ['#ffffff'] : palette
  // a bright comet followed by a soft tail; for colour modes the comet cycles through the colours
  const comet = mode === 'white'
    ? 'transparent 0deg, transparent 220deg, #ffffff55 290deg, #ffffff 350deg, transparent 360deg'
    : `transparent 0deg, ${cols.map((c, i) => `${c} ${150 + (i * 205) / Math.max(1, cols.length - 1)}deg`).join(', ')}, transparent 360deg`
  const style = { ['--comet' as string]: `conic-gradient(from var(--run), ${comet})` }
  return (
    <span className="runlight" aria-hidden style={style}>
      <i className="rl-ring" /><i className="rl-ring soft" />
    </span>
  )
}
