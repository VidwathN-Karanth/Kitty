// Claude Code integration: a local HTTP endpoint that Claude Code hooks post to, a per-session state machine,
// run statistics, and install/uninstall of our hooks in ~/.claude/settings.json (always backed up, always reversible).
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PORT = 47821
const MARKER = `127.0.0.1:${PORT}/hook`
const CMD = `curl.exe -s -m 2 -X POST -H "Content-Type: application/json" --data-binary @- http://${MARKER}`
const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'StopFailure']
const SETTINGS = process.env.KITTY_CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json') // env override is for tests

const STEPS = ['Read', 'Edit', 'Test', 'Done']
const READ_TOOLS = /^(Read|Grep|Glob|WebFetch|WebSearch|LS)$/
const EDIT_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const TEST_CMD = /\b(test|pytest|jest|vitest|mocha|rspec|phpunit)\b/i

// ---------- settings.json (hook installer) ----------
function load() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return {}; throw e }
}
const isOurs = (entry) => (entry.hooks || []).some((h) => String(h.command || '').includes(MARKER))
function save(s) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true })
  const tmp = SETTINGS + '.kitty-tmp'
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2))
  fs.renameSync(tmp, SETTINGS)
}
function isInstalled() {
  try { return Object.values(load().hooks || {}).some((arr) => Array.isArray(arr) && arr.some(isOurs)) } catch { return false }
}
function install() {
  const s = load() // throws on invalid JSON, so we never overwrite a file we couldn't read
  const bak = SETTINGS + '.kitty-backup'
  if (fs.existsSync(SETTINGS) && !fs.existsSync(bak)) fs.copyFileSync(SETTINGS, bak)
  s.hooks = s.hooks || {}
  for (const ev of EVENTS) {
    const arr = (s.hooks[ev] = (s.hooks[ev] || []).filter((e) => !isOurs(e)))
    const entry = { hooks: [{ type: 'command', command: CMD }] }
    if (ev === 'PreToolUse' || ev === 'PostToolUse') entry.matcher = '*'
    arr.push(entry)
  }
  save(s)
}
function uninstall() {
  const s = load()
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = s.hooks[ev].filter((e) => !isOurs(e))
    if (!s.hooks[ev].length) delete s.hooks[ev]
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks
  save(s)
}

// ---------- stats ----------
let statsFile = null
let stats = { total: 0, days: {}, runs: [], counters: { focus: 0, dj: 0, answers: 0 }, flags: {}, fed: { level: 80, at: Date.now() } }
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function loadStats(dir) {
  statsFile = path.join(dir, 'stats.json')
  try { stats = { ...stats, ...JSON.parse(fs.readFileSync(statsFile, 'utf8')) } } catch {}
  stats.counters = { focus: 0, dj: 0, answers: 0, ...stats.counters }
  stats.flags = stats.flags || {}
  stats.fed = stats.fed || { level: 80, at: Date.now() }
}
function saveStats() {
  try { fs.mkdirSync(path.dirname(statsFile), { recursive: true }); fs.writeFileSync(statsFile, JSON.stringify(stats)) } catch (e) { console.log('[stats]', e.message) }
}
function streak() {
  let n = 0
  for (let d = new Date(); stats.days[dayKey(d)]; d.setDate(d.getDate() - 1)) n++
  return n
}
// Hunger: every finished task feeds the cat (+20%); it slowly gets hungry again (2% per hour)
const hungerNow = () => Math.max(0, stats.fed.level - ((Date.now() - stats.fed.at) / 3600000) * 2)
const publicStats = () => ({
  total: stats.total, today: stats.days[dayKey()] || 0, streak: streak(), runs: stats.runs.slice(0, 30),
  counters: stats.counters, flags: stats.flags, hunger: Math.round(hungerNow()),
})
// Test mode: fake a Claude session so every state can be tried without real work
function simulate(kind) {
  const base = { session_id: 'test', cwd: 'C:/Demo/Kitty-Test' }
  if (kind === 'working') { handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Test run: building something cool' }); handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit' }) }
  else if (kind === 'question') { handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Test run' }); handle({ ...base, hook_event_name: 'Notification', message: 'Claude needs your permission to run a command' }) }
  else if (kind === 'done') { handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Test run' }); handle({ ...base, hook_event_name: 'Stop' }) }
  else if (kind === 'long') { handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Test run (long task)' }); sessions.get('test').startedAt -= 20 * 60000; handle({ ...base, hook_event_name: 'Stop' }) }
  else if (kind === 'error') { handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Test run' }); handle({ ...base, hook_event_name: 'StopFailure' }) }
  else if (kind === 'clear') { sessions.delete('test'); onChange() }
}
function bump(name) { stats.counters[name] = (stats.counters[name] || 0) + 1; saveStats(); onChange() }

// ---------- sessions ----------
const sessions = new Map()
let onChange = () => {}, onEvent = () => {}

function handle(p) {
  const id = p.session_id || 'default'
  if (path.basename(p.cwd || '') === 'kitty-chat') return // Kitty's own chat questions are not "jobs"
  const now = Date.now()
  let s = sessions.get(id)
  if (!s) { s = { id, project: path.basename(p.cwd || '') || 'Claude Code', state: 'idle', step: 0, label: '', prompt: '', startedAt: now, endedAt: null }; sessions.set(id, s) }
  if (p.cwd) s.project = path.basename(p.cwd)
  s.updatedAt = now

  switch (p.hook_event_name) {
    case 'UserPromptSubmit':
      Object.assign(s, { state: 'working', step: 0, label: 'Thinking', prompt: p.prompt || '', startedAt: now, endedAt: null })
      break
    case 'PreToolUse': {
      const tool = p.tool_name || ''
      if (READ_TOOLS.test(tool)) { s.step = Math.max(s.step, 0); s.label = 'Reading' }
      else if (EDIT_TOOLS.test(tool)) { s.step = Math.max(s.step, 1); s.label = 'Editing' }
      else if (tool === 'Bash' && TEST_CMD.test(p.tool_input?.command || '')) { s.step = Math.max(s.step, 2); s.label = 'Testing' }
      else s.label = tool === 'Bash' ? 'Running a command' : 'Working'
      if (s.state !== 'working') s.startedAt = s.endedAt ? now : s.startedAt
      s.state = 'working'; s.endedAt = null
      break
    }
    case 'PostToolUse':
      if (s.state === 'question') s.state = 'working' // answered, Claude carried on
      break
    case 'StopFailure': // an API error ended the turn (newer Claude Code versions)
      Object.assign(s, { state: 'error', label: 'Something went wrong', endedAt: now })
      onEvent({ type: 'error', project: s.project, message: s.label })
      break
    case 'Notification':
      s.state = 'question'; s.label = p.message || 'Claude needs you'
      onEvent({ type: 'question', project: s.project, message: s.label })
      break
    case 'Stop': {
      if (s.state === 'done') break
      Object.assign(s, { state: 'done', step: 3, label: 'Done', endedAt: now })
      if (id === 'test') { onEvent({ type: 'done', project: s.project, ms: now - s.startedAt }); break }
      stats.total++
      const hr = new Date(now).getHours()
      if (hr < 5) stats.flags.night = true
      else if (hr < 7) stats.flags.early = true
      if (now - s.startedAt > 15 * 60000) stats.flags.long = true
      stats.fed = { level: Math.min(100, hungerNow() + 20), at: now }
      const k = dayKey()
      stats.days[k] = (stats.days[k] || 0) + 1
      stats.runs = [{ project: s.project, prompt: s.prompt, startedAt: s.startedAt, ms: now - s.startedAt, status: 'done' }, ...stats.runs].slice(0, 50)
      saveStats()
      onEvent({ type: 'done', project: s.project, ms: now - s.startedAt })
      break
    }
  }
  for (const [k, v] of sessions) if (now - v.updatedAt > 2 * 3600 * 1000) sessions.delete(k)
  onChange()
}

const snapshot = () => ({ sessions: [...sessions.values()], stats: publicStats() })

function start({ userDataDir, change, event }) {
  onChange = () => change(snapshot())
  onEvent = event
  loadStats(userDataDir)
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook') { res.writeHead(404).end(); return }
    let body = ''
    req.on('data', (d) => { body += d; if (body.length > 1e6) req.destroy() })
    req.on('end', () => { try { handle(JSON.parse(body)) } catch (e) { console.log('[hook]', e.message) } res.writeHead(200).end('ok') })
  })
  server.on('error', (e) => console.log('[hook server]', e.message))
  server.listen(PORT, '127.0.0.1')
}

module.exports = { start, snapshot, isInstalled, install, uninstall, bump, simulate, STEPS }
