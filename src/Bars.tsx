// Little equaliser used as the status light: still when idle, moving while something is going on,
// quick when Kitty needs you. The colour carries the meaning (orange = busy/asking, green = done, tan = music).
export default function Bars({ color, active, fast, colors }: { color: string; active: boolean; fast?: boolean; colors?: string[] }) {
  const c = (i: number) => (colors?.length ? { background: colors[i % colors.length], boxShadow: `0 0 6px ${colors[i % colors.length]}` } : undefined)
  return (
    <span className={'bars' + (active ? ' on' : '') + (fast ? ' fast' : '')} style={{ color }} aria-hidden>
      <i style={c(0)} /><i style={c(1)} /><i style={c(2)} /><i style={c(3)} />
    </span>
  )
}
