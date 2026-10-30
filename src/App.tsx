import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings as Gear, Volume2, VolumeX, Plane, Mic, Video, LayoutGrid } from 'lucide-react'
import { TABS, TabId } from './tabs'
import Home from './Home'
import Cat, { Mood } from './Cat'
import Note from './Note'
import Tray from './Tray'
import Music from './Music'
import Claude from './Claude'
import Chat from './Chat'
import Bars from './Bars'
import RunningLight from './RunningLight'
import Battery from './Battery'
import Stats, { statItems } from './Stats'
import StatusDot from './StatusDot'
import Confetti from './Confetti'
import Volume from './Volume'
import Clipboard from './Clipboard'
import Focus, { FocusState } from './Focus'
import { wearing } from './catStyle'
import { useClaude, lightState } from './useClaude'
import { useMedia, RAINBOW, musicBackground } from './useMedia'
import { useSettings, lights } from './useSettings'
import { useUpdate, updateLabel } from './useUpdate'
import { useInfo } from './useInfo'
import { sounds, setSoundLevel } from './sound'

type Hud = 'vol' | 'air' | 'hi' | null

// A MacBook-style notch: flat against the top edge, rounded at the bottom, with small concave "ears" at the top corners
const SIZE = {
  closed: { width: 262, height: 34 }, hudVol: { width: 244, height: 34 }, hudAir: { width: 262, height: 34 }, hudHi: { width: 280, height: 34 },
  open: { width: 640, height: 300 },
}
const SPRINGS = {
  fast: { type: 'spring', stiffness: 520, damping: 36 },
  normal: { type: 'spring', stiffness: 300, damping: 30 },
} as const
const TAN = '#c9a574'
// the "little trick" the cat does when you open an app
const TRICKS: Partial<Record<TabId, Mood>> = { claude: 'focused', music: 'happy', chat: 'curious', focus: 'focused', tray: 'surprised', clipboard: 'curious', note: 'wink' }
const OUTFIT_STEPS = [5, 15, 30]

export default function App() {
  const { settings } = useSettings()
  const spring = SPRINGS[settings.speed]
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [volPop, setVolPop] = useState(false)
  const [hud, setHud] = useState<Hud>(null) // a quick status shown inside the collapsed notch
  const [tab, setTab] = useState<TabId>('home')
  const { media, tint, palette, bg } = useMedia()
  const hovered = useRef(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const hudTimer = useRef<number | undefined>(undefined)
  const openRef = useRef(false)
  openRef.current = open
  const cfg = useRef(settings) // latest settings for callbacks created once
  cfg.current = settings

  // collapsed notch: widen just enough to show a status, then settle back (no full expand)
  const flash = (kind: Exclude<Hud, null>, ms = 1800) => {
    setHud(kind)
    clearTimeout(hudTimer.current)
    hudTimer.current = window.setTimeout(() => setHud(null), ms)
  }
  // open the island for a few seconds (unless the mouse is on it), e.g. when something needs attention
  const peek = (ms: number, then?: () => void) => {
    setOpen(true)
    clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => { if (!hovered.current) { setOpen(false); then?.() } }, ms)
  }
  const confetti = () => { if (cfg.current.confetti) window.dispatchEvent(new Event('kitty-confetti')) }

  // --- mood overrides ---
  const [demo, setDemo] = useState<Mood | null>(null)
  const [trick, setTrick] = useState<Mood | null>(null)
  const demoTimer = useRef<number | undefined>(undefined)
  const trickTimer = useRef<number | undefined>(undefined)
  const showMood = (m: Mood | null, ms = 3000) => { setDemo(m); clearTimeout(demoTimer.current); if (m) demoTimer.current = window.setTimeout(() => setDemo(null), ms) }

  const { data: claude, connected, loaded } = useClaude((e) => {
    const c = cfg.current
    if (e.type === 'error') {
      if (c.sounds) sounds.error()
      if (c.notifications) new Notification('Claude Code', { body: `${e.project}: something went wrong` })
    } else {
      if (c.sounds) e.type === 'question' ? sounds.question() : sounds.done()
      if (c.notifications && e.type === 'question') new Notification('Claude Code', { body: `${e.project}: ${e.message ?? 'needs you'}` })
      if (e.type === 'done' && (e.ms ?? 0) > 10 * 60000) { confetti(); showMood('excited', 4000) } // a long task deserves a party
    }
    if (e.type !== 'question' || !c.apps.claude || !c.peekOnQuestion) return // finished or failed: just the sound and the dot
    setTab('claude'); peek(8000)
  })
  const update = useUpdate()
  const info = useInfo()
  const island = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())
  const [focus, setFocus] = useState<FocusState>({ mins: 25, endAt: null, left: 25 * 60000 })
  const [used, setUsed] = useState(0)
  const [sys, setSys] = useState<SysStats>({ cpu: null, ram: null, ramUsed: 0, ramTotal: 0, gpu: null })
  useEffect(() => { window.kitty.stats().then(setSys); return window.kitty.onStats(setSys) }, [])
  const [fakeAir, setFakeAir] = useState<boolean | null>(null)
  const air = fakeAir ?? media.air

  useEffect(() => { setSoundLevel(settings.soundLevel) }, [settings.soundLevel])

  const tabs = TABS.filter((t) => t.id === 'home' || settings.apps[t.id as keyof Settings['apps']])
  useEffect(() => { if (!tabs.some((t) => t.id === tab)) setTab('home') }, [tabs.length])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    window.kitty.onToggle(() => setOpen((o) => !o))
    const offGoto = window.kitty.onGoto((id) => { setTab(id as TabId); peek(6000) }) // global shortcuts jump straight to a tab
    window.kitty.usage().then(setUsed)
    const offUsage = window.kitty.onUsage(setUsed)
    if (cfg.current.startupAnim) flash('hi', 2800)
    return () => { clearInterval(t); offGoto(); offUsage() }
  }, [])

  // Focus timer finished: notify and reset. State lives here so it keeps running on other tabs.
  useEffect(() => {
    if (focus.endAt && now.getTime() >= focus.endAt) {
      if (settings.notifications) new Notification('Kitty', { body: 'Focus block finished. Nice work!' })
      if (settings.sounds) sounds.fanfare()
      confetti(); showMood('happy', 4000)
      window.kitty.bump('focus')
      setFocus({ mins: focus.mins, endAt: null, left: focus.mins * 60000 })
    }
  }, [now, focus])

  // Tell the main process where the island is so it can decide what is click-through
  useEffect(() => {
    const el = island.current!
    const send = () => { const r = el.getBoundingClientRect(); window.kitty.rect({ x: r.left, y: r.top, w: r.width, h: r.height }) }
    const ro = new ResizeObserver(send)
    ro.observe(el)
    send()
    return () => ro.disconnect()
  }, [])

  useEffect(() => { window.kitty.track(settings.follow) }, [settings.follow])

  // The cat does a little trick when you open an app
  useEffect(() => {
    if (!open || !settings.appAnim) return
    const m = TRICKS[tab]
    if (!m) return
    setTrick(m); clearTimeout(trickTimer.current)
    trickTimer.current = window.setTimeout(() => setTrick(null), 1400)
  }, [tab, open])

  // New outfit earned: celebrate
  const prevTotal = useRef<number | null>(null)
  useEffect(() => {
    if (!loaded) return
    const t = claude.stats.total
    if (prevTotal.current !== null && OUTFIT_STEPS.some((n) => prevTotal.current! < n && t >= n)) {
      confetti(); showMood('excited', 4000)
      if (cfg.current.sounds) sounds.fanfare()
      if (cfg.current.notifications) new Notification('New outfit!', { body: `${cfg.current.name} earned something new to wear` })
    }
    prevTotal.current = t
  }, [claude.stats.total, loaded])

  // Volume changed (keyboard keys etc.): show it inside the notch
  const prevVol = useRef<number | undefined>(undefined)
  useEffect(() => {
    const v = media.vol?.v
    if (v === undefined) return
    const first = prevVol.current === undefined
    const changed = prevVol.current !== v
    prevVol.current = v
    if (first || !changed || !cfg.current.volumeBar || openRef.current) return
    flash('vol')
  }, [media.vol?.v, media.vol?.mute])

  // Airplane mode switched on/off: same quick flash, and a plane stays in the notch while it is on
  const prevAir = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    if (air === undefined) return
    const first = prevAir.current === undefined
    prevAir.current = air
    if (!first && !openRef.current) flash('air')
  }, [air])

  // Heads-up 5 minutes before a meeting
  const ms = now.getTime()
  const alerted = useRef(new Set<string>())
  useEffect(() => {
    for (const e of info.events) {
      const mins = (e.start - ms) / 60000
      if (mins > 0 && mins <= 5 && !alerted.current.has(e.id)) {
        alerted.current.add(e.id)
        if (cfg.current.sounds) sounds.question()
        if (cfg.current.notifications) new Notification(e.title, { body: `Starts in ${Math.ceil(mins)} min${e.link ? ' · open the island to join' : ''}` })
        setTab('home'); peek(10000)
      }
    }
  }, [now, info.events])

  // Low battery: the laptop (when not charging) and Bluetooth devices. Warns once, again below 10%, and re-arms after charging.
  const [laptop, setLaptop] = useState<{ level: number; charging: boolean } | null>(null)
  const warned = useRef(new Map<string, number>()) // device -> lowest threshold already warned about
  const warnBattery = (name: string, level: number) => {
    const c = cfg.current
    if (c.notifications) new Notification('Battery low', { body: `${name} is at ${level}%` })
    if (c.sounds) sounds.error()
    showMood('sad', 5000); peek(6000)
  }
  useEffect(() => {
    let b: any, stop = false
    const read = () => setLaptop({ level: Math.round(b.level * 100), charging: b.charging })
    ;(navigator as any).getBattery?.().then((x: any) => { if (stop) return; b = x; read(); x.addEventListener('levelchange', read); x.addEventListener('chargingchange', read) })
    return () => { stop = true; b?.removeEventListener('levelchange', read); b?.removeEventListener('chargingchange', read) }
  }, [])
  useEffect(() => {
    if (!settings.batteryWarning) return
    const devices = [...(laptop && !laptop.charging ? [{ name: 'Laptop', level: laptop.level }] : []), ...info.bt]
    for (const d of devices) {
      const t = d.level <= 10 ? 10 : d.level <= 20 ? 20 : 100
      const prev = warned.current.get(d.name) ?? 100
      if (t < prev) { warned.current.set(d.name, t); warnBattery(d.name, d.level) }
      else if (d.level > 30) warned.current.delete(d.name)
    }
    if (laptop?.charging) warned.current.delete('Laptop')
  }, [laptop, info.bt, settings.batteryWarning])

  // 5-hour usage warning (against the budget chosen in Settings)
  const usagePct = Math.round((used / Math.max(1, settings.usageBudget)) * 100)
  const usageWarned = useRef(false)
  useEffect(() => {
    if (!settings.warnAt) return
    if (usagePct >= settings.warnAt && !usageWarned.current) {
      usageWarned.current = true
      // at most once per 5 hours, even across restarts, and never pops the island open
      let last = 0
      try { last = Number(localStorage.getItem('kitty-usage-warned') || 0) } catch {}
      if (Date.now() - last > 5 * 3600 * 1000) {
        try { localStorage.setItem('kitty-usage-warned', String(Date.now())) } catch {}
        if (cfg.current.notifications) new Notification('Claude usage', { body: `You've used about ${usagePct}% of your 5-hour budget` })
        if (cfg.current.sounds) sounds.error()
        showMood('scared', 4000)
      }
    } else if (usagePct < settings.warnAt - 15) usageWarned.current = false
  }, [usagePct, settings.warnAt])

  // Test mode buttons in Settings
  useEffect(() => window.kitty.onTest((kind) => {
    if (kind === 'battery') warnBattery('Test device', 9)
    else if (kind === 'air-on' || kind === 'air-off') { setFakeAir(kind === 'air-on'); setTimeout(() => setFakeAir(null), 8000) }
    else if (kind === 'vol') flash('vol')
    else if (kind === 'hi') flash('hi', 2800)
    else if (kind === 'confetti') { confetti(); showMood('excited', 4000) }
    else if (kind === 'usage') { showMood('scared', 4000); peek(5000) }
  }), [])

  // --- mood: demo > Claude's state > startup greeting > app trick > music > sleep > hunger ---
  const [idleMs, setIdleMs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => window.kitty.idle().then(setIdleMs), 5000)
    return () => clearInterval(t)
  }, [])
  const sleepMs = settings.sleepMins * 60000
  const sleepy = settings.sleepEffect && sleepMs > 0
  const asleep = sleepy && sleepMs - idleMs <= 0, drowsy = sleepy && sleepMs - idleMs <= 60000
  const cs = claude.sessions
  const m = media.state
  const light = lightState(cs, ms, lights(settings))
  const wantMood: Mood = demo
    ?? (cs.some((s) => s.state === 'question') ? 'surprised'
      : cs.some((s) => s.state === 'error' && s.endedAt && ms - s.endedAt < 15000) ? 'sad'
      : cs.some((s) => s.state === 'done' && s.endedAt && ms - s.endedAt < 6000) ? 'happy'
      : m.playing && settings.dancing ? 'listening'
      : cs.some((s) => s.state === 'working') ? 'focused'
      : hud === 'hi' ? 'happy'
      : trick
      ?? (asleep ? 'asleep' : drowsy ? 'sleepy'
      : settings.hunger && claude.stats.hunger < 10 ? 'sad'
      : 'normal'))
  const mood: Mood = settings.faces || demo ? wantMood : 'normal' // "Faces" off = plain eyes (except when you try one out)
  const dance = settings.dancing && mood === 'listening'
  const look = { body: settings.bodyColor, eyes: settings.eyeColor, outfit: wearing(settings, claude.stats.total, now) }

  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '')
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const cur = TABS.find((t) => t.id === tab)!
  const label = (id: string, l: string) => (id === 'chat' ? settings.name : l)
  const [t1, t2] = cur.id === 'chat' ? [`${settings.name} `, 'Chat'] : cur.title
  const priv = settings.privacyDot ? media.priv : undefined
  const volIcon = media.vol?.mute || !media.vol?.v ? <VolumeX size={18} /> : <Volume2 size={18} />

  // left slot of the collapsed notch: what is being flashed, else small status icons that stay (plane, mic, camera)
  const leftIcons = !open && (
    hud === 'vol' ? volIcon
      : hud === 'air' ? <Plane size={17} color="#ffb04a" />
      : <>{settings.statsRest && <Stats s={sys} on={settings.stats} compact />}{air && <Plane size={16} color="#ffb04a" />}{priv?.mic && <span className="pdot mic"><Mic size={11} /></span>}{priv?.cam && <span className="pdot cam"><Video size={11} /></span>}</>
  )

  return (
    <div className="stage">
      <Confetti />
      <motion.div
        ref={island}
        className="island"
        initial={false}
        animate={open ? SIZE.open : hud === 'vol' ? SIZE.hudVol : hud === 'air' ? SIZE.hudAir : hud === 'hi' ? SIZE.hudHi : { width: SIZE.closed.width + (settings.statsRest ? statItems(sys, settings.stats).length * 56 : 0), height: SIZE.closed.height }}
        transition={spring}
        onMouseEnter={() => { hovered.current = true; setHud(null); setOpen(true) }}
        onDragEnter={() => { setOpen(true); setTab('tray') }}
        onMouseLeave={() => { hovered.current = false; setOpen(false); setMenu(false); setVolPop(false) }}
      >
        <i className="ear l" /><i className="ear r" />
        <motion.div
          className="shell"
          initial={false}
          animate={{ borderBottomLeftRadius: open ? 34 : 16, borderBottomRightRadius: open ? 34 : 16 }}
          transition={spring}
          style={{ background: tab === 'music' && open && bg.length ? musicBackground(bg) : tab === 'music' && open && tint ? `linear-gradient(180deg, #000 30%, ${tint})` : '#000', transition: 'background 600ms' }}
        >
          {media.state.playing && settings.musicGlow !== 'off' && <RunningLight mode={settings.musicGlow} palette={settings.musicGlow === 'rainbow' ? RAINBOW : palette} />}
          <div className={'bar' + (hud && !open ? ' compact' : !open ? ' rest' : '')}>
            <span className="title">{leftIcons}{open && tab !== 'home' && <>{t1}<span style={{ color: cur.color }}>{t2}</span></>}</span>
            <span className="mid">
              <Cat size={34} follow={settings.follow} light={light?.color} mood={mood} dance={dance} blink={settings.blinking} wave={hud === 'hi'} body={look.body} eyes={look.eyes} />
              {open && settings.showBattery && laptop && <Battery level={laptop.level} charging={laptop.charging} />}
              {open && settings.apps.clock && <span className="clock">{date} <b>{time}</b></span>}
            </span>
            <span className="right">
              {hud === 'air' && !open ? <span className="hud"><b className="air-t">Airplane mode {air ? 'on' : 'off'}</b></span>
                : hud === 'hi' && !open ? <span className="hud"><b className="air-t">Hi, I&apos;m {settings.name}!</b></span>
                : hud === 'vol' && !open ? <span className="hud"><span className="hud-track"><i style={{ width: `${(media.vol?.mute ? 0 : media.vol?.v ?? 0) * 100}%` }} /></span><b>{Math.round((media.vol?.mute ? 0 : media.vol?.v ?? 0) * 100)}</b></span>
                : <>
                    {!open && settings.showBattery && laptop && <Battery level={laptop.level} charging={laptop.charging} />}
                    <span className="grow" />
                    {open && air && <Plane size={16} color="#ffb04a" aria-label="Airplane mode" />}
                    {open && priv?.mic && <span className="pdot mic"><Mic size={11} /></span>}
                    {open && priv?.cam && <span className="pdot cam"><Video size={11} /></span>}
                    {light && <StatusDot color={light.color} kind={light.kind} />}
                    {m.playing && <Bars color={TAN} active colors={settings.musicGlow === 'adaptive' ? palette : RAINBOW} />}
                  </>}
              {open && <button className="dots" onClick={() => setMenu((x) => !x)} aria-label="Menu">{'•••'}{update.state === 'ready' && <i className="upd-dot" />}</button>}
            </span>
          </div>

          {open && (
            <>
              <div className="view">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    {tab === 'home' ? <Home focus={focus} now={ms} media={media} claude={claude} info={info} hasCalendar={!!settings.calendarUrl} setFocus={setFocus} go={(t) => setTab(t)} connected={connected} sys={settings.statsOpen ? sys : null} statsOn={settings.stats} />
                      : tab === 'focus' ? <Focus f={focus} set={setFocus} now={ms} />
                      : tab === 'claude' ? <Claude data={claude} connected={connected} now={ms} usage={{ pct: usagePct, used, budget: settings.usageBudget }} />
                      : tab === 'music' ? <Music media={media} now={ms} />
                      : tab === 'tray' ? <Tray />
                      : tab === 'clipboard' ? <Clipboard />
                      : tab === 'note' ? <Note />
                      : <Chat name={settings.name} follow={settings.follow} look={look} mood={mood} setMood={(x) => showMood(x, 6000)} blink={settings.blinking} />}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="tabs">
                {tabs.map((t) => {
                  const on = t.id === tab
                  return (
                    <button key={t.id} className="tab" onClick={() => setTab(t.id)} style={{ color: on ? t.color : '#8a8a8a' }} aria-label={t.label}>
                      {on && <motion.span layoutId="pill" className="pill" style={{ background: t.color + '2e' }} transition={spring} />}
                      <t.icon size={18} style={{ position: 'relative' }} />
                      {on && <span style={{ position: 'relative' }}>{label(t.id, t.label)}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="corner">
                <button title="Volume" onClick={() => setVolPop((v) => !v)}>{volIcon}</button>
                <button title="Settings" onClick={() => window.kitty.openSettings()}><Gear size={18} /></button>
              </div>
              <AnimatePresence>
                {volPop && <motion.div className="volpop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Volume vol={media.vol} /></motion.div>}
              </AnimatePresence>
            </>
          )}

          <AnimatePresence>
            {menu && (
              <motion.div className="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Volume vol={media.vol} wide />
                <button onClick={() => { window.kitty.openSettings('apps'); setMenu(false) }}><LayoutGrid size={16} />All apps</button>
                <button onClick={() => { window.kitty.openSettings(); setMenu(false) }}><Gear size={16} />Settings</button>
                <button className={update.state === 'ready' ? 'upd' : ''} disabled={update.state === 'dev' || update.state === 'checking' || update.state === 'downloading'} onClick={() => (update.state === 'ready' ? window.kitty.installUpdate() : window.kitty.checkUpdate())}>{updateLabel(update)}</button>
                {update.state === 'error' && <div className="err">{update.error}</div>}
                <button onClick={() => { setOpen(false); setMenu(false) }}>Fold in</button>
                <button className="quit" onClick={() => window.kitty.quit()}>Quit</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}
