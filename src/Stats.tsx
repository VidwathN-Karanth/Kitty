// CPU / RAM / GPU usage chips. CPU and GPU in %, RAM in GB used. Colour follows the load: calm under 50%, amber under 80%, red above.
const tone = (v: number) => (v >= 80 ? '#ff5a4d' : v >= 50 ? '#ffb340' : '#7fe08a')

export function statItems(s: SysStats, on: Settings['stats']) {
  return ([['cpu', 'CPU', s.cpu], ['ram', 'RAM', s.ram], ['gpu', 'GPU', s.gpu]] as const)
    .filter(([k, , v]) => on[k] && v !== null && v !== undefined) as unknown as [keyof Settings['stats'], string, number][]
}

export default function Stats({ s, on, compact = false }: { s: SysStats; on: Settings['stats']; compact?: boolean }) {
  const items = statItems(s, on)
  if (!items.length) return null
  return (
    <span className={'stats' + (compact ? ' compact' : '')}>
      {items.map(([k, label, v]) => (
        <span key={k} className="stat" title={k === 'ram' ? `RAM ${s.ramUsed} of ${s.ramTotal} GB` : `${label} ${v}%`}>
          <small>{label}</small>
          {!compact && <i className="stat-bar"><i style={{ width: `${v}%`, background: tone(v) }} /></i>}
          <b style={{ color: tone(v) }}>{k === 'ram' ? (compact ? `${s.ramUsed}G` : `${s.ramUsed} GB`) : `${v}${compact ? '' : '%'}`}</b>
        </span>
      ))}
    </span>
  )
}
