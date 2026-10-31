const { app, BrowserWindow, ipcMain, globalShortcut, screen, clipboard, shell, powerMonitor, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, execFile } = require('child_process')
const os = require('os')
const claude = require('./claude')
const updater = require('./updater')
const settings = require('./settings')
const info = require('./info')
const usage = require('./usage')

// dev only: lets automated checks drive the windows over the DevTools protocol
if (!app.isPackaged) app.commandLine.appendSwitch('remote-debugging-port', '9333')

const W = 720, H = 360
let win

const all = (ch, data) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(ch, data))
const unpacked = (f) => path.join(__dirname, f).replace('app.asar', 'app.asar.unpacked') // PowerShell cannot read inside the asar
const page = (w, query) => app.isPackaged
  ? w.loadFile(path.join(__dirname, 'dist', 'index.html'), { query })
  : w.loadURL('http://localhost:5173/?' + new URLSearchParams(query))

// ---------- windows ----------
// Settings window: a normal window (the island is a click-through overlay), one at a time
let settingsWin
function openSettings(pageId) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show(); settingsWin.focus()
    if (pageId) settingsWin.webContents.send('settings:page', pageId)
    return
  }
  settingsWin = new BrowserWindow({
    width: 1060, height: 720, minWidth: 800, minHeight: 540, backgroundColor: '#0d0f12', title: 'Kitty Settings',
    autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  settingsWin.removeMenu()
  page(settingsWin, { settings: pageId || 'home' })
}

function create() {
  const { x, width } = screen.getPrimaryDisplay().bounds
  win = new BrowserWindow({
    width: W, height: H, x: Math.round(x + (width - W) / 2), y: 0,
    frame: false, transparent: true, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, focusable: true,
    // never snapped, maximized or resized by Windows (Snap layouts once cut the island in half)
    thickFrame: false, maximizable: false, minimizable: false, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  // Other "always on top" windows (fullscreen apps, players, popups) can still land above the island. Take the top
  // spot back right away when that happens, and check again every second (moveTop never steals the keyboard focus).
  const home = { width: W, height: H, x: Math.round(x + (width - W) / 2), y: 0 }
  const top = () => {
    if (!win || win.isDestroyed() || !win.isVisible() || paused) return
    win.setAlwaysOnTop(true, 'screen-saver'); win.moveTop()
    const b = win.getBounds()
    if (b.x !== home.x || b.y !== home.y || b.width !== home.width || b.height !== home.height) win.setBounds(home) // put back if moved or resized
  }
  win.on('always-on-top-changed', (_e, on) => { if (!on) top() })
  win.on('blur', top)
  setInterval(top, 1000)
  if (!app.isPackaged) {
    win.webContents.on('console-message', (_e, _l, msg) => console.log('[renderer]', msg))
    win.webContents.on('did-fail-load', (_e, c, d) => console.log('[load failed]', c, d))
    win.webContents.on('render-process-gone', (_e, d) => console.log('[gone]', d.reason))
  }
  page(win, {})
}

// ---------- system tray ----------
// Windows tucks new tray icons into the ^ overflow; drag the cat out of it onto the taskbar to keep it visible.
// A click (left or right) opens the menu.
let sysTray
let paused = false
function buildTrayMenu() {
  const s = settings.get()
  return Menu.buildFromTemplate([
    { label: paused ? 'Kitty is paused' : 'Kitty is running', enabled: false },
    { type: 'separator' },
    { label: 'Mute sounds', type: 'checkbox', checked: !s.sounds, click: (i) => applySettings(settings.patch({ sounds: !i.checked })) },
    { label: 'Pause', enabled: !paused, click: () => setPaused(true) },
    { label: 'Resume', enabled: paused, click: () => setPaused(false) },
    { type: 'separator' },
    { label: 'Open the island', enabled: !paused, click: () => win?.webContents.send('toggle') },
    { label: 'Settings', click: () => openSettings() },
    { label: 'Start with Windows', type: 'checkbox', checked: s.startWithWindows, enabled: app.isPackaged, click: (i) => applySettings(settings.patch({ startWithWindows: i.checked })) },
    { label: 'Check for updates', click: () => updater.check() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
}
function makeTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.ico'))
  sysTray = new Tray(img.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')).resize({ width: 32, height: 32 }) : img)
  sysTray.setToolTip('Kitty')
  sysTray.setContextMenu(buildTrayMenu())
  sysTray.on('click', () => sysTray.popUpContextMenu())  // left click shows the same menu as right click
}
const refreshTray = () => { sysTray?.setContextMenu(buildTrayMenu()); sysTray?.setToolTip(paused ? 'Kitty (paused)' : 'Kitty') }

// Pause: the island disappears and Kitty stops doing work (music/GPU helpers, cursor, clipboard, stats, shortcuts,
// sounds and pop-ups) until Resume. Claude's hooks keep posting, but nothing is shown while paused.
function setPaused(p) {
  if (p === paused) return
  paused = p
  if (p) {
    globalShortcut.unregisterAll()
    win?.webContents.setAudioMuted(true)
    win?.hide()
    if (helper) { const h = helper; helper = null; h.removeAllListeners('exit'); h.kill() }
  } else {
    win?.webContents.setAudioMuted(false)
    win?.showInactive(); win?.setAlwaysOnTop(true, 'screen-saver')
    registerShortcuts(settings.get().shortcuts)
    if (!helper) startMedia()
  }
  syncGpuHelper(settings.get())
  win?.webContents.send('paused', p)
  refreshTray()
}
ipcMain.handle('paused:get', () => paused)

// ---------- settings ----------
ipcMain.on('settings:open', (_e, pageId) => openSettings(pageId))
ipcMain.handle('settings:get', () => settings.get())
function applySettings(s) {
  refreshTray()
  syncGpuHelper(s)
  info.settingsChanged(s)
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: s.startWithWindows, name: 'Kitty' })
  all('settings', s)
  return s
}
ipcMain.handle('settings:set', (_e, p) => {
  const s = applySettings(settings.patch(p))
  if (p.shortcuts) registerShortcuts(s.shortcuts)
  return s
})
ipcMain.on('settings:reset', () => { const s = applySettings(settings.reset()); registerShortcuts(s.shortcuts) })
ipcMain.on('shortcuts:reset', () => { const s = applySettings(settings.resetShortcuts()); registerShortcuts(s.shortcuts) })
ipcMain.on('app:restart', () => { app.relaunch(); app.exit(0) })
ipcMain.handle('info:get', () => info.get())
ipcMain.on('open:url', (_e, u) => { if (/^https:\/\//i.test(u)) shell.openExternal(u) }) // only https links, e.g. meeting links

// Global shortcuts (rebindable in Settings). Tells the Settings window which ones could not be registered.
function registerShortcuts(sc) {
  globalShortcut.unregisterAll()
  const go = (id) => win?.webContents.send('goto', id)
  const actions = { open: () => win?.webContents.send('toggle'), home: () => go('home'), music: () => go('music'), claude: () => go('claude'), focus: () => go('focus'), clipboard: () => go('clipboard'), note: () => go('note') }
  const failed = []
  for (const [key, fn] of Object.entries(actions)) {
    try { if (!sc[key] || !globalShortcut.register(sc[key], fn)) failed.push(key) } catch { failed.push(key) }
  }
  all('shortcuts:failed', failed)
}

ipcMain.handle('idle', () => powerMonitor.getSystemIdleTime() * 1000) // ms since last keyboard/mouse input
ipcMain.on('quit', () => app.quit())

// ---------- click-through + cursor tracking ----------
// The window is mostly transparent. Click-through is decided here from the real cursor position vs the
// island's rectangle (reported by the renderer), because mouse events don't arrive while dragging files in.
let rect = { x: 0, y: 0, w: 0, h: 0 }, ignoring = true
ipcMain.on('rect', (_e, r) => { rect = r })

let tracking = true, last = ''
function poll() {
  let still = true
  if (!paused && win && !win.isDestroyed()) {
    const p = screen.getCursorScreenPoint(), b = win.getBounds()
    const x = p.x - b.x, y = p.y - b.y
    const inside = !dragHidden && x >= rect.x - 4 && x <= rect.x + rect.w + 4 && y >= rect.y && y <= rect.y + rect.h + 4
    if (inside === ignoring) { ignoring = !inside; win.setIgnoreMouseEvents(ignoring, { forward: true }) }
    const key = p.x + ',' + p.y
    still = key === last
    last = key
    if (tracking) win.webContents.send('cursor', { x, y })
  }
  setTimeout(poll, still ? 100 : 16)
}
ipcMain.on('track', (_e, on) => { tracking = on })

// ---------- clipboard ----------
let clips = []
function watchClipboard() {
  // Electron 45 made the clipboard calls asynchronous, so everything here is awaited
  let busy = false
  setInterval(async () => {
    if (busy || paused) return
    busy = true
    try {
      // password managers set this format; if it is there, don't record the copy
      let skip = false
      try { skip = !!(await clipboard.has('ExcludeClipboardContentFromMonitorProcessing')) } catch {}
      if (skip) return
      const text = await clipboard.readText()
      if (typeof text === 'string' && text && text !== clips[0]?.text) {
        clips = [{ text, t: Date.now() }, ...clips.filter((c) => c.text !== text)].slice(0, 20)
        win?.webContents.send('clips', clips)
      }
    } catch (e) { console.log('[clipboard]', e.message) } finally { busy = false }
  }, 1000)
}
ipcMain.handle('clips:get', () => clips)
ipcMain.on('clips:copy', (_e, text) => clipboard.writeText(text))
ipcMain.on('clips:clear', () => { clips = []; win.webContents.send('clips', clips) })

// ---------- file tray ----------
const trayFile = () => path.join(app.getPath('userData'), 'tray.json')
let tray = []
try { tray = JSON.parse(fs.readFileSync(trayFile(), 'utf8')) } catch {}
const saveTray = () => { try { fs.mkdirSync(path.dirname(trayFile()), { recursive: true }); fs.writeFileSync(trayFile(), JSON.stringify(tray)) } catch (e) { console.log('[tray]', e.message) } }
async function trayList() {
  tray = tray.filter((p) => fs.existsSync(p))
  return Promise.all(tray.map(async (p) => ({ path: p, name: path.basename(p), icon: (await app.getFileIcon(p)).toDataURL() })))
}
const pushTray = async () => win?.webContents.send('tray', await trayList())
ipcMain.handle('tray:get', trayList)
ipcMain.on('tray:add', (_e, paths) => { tray = [...new Set([...tray, ...paths])]; saveTray(); pushTray() })
ipcMain.on('tray:remove', (_e, p) => { tray = tray.filter((x) => x !== p); saveTray(); pushTray() })
ipcMain.on('tray:open', (_e, p) => shell.openPath(p))
// one file, or several at once (the "Drag all" handle): Windows drops them all together
ipcMain.on('tray:drag', async (e, p) => {
  const list = [].concat(p).filter((f) => fs.existsSync(f))
  if (list.length) e.sender.startDrag({ file: list[0], files: list, icon: await app.getFileIcon(list[0]) })
})

// ---------- media (Spotify etc.), volume, airplane mode, mic/camera ----------
let media = { state: { active: false }, art: null, vol: null, air: false, priv: { mic: false, cam: false } }, helper
let fake = null // Test mode can fake a song for a while
const view = () => (fake && Date.now() < fake.until ? { ...media, state: fake.state } : media) // the test song borrows the last real cover
const pushMedia = () => win?.webContents.send('media', view())
function startMedia() {
  helper = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', unpacked('media.ps1')], { windowsHide: true })
  let buf = ''
  helper.stdout.setEncoding('utf8')
  if (gpuWanted) helper.stdin.write('gpu on\n') // a restarted helper picks up where the old one was
  helper.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      try {
        const m = JSON.parse(line)
        if (m.type === 'air') media.air = m.on
        else if (m.type === 'priv') media.priv = { mic: m.mic, cam: m.cam }
        else if (m.type === 'vol') media.vol = { v: m.v, mute: m.mute }
        else if (m.type === 'art') media.art = { mime: m.mime, data: m.data }
        else if (m.type === 'gpu') { sysStats.gpu = m.gpu; continue }
        else if (m.type === 'windrag' || m.type === 'snip') { stepAside(m.type, m.on); continue }
        else { if (!m.active) media.art = null; media.state = { ...m, at: Date.now() } }
        pushMedia()
      } catch {}
    }
  })
  helper.on('exit', () => { helper = null; if (!quitting && !paused) setTimeout(startMedia, 3000) })
}
// The island steps aside while someone drags a window (maybe to the top for Snap layouts) or while a screenshot tool
// is selecting an area: it folds, turns invisible and lets every click and hover through (so it can't open either).
// It is still in the screenshot itself: those tools freeze the screen before showing their overlay.
const aside = new Set()
let dragHidden = false
function stepAside(reason, on) {
  if (!win || win.isDestroyed()) return
  on ? aside.add(reason) : aside.delete(reason)
  const hide = aside.size > 0
  if (hide === dragHidden) return
  dragHidden = hide
  if (hide) { win.webContents.send('fold'); win.setOpacity(0); win.setIgnoreMouseEvents(true); ignoring = true }
  else { win.setOpacity(1); win.setIgnoreMouseEvents(true, { forward: true }) }
}
let quitting = false
app.on('before-quit', () => { quitting = true; helper?.kill() })
ipcMain.handle('media:get', () => view())
ipcMain.on('media:cmd', (_e, c) => {
  helper?.stdin.write(c + '\n')
  if (c === 'toggle' || c === 'next' || c === 'prev') claude.bump('dj') // counts toward the DJ badge
})
ipcMain.on('stat:bump', (_e, name) => { if (['focus', 'answers'].includes(name)) claude.bump(name) })

// ---------- Test mode: try every state without real Claude work or music ----------
ipcMain.on('test:run', (_e, kind) => {
  if (kind === 'pause' || kind === 'resume') return setPaused(kind === 'pause')
  if (['working', 'question', 'done', 'long', 'error', 'clear'].includes(kind)) return claude.simulate(kind)
  if (kind === 'music-on') { fake = { until: Date.now() + 60000, state: { active: true, title: 'Test Song', artist: 'Kitty Band', playing: true, pos: 20, end: 180, app: 'Test', at: Date.now() } }; return pushMedia() }
  if (kind === 'music-off') { fake = null; return pushMedia() }
  if (kind === 'privacy') { media.priv = { mic: true, cam: true }; pushMedia(); setTimeout(() => { media.priv = { mic: false, cam: false }; pushMedia() }, 6000); return }
  win?.webContents.send('test', kind) // battery, airplane, volume, hi, confetti: handled in the island
})

// ---------- system stats: CPU and RAM from Node, GPU from a PowerShell helper (only while it is shown) ----------
let sysStats = { cpu: null, ram: null, ramUsed: 0, ramTotal: 0, gpu: null }, lastCpu = null
const cpuTimes = () => os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.total += t.user + t.nice + t.sys + t.idle + t.irq; return a }, { idle: 0, total: 0 })
function sampleStats() {
  if (paused) return
  const t = cpuTimes()
  if (lastCpu && t.total > lastCpu.total) sysStats.cpu = Math.max(0, Math.min(100, Math.round(100 * (1 - (t.idle - lastCpu.idle) / (t.total - lastCpu.total)))))
  lastCpu = t
  const total = os.totalmem(), free = os.freemem() // free = available memory on Windows, same as Task Manager
  sysStats.ram = Math.round(100 * (1 - free / total))
  sysStats.ramUsed = +((total - free) / 2 ** 30).toFixed(1)
  sysStats.ramTotal = Math.round(total / 2 ** 30)
  win?.webContents.send('stats', sysStats)
}
// GPU usage comes from the media helper (one PowerShell for everything): ask for it only while it is shown
let gpuWanted = false
function syncGpuHelper(s) {
  gpuWanted = !paused && s.stats.gpu && (s.statsRest || s.statsOpen)
  if (!gpuWanted) sysStats.gpu = null
  helper?.stdin.write(gpuWanted ? 'gpu on\n' : 'gpu off\n')
}
ipcMain.handle('stats:get', () => sysStats)

// ---------- chat ----------
// Asks the user's own Claude through the Claude Code CLI (`claude -p`, prompt on stdin).
// It runs in a folder called kitty-chat so its hook events can be ignored (a chat question is not a "job").
ipcMain.on('chat:ask', (e, { id, prompt }) => {
  const dir = path.join(os.tmpdir(), 'kitty-chat')
  fs.mkdirSync(dir, { recursive: true })
  const p = spawn('claude', ['-p', '--output-format', 'text'], { cwd: dir, shell: true, windowsHide: true })
  let err = '', out = ''
  p.stdout.setEncoding('utf8')
  p.stdout.on('data', (d) => { out += d; e.sender.send('chat:chunk', { id, text: d }) })
  p.stderr.on('data', (d) => { err += d })
  p.on('error', (x) => e.sender.send('chat:done', { id, error: x.message, clear: true }))
  p.on('close', (code) => {
    if (code === 0) { claude.bump('answers'); return e.sender.send('chat:done', { id, error: '' }) }
    // explain the common failures in plain words instead of showing raw CLI output (and hide other apps' hook noise)
    const all = out + '\n' + err
    const clean = err.split('\n').filter((l) => l.trim() && !/hook \[|hook failed|ECONNREFUSED/i.test(l)).join(' ').trim()
    const error = /authenticat|oauth|not logged in|log ?in|unauthori[sz]ed|401/i.test(all)
      ? "Claude Code's sign-in has expired. Open a terminal, run  claude  and type  /login , then ask again."
      : /not recognized|ENOENT|command not found/i.test(all)
        ? 'Claude Code is not installed (the claude command was not found).'
        : clean.slice(0, 200) || 'Claude Code could not answer. Is it installed and signed in?'
    e.sender.send('chat:done', { id, error, clear: true })
  })
  p.stdin.end(prompt)
})

// Which AI command-line tools exist on this PC
let cli = null
// Is a CLI installed? Kitty's PATH is the one Windows gave it at login, so a tool installed later, or one in a usual
// install folder that is not on that PATH (npm, WinGet, Scoop, Volta...), would be missed by just running it. So:
// the usual folders are checked too, and the folder the tool keeps its settings in (~/.claude, ~/.codex) also
// counts (that is also how the Codex desktop app shows up).
function hasCli(name) {
  const env = process.env, home = os.homedir()
  const dirs = [...(env.PATH || '').split(';'), path.join(env.APPDATA || '', 'npm'), path.join(env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links'),
    path.join(home, '.local', 'bin'), path.join(home, 'scoop', 'shims'), path.join(env.LOCALAPPDATA || '', 'Volta', 'bin'), path.join(env.ProgramFiles || '', 'nodejs'),
    path.join(env.LOCALAPPDATA || '', 'Programs', name), path.join(home, '.bun', 'bin'), path.join(env.LOCALAPPDATA || '', 'pnpm')]
  if (dirs.some((d) => d && ['.exe', '.cmd', '.bat', '.ps1', ''].some((x) => fs.existsSync(path.join(d, name + x))))) return Promise.resolve(true)
  if (fs.existsSync(path.join(home, '.' + name))) return Promise.resolve(true)
  return new Promise((res) => execFile(name, ['--version'], { shell: true, timeout: 8000, windowsHide: true }, (err) => res(!err)))
}
ipcMain.handle('cli:check', () => cli ?? (cli = Promise.all([hasCli('claude'), hasCli('codex')]).then(([c, x]) => ({ claude: c, codex: x }))))

// ---------- Claude Code ----------
ipcMain.handle('claude:get', () => claude.snapshot())
ipcMain.handle('claude:installed', () => claude.isInstalled())
ipcMain.handle('claude:set', (_e, on) => {
  try { on ? claude.install() : claude.uninstall(); return { installed: claude.isInstalled() } }
  catch (e) { return { installed: claude.isInstalled(), error: e.message } }
})
let usedTokens = 0
ipcMain.handle('usage:get', () => usedTokens)

if (!app.requestSingleInstanceLock()) app.quit() // one Kitty at a time (also keeps the hook port free)

app.whenReady().then(() => {
  settings.load(app.getPath('userData'))
  // register (or unregister) with Windows on every launch, so the Startup apps entry always points at this copy
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.get().startWithWindows, name: 'Kitty' })
  info.start(settings.get(), (i) => all('info', i))
  create()
  makeTray()
  poll()
  watchClipboard()
  startMedia()
  updater.start((st) => all('update', st))
  usage.start((u) => { usedTokens = u; all('usage', u) })
  claude.start({
    userDataDir: app.getPath('userData'),
    change: (snap) => all('claude', snap),
    event: (e) => { if (!paused) win?.webContents.send('claude:event', e) },
  })
  registerShortcuts(settings.get().shortcuts)
  sampleStats(); setInterval(sampleStats, 2000)
  syncGpuHelper(settings.get())
})
app.on('window-all-closed', () => { if (!win || win.isDestroyed()) app.quit() })
