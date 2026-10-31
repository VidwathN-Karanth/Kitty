// Auto-update: checks the release host (GitHub Releases, see package.json build.publish) on launch and every 6 hours,
// downloads in the background, and installs on request ("Restart & update") or when the app is next closed.
const { app, ipcMain } = require('electron')

let autoUpdater = null
let status = { state: 'idle', current: app.getVersion() }
let send = () => {}

// GitHub answers 404 when the repository is private or has no published release yet: say that plainly
function friendly(e) {
  const m = String(e?.message ?? e)
  if (/\b404\b/.test(m)) return 'No updates published yet'
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|net::/.test(m)) return 'No internet connection'
  return m.split('\n')[0].slice(0, 120)
}
function set(patch) { status = { ...status, ...patch }; send(status) }
function check() { autoUpdater?.checkForUpdates().catch(() => {}) } // failures also arrive via the 'error' event

function start(onStatus) {
  send = onStatus
  ipcMain.handle('update:get', () => status)
  ipcMain.on('update:check', check)
  ipcMain.on('update:install', () => autoUpdater?.quitAndInstall(true, true)) // silent install, relaunch afterwards

  if (!app.isPackaged) { status.state = 'dev'; return } // updates only exist in the installed app
  ;({ autoUpdater } = require('electron-updater'))
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater
    .on('checking-for-update', () => set({ state: 'checking' }))
    .on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0 }))
    .on('update-not-available', () => set({ state: 'uptodate' }))
    .on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }))
    .on('update-downloaded', (i) => set({ state: 'ready', version: i.version }))
    // no release on GitHub yet is not a failure, but it isn't "up to date" either: say so
    .on('error', (e) => set(/No published versions|\b404\b/i.test(String(e?.message ?? e)) ? { state: 'none', error: undefined } : { state: 'error', error: friendly(e) }))
  check()
  setInterval(check, 6 * 3600 * 1000)
}

module.exports = { start, check }
