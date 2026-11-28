import { useEffect, useState } from 'react'

// The phone KDE Connect can reach right now, and how the last "send to phone" went.
// device: undefined = still looking, null = KDE Connect isn't installed, false = no phone reachable
export function usePhone() {
  const [device, setDevice] = useState<{ id: string; name: string } | null | false | undefined>(undefined)
  const [status, setStatus] = useState<PhoneStatus | null>(null)
  useEffect(() => {
    let live = true
    const look = () => window.kitty.phoneDevices().then((d) => { if (live) setDevice(d === null ? null : d[0] ?? false) }).catch(() => {})
    look()
    const t = setInterval(look, 10000)
    let clear: number | undefined
    const off = window.kitty.onPhoneStatus((s) => {
      setStatus(s); clearTimeout(clear)
      if (s.state === 'done') clear = window.setTimeout(() => setStatus(null), 4000)
    })
    return () => { live = false; clearInterval(t); clearTimeout(clear); off() }
  }, [])
  return { device, status, send: (paths: string[]) => window.kitty.phoneSend(paths) }
}

export const phoneLabel = (status: PhoneStatus | null, name?: string) =>
  !status ? '' : status.state === 'sending' ? `Sending ${status.count ?? ''} to ${name ?? 'phone'}…`.replace('  ', ' ')
    : status.ok ? `Sent to ${status.device}` : status.error ?? 'Couldn\'t send'
