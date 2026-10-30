import { useEffect, useState } from 'react'

const empty: ClaudeData = { sessions: [], stats: { total: 0, today: 0, streak: 0, hunger: 80, counters: { focus: 0, dj: 0, answers: 0 }, flags: {}, runs: [] } }

export function useClaude(onEvent: (e: ClaudeEvent) => void) {
  const [data, setData] = useState<ClaudeData>(empty)
  const [connected, setConnected] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.kitty.claude().then((d) => { setData(d); setLoaded(true) })
    window.kitty.claudeInstalled().then(setConnected)
    const offA = window.kitty.onClaude(setData)
    const offB = window.kitty.onClaudeEvent(onEvent)
    return () => { offA(); offB() }
  }, [])

  const toggle = async () => {
    const r = await window.kitty.claudeSetInstalled(!connected)
    setConnected(r.installed)
    return r.error
  }
  return { data, connected, loaded, toggle }
}

// Most relevant session: waiting on you > error > working > most recently updated
export function pickSession(sessions: ClaudeSession[]) {
  const rank = (s: ClaudeSession) => (s.state === 'question' ? 3 : s.state === 'error' ? 2 : s.state === 'working' ? 1 : 0)
  return [...sessions].sort((a, b) => rank(b) - rank(a) || b.updatedAt - a.updatedAt)[0]
}

export type Lights = { work: string; done: string; error: string }

// The traffic light: what colour should the status dot / eyes show right now (null = nothing going on)
export function lightState(sessions: ClaudeSession[], now: number, c: Lights): { color: string; kind: 'question' | 'working' | 'error' | 'done' } | null {
  if (sessions.some((s) => s.state === 'question')) return { color: c.work, kind: 'question' }
  if (sessions.some((s) => s.state === 'error' && s.endedAt && now - s.endedAt < 15000)) return { color: c.error, kind: 'error' }
  if (sessions.some((s) => s.state === 'working')) return { color: c.work, kind: 'working' }
  if (sessions.some((s) => s.state === 'done' && s.endedAt && now - s.endedAt < 8000)) return { color: c.done, kind: 'done' }
  return null
}
