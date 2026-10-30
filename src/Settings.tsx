import { ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Home, Plug, MessageCircle, LayoutGrid, SlidersHorizontal, Cat as CatIcon, Shirt, Newspaper, Lock, Check, Search, Sun, Moon, Music, Timer,
  Inbox, Copy, FileText, Clock, Settings as Gear, Sparkles, Bot, ChevronRight, Play,
} from 'lucide-react'
import Cat, { EMOTIONS, Mood } from './Cat'
import ClaudeMark from './ClaudeMark'
import { useSettings, LIGHT_PRESETS, LIGHT_SWATCHES } from './useSettings'
import { useClaude, pickSession } from './useClaude'
import { useUpdate, updateLabel } from './useUpdate'
import { useInfo } from './useInfo'
import { BODY, EYE, OUTFITS, wearing } from './catStyle'
import { sounds, setSoundLevel } from './sound'
import './settings.css'

const PAGES = [
  { id: 'home', label: 'Home', icon: Home, group: 0 },
  { id: 'connections', label: 'Connections', icon: Plug, group: 0 },
  { id: 'ai', label: 'AI & Chat', icon: MessageCircle, group: 0 },
  { id: 'apps', label: 'Apps', icon: LayoutGrid, group: 0 },
  { id: 'kitty', label: 'Kitty', icon: CatIcon, group: 1 },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt, group: 1 },
  { id: 'general', label: 'General', icon: SlidersHorizontal, group: 2 },
  { id: 'news', label: 'News', icon: Newspaper, group: 2 },
] as const
type PageId = (typeof PAGES)[number]['id']

const SUB: Record<PageId, string> = {
  home: 'Kitty keeps an eye on your AI and tells you when it is done or has a question',
  connections: 'Which AIs Kitty keeps an eye on for you',
  ai: "Which AI Kitty's chat talks to",
  apps: 'Pick which apps are in your island',
  kitty: 'Name, eyes, behaviour and badges',
  wardrobe: 'Pick what Kitty wears. Kitty tries it on right away.',
  general: 'Notifications, animations, shortcuts and the island',
  news: "What's new in Kitty",
}

const APPS: { id: keyof Settings['apps']; title: string; desc: string; icon: typeof Home; tone: string }[] = [
  { id: 'music', title: 'Music', desc: 'What is playing, with controls. Kitty puts on headphones.', icon: Music, tone: '#6fd06f' },
  { id: 'claude', title: 'Claude Code', desc: 'Kitty shows whether Claude is busy, has a question or is done.', icon: Bot, tone: '#d97757' },
  { id: 'focus', title: 'Focus', desc: 'A focus timer. Kitty keeps distractions away for a while.', icon: Timer, tone: '#e0a050' },
  { id: 'chat', title: 'Kitty chat', desc: 'Ask Kitty things: explain, spelling, translate, summarize.', icon: MessageCircle, tone: '#6fd06f' },
  { id: 'tray', title: 'Tray', desc: 'Drop files into the island and grab them again later.', icon: Inbox, tone: '#6a8cff' },
  { id: 'clipboard', title: 'Clipboard', desc: 'Your last copies. Click one to copy it again.', icon: Copy, tone: '#58b6a0' },
  { id: 'note', title: 'Note', desc: 'One quick note, always at hand.', icon: FileText, tone: '#e8c35a' },
  { id: 'clock', title: 'Clock', desc: 'The date and time in the island header.', icon: Clock, tone: '#8a7eff' },
]

const TIPS = [
  ['Clipboard', 'Copy some text, then open Kitty chat and pick Explain, Check my spelling, Translate or Summarize.'],
  ['Shortcuts', 'Ctrl+Alt+T opens the island from anywhere. Change any shortcut under General.'],
  ['Music', 'Play something in Spotify: Kitty puts on headphones.'],
  ['Outfits', 'Finish Claude Code tasks to unlock a party hat, sunglasses and a crown.'],
]

const NEWS = [
  { v: '0.1.0', d: 'Today', items: ['Notch-style island with the cat, Claude Code tracking, music, volume, airplane mode and mic/camera dots', 'Wardrobe, badges, hunger and 20 emotions', 'Weather, calendar, meeting join and battery warnings', 'Rebindable shortcuts and a Test mode to try every state'] },
]

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button className={'tg' + (on ? ' on' : '')} disabled={disabled} onClick={() => onChange(!on)} role="switch" aria-checked={on}><i /></button>
}
function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
}
function Row({ title, desc, children, id }: { title: string; desc?: ReactNode; children?: ReactNode; id?: string }) {
  return <div className="row" data-row={id ?? title}><div><b>{title}</b>{desc && <p>{desc}</p>}</div><div className="ctl">{children}</div></div>
}
const Group = ({ title, children }: { title?: string; children: ReactNode }) => <>{title && <h3>{title}</h3>}<div className="group">{children}</div></>

// Turns a key press into an Electron accelerator like "Ctrl+Alt+Shift+1"
function accel(e: React.KeyboardEvent): string | null {
  const c = e.code
  let key = ''
  if (/^Key[A-Z]$/.test(c)) key = c.slice(3)
  else if (/^Digit\d$/.test(c)) key = c.slice(5)
  else if (/^F\d{1,2}$/.test(c)) key = c
  else if (c === 'Space') key = 'Space'
  else if (c.startsWith('Arrow')) key = c.slice(5)
  else if (['Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Insert'].includes(c)) key = c
  else if (c === 'Minus') key = '-'
  else if (c === 'Equal') key = '='
  else return null
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean) as string[]
  if (!mods.length && !/^F\d/.test(key)) return null // a plain letter would break typing everywhere
  return [...mods, key].join('+')
}
function ShortcutBox({ value, failed, onSet }: { value: string; failed: boolean; onSet: (a: string) => void }) {
  const [rec, setRec] = useState(false)
  return (
    <button className={'kbd' + (rec ? ' rec' : '') + (failed ? ' bad' : '')} title={failed ? 'Another app already uses this shortcut' : 'Click, then press the new keys'}
      onClick={() => setRec(true)} onBlur={() => setRec(false)}
      onKeyDown={(e) => {
        if (!rec) return
        e.preventDefault()
        if (e.key === 'Escape') return setRec(false)
        const a = accel(e)
        if (a) { onSet(a); setRec(false) }
      }}>
      {rec ? 'Press keys…' : value.split('+').join(' + ')}
    </button>
  )
}

const SHORTCUTS: [ShortcutKey, string][] = [['open', 'Open the island'], ['home', 'Home'], ['music', 'Music'], ['claude', 'Claude Code'], ['focus', 'Focus timer'], ['clipboard', 'Clipboard'], ['note', 'Note']]

export default function SettingsApp() {
  const [page, setPage] = useState<PageId>(() => { const p = new URLSearchParams(location.search).get('settings') as PageId; return PAGES.some((x) => x.id === p) ? p : 'home' })
  const { settings: s, set } = useSettings()
  const { data: claude, connected, toggle } = useClaude(() => {})
  const update = useUpdate()
  const info = useInfo()
  const [err, setErr] = useState('')
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [userDraft, setUserDraft] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [find, setFind] = useState('')
  const [trayCount, setTrayCount] = useState(0)
  const [city, setCity] = useState<string | null>(null)
  const [cal, setCal] = useState<string | null>(null)
  const [cli, setCli] = useState<{ claude: boolean; codex: boolean } | null>(null)
  const [preview, setPreview] = useState<Mood | null>(null)
  const [failed, setFailed] = useState<ShortcutKey[]>([])
  const [used, setUsed] = useState(0)

  useEffect(() => { window.kitty.tray().then((f) => setTrayCount(f.length)) }, [page])
  useEffect(() => { window.kitty.cli().then(setCli); window.kitty.usage().then(setUsed) }, [])
  useEffect(() => window.kitty.onUsage(setUsed), [])
  useEffect(() => window.kitty.onSettingsPage((p) => PAGES.some((x) => x.id === p) && setPage(p as PageId)), [])
  useEffect(() => window.kitty.onShortcutsFailed(setFailed), [])
  useEffect(() => { setSoundLevel(s.soundLevel) }, [s.soundLevel])

  const st = claude.stats
  const outfit = wearing(s, st.total)
  const look = { body: s.bodyColor, eyes: s.eyeColor, outfit }
  const session = pickSession(claude.sessions)
  const chip = !connected ? 'Claude Code off' : session?.state === 'working' ? 'Claude Code working' : session?.state === 'question' ? 'Claude Code has a question' : session?.state === 'error' ? 'Claude Code error' : 'Claude Code idle'
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const tip = TIPS[new Date().getDate() % TIPS.length]
  const light = s.theme === 'light'

  // 12 badges, earned from real activity
  const badges: { id: string; icon: string; title: string; desc: string; ok: boolean }[] = [
    { id: 'first', icon: '\u{1F3C1}', title: 'First task', desc: 'Claude Code finishes a task', ok: st.total >= 1 },
    { id: 'ten', icon: '\u{1F51F}', title: 'Ten tasks', desc: '10 tasks done', ok: st.total >= 10 },
    { id: 'fifty', icon: '\u{1F4AA}', title: 'Fifty tasks', desc: '50 tasks done', ok: st.total >= 50 },
    { id: 'helpful', icon: '\u{1F4AC}', title: 'Helpful', desc: 'Got 10 answers from Kitty chat', ok: st.counters.answers >= 10 },
    { id: 'night', icon: '\u{1F989}', title: 'Night owl', desc: 'A task done after midnight', ok: !!st.flags.night },
    { id: 'early', icon: '\u{1F426}', title: 'Early bird', desc: 'A task done before 7 am', ok: !!st.flags.early },
    { id: 'long', icon: '⏳', title: 'Long haul', desc: 'A task of more than 15 minutes', ok: !!st.flags.long },
    { id: 'focus', icon: '\u{1F3AF}', title: 'Focus master', desc: '5 focus blocks finished', ok: st.counters.focus >= 5 },
    { id: 'dj', icon: '\u{1F3A7}', title: 'DJ', desc: 'Controlled music 10 times from the island', ok: st.counters.dj >= 10 },
    { id: 'collector', icon: '\u{1F4C1}', title: 'Collector', desc: '5 files in the tray', ok: trayCount >= 5 },
    { id: 'roll', icon: '\u{1F525}', title: 'On a roll', desc: '3 days in a row', ok: st.streak >= 3 },
    { id: 'fashion', icon: '\u{1F451}', title: 'Fashion icon', desc: 'All outfits earned', ok: st.total >= 30 },
  ]
  const earned = badges.filter((b) => b.ok).length

  // search across all settings
  const index = useMemo(() => [
    ['general', 'Test mode', 'try everything without real Claude or music'], ['general', 'Speed', 'animation speed'], ['general', 'App animations', 'trick when you open an app'],
    ['general', 'Confetti', 'long tasks finished focus new outfits'], ['general', 'Traffic-light sounds', 'ding pling error sound'], ['general', 'Sound level', 'volume of the sounds'],
    ['general', 'Windows notifications', 'notifications'], ['general', 'Warn at limit', '5-hour usage limit budget'], ['general', 'Keyboard shortcuts', 'hotkeys keys'],
    ['general', 'Weather', 'city'], ['general', 'Calendar', 'ical google meetings'], ['general', 'Volume bar', 'volume'], ['general', 'Battery warning', 'laptop bluetooth'],
    ['general', 'Mic and camera dots', 'privacy'], ['general', 'Start with Windows', 'autostart login'], ['general', 'Reset everything', 'defaults'], ['general', 'Updates', 'version update'],
    ['kitty', 'Name', 'cat name your name'], ['kitty', 'Traffic-light eyes', 'colours classic soft colour-blind'], ['kitty', 'Faces', 'emotions expressions'], ['kitty', 'Blinking', ''],
    ['kitty', 'Dancing to music', 'headphones'], ['kitty', 'Sleep effect', 'falls asleep idle'], ['kitty', 'Startup animation', 'wave hi'], ['kitty', 'Hunger', 'food'],
    ['kitty', 'Badges', 'achievements'], ['wardrobe', 'Outfit', 'hat sunglasses crown'], ['wardrobe', 'Fur and eye colour', 'body'], ['wardrobe', 'Seasonal outfits', 'santa witch king'],
    ['apps', 'Apps', 'tabs toggles clock'], ['connections', 'Claude Code', 'hooks connect'], ['ai', 'Chat', 'claude codex'], ['news', 'News', 'whats new'],
  ] as [PageId, string, string][], [])
  const hits = find.trim() ? index.filter(([, t, d]) => (t + ' ' + d).toLowerCase().includes(find.trim().toLowerCase())).slice(0, 7) : []

  const test = (kind: string) => window.kitty.testRun(kind)
  const dev = update.state === 'dev'

  return (
    <div className={'sw' + (light ? ' light' : '')}>
      <nav>
        <div className="brand"><Cat size={36} follow={false} body={s.bodyColor} eyes={s.eyeColor} /> {s.name}</div>
        {[0, 1, 2].map((g) => (
          <div className="ngroup" key={g}>
            {g > 0 && <small>{g === 1 ? s.name : 'Settings'}</small>}
            {PAGES.filter((p) => p.group === g).map((p) => (
              <button key={p.id} className={p.id === page ? 'on' : ''} onClick={() => setPage(p.id)}><p.icon size={18} />{p.label}</button>
            ))}
          </div>
        ))}
        <div className="navfoot">
          <Cat size={32} follow={false} body={s.bodyColor} eyes={s.eyeColor} />
          <div><b>{s.name}</b><small>{st.total} tasks done</small></div>
          <button className="theme" onClick={() => set({ theme: light ? 'dark' : 'light' })} title="Light / dark" aria-label="Toggle theme">{light ? <Moon size={17} /> : <Sun size={17} />}</button>
        </div>
      </nav>

      <main>
        <header>
          <div><h1>{page === 'home' ? `${greeting}${s.userName ? ', ' + s.userName : ''}` : PAGES.find((p) => p.id === page)!.label}</h1><span>{SUB[page]}</span></div>
          <div className="finder">
            <Search size={16} /><input placeholder="Search" value={find} onChange={(e) => setFind(e.target.value)} />
            {hits.length > 0 && <div className="hits">{hits.map(([p, t], i) => <button key={i} onClick={() => { setPage(p); setFind('') }}>{t}<small>{PAGES.find((x) => x.id === p)!.label}</small></button>)}</div>}
          </div>
        </header>

        {page === 'home' && (
          <>
            <div className="tiles">
              <div className="tile"><b>{st.total}</b>tasks done</div>
              <div className="tile"><b>{st.today}</b>today</div>
              <div className="tile"><b>{st.streak}</b>days in a row</div>
              <div className={'chipstate ' + (session?.state ?? 'idle')}><ClaudeMark size={16} />{chip}</div>
            </div>
            <div className="cols">
              <div>
                <h3>Activity</h3>
                <input className="search" placeholder="Search your activity" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="group">
                  {st.runs.filter((r) => (r.prompt + r.project).toLowerCase().includes(q.toLowerCase())).map((r) => (
                    <div className="act" key={r.startedAt}>
                      <ClaudeMark size={20} color="#d97757" />
                      <div><div className="p">{r.prompt || '(no prompt)'}</div><small>{new Date(r.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {r.project} · {Math.max(1, Math.round(r.ms / 1000))} s</small></div>
                      <span className="ok">Done</span>
                    </div>
                  ))}
                  {st.runs.length === 0 && <div className="empty">{connected ? 'Nothing yet. Finish a Claude Code task and it shows up here.' : 'Turn on Claude Code under Connections to see your activity.'}</div>}
                </div>
              </div>
              <div>
                <div className="group quick">
                  {([['wardrobe', 'Wardrobe', Shirt], ['connections', 'Connections', Plug], ['general', 'General', SlidersHorizontal]] as const).map(([id, l, Ic]) => (
                    <button key={id} onClick={() => setPage(id)}><Ic size={18} />{l}<ChevronRight size={16} /></button>
                  ))}
                </div>
                <div className="group tip"><b><Sparkles size={15} /> Tip: {tip[0]}</b><p>{tip[1]}</p></div>
              </div>
            </div>
          </>
        )}

        {page === 'connections' && (
          <>
            <Group title="Coding AI">
              <Row title="Claude Code" desc="Follows your Claude Code sessions in the terminal or VS Code. Adds small hooks to ~/.claude/settings.json (backed up first, removed when you turn it off).">
                <span className={'badge' + (connected ? ' good' : '')}>{connected ? '● Connected' : 'Off'}</span>
                <Toggle on={connected} onChange={async () => setErr((await toggle()) ?? '')} />
              </Row>
              {err && <div className="errline">{err}</div>}
              <Row title="Codex" desc="Follows OpenAI Codex while it codes for you.">
                <span className={'badge' + (cli?.codex ? '' : ' warn')}>{cli === null ? 'Checking…' : cli.codex ? 'Found · tracking coming soon' : 'Not found on this PC'}</span>
                <Toggle on={false} onChange={() => {}} disabled />
              </Row>
            </Group>
            <Group title="Chat apps">
              <Row title="Claude" desc="The Claude app or claude.ai: Kitty tells you when your answer is ready. Needs a Chrome extension."><span className="badge">Coming soon</span></Row>
              <Row title="ChatGPT" desc="The ChatGPT app or chatgpt.com. Needs a Chrome extension."><span className="badge">Coming soon</span></Row>
            </Group>
          </>
        )}

        {page === 'ai' && (
          <>
            <p className="lead">Kitty's chat uses the AI you turned on in Connections.</p>
            <Group>
              <Row title="Claude" desc="Uses your own Claude account, through Claude Code."><span className={'badge' + (cli?.claude ? ' good' : ' warn')}>{cli === null ? 'Checking…' : cli.claude ? '● Connected' : 'Claude Code not found'}</span></Row>
              <Row title="Codex" desc="Not connected yet."><button className="btn" disabled>Connect</button></Row>
            </Group>
          </>
        )}

        {page === 'apps' && (
          <div className="cards2">
            <div className="app on-always"><div className="ai"><span style={{ background: '#2d3a2d' }}><Bot size={20} color="#9be37a" /></span><div><b>AI assistants</b><small>In your Kitty</small></div><span className="badge">Always on</span></div><p>Claude Code: Kitty shows whether your AI is busy, has a question or is done.</p></div>
            {APPS.map((a) => (
              <div className="app" key={a.id}>
                <div className="ai"><span style={{ background: a.tone + '2a' }}><a.icon size={20} color={a.tone} /></span><div><b>{a.title}</b><small>In your Kitty</small></div><Toggle on={s.apps[a.id]} onChange={(v) => set({ apps: { [a.id]: v } })} /></div>
                <p>{a.desc}</p>
              </div>
            ))}
            <div className="app"><div className="ai"><span style={{ background: '#2a2d33' }}><Gear size={20} /></span><div><b>Settings</b><small>In your Kitty</small></div><span className="badge">Always on</span></div><p>This app. Always there via the gear.</p></div>
            <div className="app ghost"><div className="ai"><span style={{ background: '#2a2d33' }}><Sparkles size={20} /></span><div><b>More apps are coming</b></div></div><p>Got an idea for an app? Tell me.</p></div>
          </div>
        )}

        {page === 'kitty' && (
          <>
            <div className="hero">
              <Cat size={150} follow={false} mood={preview ?? 'happy'} blink={s.blinking} {...look} />
              <div style={{ flex: 1 }}>
                <h2>{s.name}</h2>
                <p>{st.total} tasks done · {earned} of 12 badges</p>
                <div className="meter"><i style={{ width: `${(earned / 12) * 100}%` }} /></div>
              </div>
            </div>
            <Group title="Name">
              <Row title="What's the cat's name?" desc="It says it when it says hi.">
                <input className="txt" value={nameDraft ?? s.name} onChange={(e) => setNameDraft(e.target.value)} />
                <button className="btn lime" onClick={() => { if ((nameDraft ?? '').trim()) set({ name: nameDraft!.trim() }); setNameDraft(null) }}>Save</button>
              </Row>
              <Row title="And yours?" desc="Used in the greeting on Home.">
                <input className="txt" value={userDraft ?? s.userName} onChange={(e) => setUserDraft(e.target.value)} />
                <button className="btn lime" onClick={() => { if (userDraft !== null) set({ userName: userDraft.trim() }); setUserDraft(null) }}>Save</button>
              </Row>
            </Group>
            <h3>Look</h3>
            <div className="group">
              <div className="row col"><div><b>Traffic-light eyes</b><p>Pick the colour for each state. Click a row to test it.</p></div>
                <div className="presets">
                  {(Object.keys(LIGHT_PRESETS) as (keyof typeof LIGHT_PRESETS)[]).map((k) => {
                    const p = LIGHT_PRESETS[k]
                    return <button key={k} className={s.lightPreset === k ? 'on' : ''} onClick={() => set({ lightPreset: k, lightWork: p.work, lightDone: p.done, lightError: p.error })}><i style={{ background: p.work }} /><i style={{ background: p.done }} /><i style={{ background: p.error }} />{p.name}</button>
                  })}
                </div>
                {([['work', 'Working or a question', 'lightWork', 'working'], ['done', 'Done', 'lightDone', 'done'], ['error', 'Error', 'lightError', 'error']] as const).map(([k, label, field, kind]) => (
                  <div className="lightrow" key={k}>
                    <button className="lname" onClick={() => test(kind)}><i style={{ background: s[field] }} />{label}<Play size={12} /></button>
                    <div className="sw6">{LIGHT_SWATCHES[k].map((c) => <button key={c} className={s[field].toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ lightPreset: 'custom', [field]: c })} aria-label={c} />)}</div>
                  </div>
                ))}
              </div>
            </div>
            <Group title="Behaviour">
              <Row title="Faces" desc="Happy, sad, curious, focused and more. Off = plain eyes."><Toggle on={s.faces} onChange={(v) => set({ faces: v })} /></Row>
              <div className="row col"><div><b>See emotions</b><p>Click one to see it.</p></div>
                <div className="emos">{EMOTIONS.map(([m, e, l]) => <button key={m} className={preview === m ? 'on' : ''} onClick={() => { setPreview(m); setTimeout(() => setPreview((p) => (p === m ? null : p)), 3500) }}>{e} {l}</button>)}</div>
              </div>
              <Row title="Blinking" desc="The cat blinks now and then."><Toggle on={s.blinking} onChange={(v) => set({ blinking: v })} /></Row>
              <Row title="Eyes follow the cursor" desc="The cat looks at your mouse, anywhere on screen."><Toggle on={s.follow} onChange={(v) => set({ follow: v })} /></Row>
              <Row title="Dancing to music" desc="Headphones on and a little dance when a song plays."><Toggle on={s.dancing} onChange={(v) => set({ dancing: v })} /></Row>
              <Row title="Sleep effect" desc="Falls asleep when nothing happens for a while."><Toggle on={s.sleepEffect} onChange={(v) => set({ sleepEffect: v })} /></Row>
              <Row title="Fall asleep after" desc="When nothing happens (Sleep effect must be on)."><Seg value={s.sleepMins} onChange={(v) => set({ sleepMins: v })} options={[[5, '5 min'], [10, '10 min'], [30, '30 min']]} /></Row>
              <Row title="Startup animation" desc={'Wave and say "hi" at startup.'}><button className="btn" onClick={() => test('hi')}>Try it</button><Toggle on={s.startupAnim} onChange={(v) => set({ startupAnim: v })} /></Row>
              <Row title="Hunger" desc={`${s.name} is ${st.hunger}% full. Every task gives food. When very hungry it looks sad.`}><Toggle on={s.hunger} onChange={(v) => set({ hunger: v })} /></Row>
            </Group>
            <h3>Achievements · {earned}/12</h3>
            <div className="badges">
              {badges.map((b) => (
                <div key={b.id} className={'badgecard' + (b.ok ? ' ok' : '')}>
                  <div className="bi">{b.ok ? b.icon : <Lock size={22} />}</div>
                  <b>{b.title}</b><small>{b.desc}</small>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'wardrobe' && (
          <div className="wardrobe">
            <div className="stagecard">
              <Cat size={210} follow={false} mood="happy" blink={s.blinking} {...look} />
              <b>{s.name}</b><small>Wearing: {outfit === 'none' ? 'nothing' : outfit}</small>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Outfit <small className="dim">Earn more by finishing tasks</small></h3>
              <div className="outfits">
                {OUTFITS.map((o) => {
                  const locked = st.total < o.need
                  return (
                    <button key={o.id} disabled={locked} className={s.outfit === o.id ? 'on' : ''} onClick={() => set({ outfit: o.id })}>
                      {s.outfit === o.id && <Check size={14} className="chk" />}
                      <span className="em">{o.emoji}</span><b>{o.name}</b>
                      {o.need > 0 && <small>{locked ? `Earned at ${o.need} tasks` : 'Unlocked'}</small>}
                    </button>
                  )
                })}
              </div>
              <h3>Fur</h3>
              <div className="swatches">{BODY.map((b) => <button key={b.id} className={s.bodyColor === b.id ? 'on' : ''} onClick={() => set({ bodyColor: b.id })}><i style={{ background: b.c }} />{b.name}</button>)}</div>
              <h3>Eyes</h3>
              <div className="swatches">{EYE.map((b) => <button key={b.id} className={s.eyeColor === b.id ? 'on' : ''} onClick={() => set({ eyeColor: b.id })}><i style={{ background: b.c }} />{b.name}</button>)}</div>
              <div className="group" style={{ marginTop: 20 }}>
                <Row title="Seasonal outfits" desc="Santa hat in December, witch hat around Halloween, orange crown on King's Day."><Toggle on={s.seasonal} onChange={(v) => set({ seasonal: v })} /></Row>
              </div>
            </div>
          </div>
        )}

        {page === 'general' && (
          <>
            <Group title="Testing">
              <Row title="Test mode" desc="Buttons to try everything without real Claude or music."><Toggle on={s.testMode} onChange={(v) => set({ testMode: v })} /></Row>
              {s.testMode && (
                <div className="testbox">
                  <div><small>Claude Code</small>{[['working', 'Working'], ['question', 'Question'], ['done', 'Done'], ['long', 'Long task'], ['error', 'Error'], ['clear', 'Clear']].map(([k, l]) => <button key={k} className="btn" onClick={() => test(k)}>{l}</button>)}</div>
                  <div><small>Music</small><button className="btn" onClick={() => test('music-on')}>Play a fake song</button><button className="btn" onClick={() => test('music-off')}>Stop</button></div>
                  <div><small>Island</small>{[['battery', 'Low battery'], ['air-on', 'Airplane on'], ['air-off', 'Airplane off'], ['vol', 'Volume'], ['privacy', 'Mic + camera'], ['hi', 'Say hi'], ['confetti', 'Confetti'], ['usage', 'Usage warning']].map(([k, l]) => <button key={k} className="btn" onClick={() => test(k)}>{l}</button>)}</div>
                </div>
              )}
            </Group>
            <Group title="Animations">
              <Row title="Speed" desc="How fast the island opens, closes and reacts."><Seg value={s.speed} onChange={(v) => set({ speed: v })} options={[['fast', 'Fast'], ['normal', 'Normal']]} /></Row>
              <Row title="App animations" desc="Kitty does a little trick when you open an app."><Toggle on={s.appAnim} onChange={(v) => set({ appAnim: v })} /></Row>
              <Row title="Confetti" desc="For long tasks, finished focus and new outfits."><button className="btn" onClick={() => test('confetti')}>Try it</button><Toggle on={s.confetti} onChange={(v) => set({ confetti: v })} /></Row>
            </Group>
            <Group title="Focus & notifications">
              <Row title="Traffic-light sounds" desc="Ding when done, pling for a question, low for an error."><button className="btn" onClick={() => sounds.done()}>Play</button><Toggle on={s.sounds} onChange={(v) => set({ sounds: v })} /></Row>
              <Row title="Sound level" desc="How loud the sounds are."><Seg value={s.soundLevel} onChange={(v) => { set({ soundLevel: v }); setSoundLevel(v); setTimeout(() => sounds.done(), 120) }} options={[['soft', 'Soft'], ['normal', 'Normal'], ['loud', 'Loud']]} /></Row>
              <Row title="Windows notifications" desc="Notification for done, question, focus and limit."><Toggle on={s.notifications} onChange={(v) => set({ notifications: v })} /></Row>
              <Row title="Warn at limit" desc={`Notify when you used this much of your 5-hour budget. Used now: about ${Math.round((used / Math.max(1, s.usageBudget)) * 100)}%.`}><Seg value={s.warnAt} onChange={(v) => set({ warnAt: v })} options={[[70, '70%'], [80, '80%'], [90, '90%'], [0, 'Never']]} /></Row>
              <Row title="5-hour budget" desc="Kitty can't see your plan's real limit, so pick a number of tokens that feels like 'full' to you."><Seg value={s.usageBudget} onChange={(v) => set({ usageBudget: v })} options={[[500000, '0.5M'], [1000000, '1M'], [2000000, '2M'], [5000000, '5M'], [10000000, '10M']]} /></Row>
            </Group>
            <Group title="Keyboard shortcuts">
              {SHORTCUTS.map(([k, l]) => <Row key={k} title={l}><ShortcutBox value={s.shortcuts[k]} failed={failed.includes(k)} onSet={(a) => set({ shortcuts: { [k]: a } })} /></Row>)}
              <Row title="Put all shortcuts back"><button className="btn" onClick={() => window.kitty.resetShortcuts()}>Reset</button></Row>
            </Group>
            <Group title="Island">
              <Row title="Weather" desc={info.weather?.temp !== undefined ? `${info.weather.emoji} ${info.weather.temp}° in ${info.weather.city}` : (info.weather?.error ?? 'Type your city to see the weather on the home screen')}>
                <input className="txt" placeholder="E.g. Amsterdam" value={city ?? s.weatherCity} onChange={(e) => setCity(e.target.value)} />
                <button className="btn" onClick={() => { set({ weatherCity: (city ?? s.weatherCity).trim() }); setCity(null) }}>Save</button>
              </Row>
              <Row title="Calendar" desc={s.calendarUrl ? `Connected · ${info.events.length} upcoming` : 'Google Calendar: Settings → your calendar → "Secret address in iCal format". Paste that link here. It stays on this PC.'}>
                <input className="txt" type="password" placeholder={s.calendarUrl ? '••••••••' : 'https://… .ics'} value={cal ?? ''} onChange={(e) => setCal(e.target.value)} />
                <button className="btn" onClick={() => { set({ calendarUrl: (cal ?? '').trim() }); setCal(null) }}>{s.calendarUrl && !cal ? 'Remove' : 'Save'}</button>
              </Row>
              <Row title="Volume bar" desc="Show the volume in the island when you change it."><Toggle on={s.volumeBar} onChange={(v) => set({ volumeBar: v })} /></Row>
              <Row title="Battery warning" desc="Laptop and Bluetooth (headphones, mouse) almost empty."><Toggle on={s.batteryWarning} onChange={(v) => set({ batteryWarning: v })} /></Row>
              <Row title="Mic and camera dots" desc="An orange or green dot when an app is using your microphone or camera."><Toggle on={s.privacyDot} onChange={(v) => set({ privacyDot: v })} /></Row>
              <Row title="Reset everything" desc="Set all these choices back to default (keeps your names, city and calendar)."><button className="btn" onClick={() => window.kitty.resetSettings()}>Reset</button></Row>
            </Group>
            <Group title="Kitty">
              <Row title="Start with Windows" desc={dev ? 'Works in the installed app (not while running from source).' : 'Kitty starts by itself when you turn on your PC.'}><Toggle on={s.startWithWindows} onChange={(v) => set({ startWithWindows: v })} disabled={dev} /></Row>
              <Row title="Updates" desc={update.state === 'error' ? update.error : `Version ${update.current || '—'}`}>
                <button className={'btn' + (update.state === 'ready' ? ' lime' : '')} disabled={['dev', 'checking', 'downloading'].includes(update.state)}
                  onClick={() => (update.state === 'ready' ? window.kitty.installUpdate() : window.kitty.checkUpdate())}>{updateLabel(update)}</button>
              </Row>
              <Row title="Restart" desc="Closes Kitty and starts it again right away."><button className="btn" onClick={() => window.kitty.restart()}>Restart</button></Row>
              <Row title="Quit" desc="Quits Kitty completely. Also possible from the island's menu."><button className="btn danger" onClick={() => window.kitty.quit()}>Quit</button></Row>
            </Group>
          </>
        )}

        {page === 'news' && NEWS.map((n) => (
          <Group key={n.v} title={`Kitty ${n.v} · ${n.d}`}>
            <div className="newsbox"><ul>{n.items.map((i) => <li key={i}>{i}</li>)}</ul></div>
          </Group>
        ))}
      </main>
    </div>
  )
}
