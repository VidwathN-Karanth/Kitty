// Traffic-light dot: steady for done/error, pulsing while Claude works, pulsing fast when it needs you
export default function StatusDot({ color, kind }: { color: string; kind: 'question' | 'working' | 'error' | 'done' }) {
  return <span className={'sdot ' + kind} style={{ background: color, color }} role="status" aria-label={kind} />
}
