import { useEffect, useState } from 'react'

const empty: Info = { weather: null, events: [], bt: [] }

// Weather, upcoming calendar events and Bluetooth battery levels (fetched in the main process)
export function useInfo() {
  const [info, setInfo] = useState<Info>(empty)
  useEffect(() => {
    window.kitty.info().then(setInfo)
    return window.kitty.onInfo(setInfo)
  }, [])
  return info
}

// "in 12 min", "now", "at 14:30"
export function when(start: number, end: number, now: number) {
  if (start <= now) return `now · ${Math.max(1, Math.round((end - now) / 60000))} min left`
  const m = Math.round((start - now) / 60000)
  return m < 60 ? `in ${m} min` : `at ${new Date(start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}
