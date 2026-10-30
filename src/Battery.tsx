// Laptop battery next to the cat: outline + fill, green with a bolt while charging, amber when low, red when almost empty
export default function Battery({ level, charging, text = true }: { level: number; charging: boolean; text?: boolean }) {
  const color = charging ? '#5fe05f' : level <= 15 ? '#e5483d' : level <= 30 ? '#f0a030' : '#e8e8e8'
  return (
    <span className={'batt' + (level <= 15 && !charging ? ' low' : '')} title={`Battery ${level}%${charging ? ' (charging)' : ''}`} style={{ color }}>
      <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden>
        <rect x=".75" y=".75" width="20" height="10.5" rx="3.2" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.4" />
        <rect x="21.6" y="3.6" width="1.8" height="4.8" rx=".9" fill="currentColor" fillOpacity=".5" />
        <rect x="2.3" y="2.3" width={Math.max(1.5, (16.9 * level) / 100)} height="7.4" rx="1.9" fill="currentColor" />
        {charging && <path d="M11.8 2.4 L7.6 6.5 H10.3 L9.4 9.6 L13.9 5.2 H11.2 Z" fill="#06210a" />}
      </svg>
      {text && <b>{level}</b>}
    </span>
  )
}
