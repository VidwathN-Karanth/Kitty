// Little equaliser used as the status light: still when idle, moving while something is going on,
// quick when Kitty needs you. The colour carries the meaning (orange = busy/asking, green = done, tan = music).
export default function Bars({ color, active, fast }: { color: string; active: boolean; fast?: boolean }) {
  return (
    <span className={'bars' + (active ? ' on' : '') + (fast ? ' fast' : '')} style={{ color }} aria-hidden>
      <i /><i /><i /><i />
    </span>
  )
}
