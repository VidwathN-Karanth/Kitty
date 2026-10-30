import { useEffect, useState } from 'react'

export function useUpdate() {
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle', current: '' })
  useEffect(() => {
    window.kitty.updateStatus().then(setUpdate)
    return window.kitty.onUpdate(setUpdate)
  }, [])
  return update
}

// Text and action for the menu entry
export function updateLabel(u: UpdateStatus) {
  switch (u.state) {
    case 'dev': return 'Updates (installed app only)'
    case 'checking': return 'Checking for updates…'
    case 'downloading': return `Downloading update ${u.percent ?? 0}%`
    case 'ready': return `Restart & update to v${u.version}`
    case 'uptodate': return `Up to date · v${u.current}`
    case 'error': return 'Update check failed · retry'
    default: return 'Check for updates'
  }
}
