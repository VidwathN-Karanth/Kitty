const { contextBridge, ipcRenderer, webUtils } = require('electron')

const on = (channel) => (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on(channel, h); return () => ipcRenderer.removeListener(channel, h) }
const send = (channel) => (...a) => ipcRenderer.send(channel, ...a)
const call = (channel) => (...a) => ipcRenderer.invoke(channel, ...a)

// Dropped files: resolve real paths here (File objects can't cross the bridge), then hand them to the main process.
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => {
  e.preventDefault()
  const paths = [...(e.dataTransfer?.files ?? [])].map((f) => webUtils.getPathForFile(f)).filter(Boolean)
  if (paths.length) ipcRenderer.send('tray:add', paths)
})

contextBridge.exposeInMainWorld('kitty', {
  quit: send('quit'), restart: send('app:restart'),
  rect: send('rect'), track: send('track'), onCursor: on('cursor'), idle: call('idle'),
  // clipboard + tray
  clips: call('clips:get'), copyClip: send('clips:copy'), clearClips: send('clips:clear'), onClips: on('clips'),
  tray: call('tray:get'), onTray: on('tray'), removeFile: send('tray:remove'), openFile: send('tray:open'), dragFile: send('tray:drag'),
  // media, volume, airplane mode, mic/camera
  media: call('media:get'), onMedia: on('media'), mediaCmd: send('media:cmd'),
  // Claude Code
  claude: call('claude:get'), claudeInstalled: call('claude:installed'), claudeSetInstalled: call('claude:set'),
  onClaude: on('claude'), onClaudeEvent: on('claude:event'),
  usage: call('usage:get'), onUsage: on('usage'), cli: call('cli:check'),
  // chat
  chatAsk: (id, prompt) => ipcRenderer.send('chat:ask', { id, prompt }), onChatChunk: on('chat:chunk'), onChatDone: on('chat:done'),
  // settings
  settings: call('settings:get'), setSettings: call('settings:set'), onSettings: on('settings'), resetSettings: send('settings:reset'),
  resetShortcuts: send('shortcuts:reset'), onShortcutsFailed: on('shortcuts:failed'),
  openSettings: send('settings:open'), onSettingsPage: on('settings:page'),
  // updates, info, misc
  updateStatus: call('update:get'), onUpdate: on('update'), checkUpdate: send('update:check'), installUpdate: send('update:install'),
  info: call('info:get'), onInfo: on('info'), openUrl: send('open:url'),
  onGoto: on('goto'), onToggle: (cb) => ipcRenderer.on('toggle', cb), bump: send('stat:bump'),
  stats: call('stats:get'), onStats: on('stats'),
  testRun: send('test:run'), onTest: on('test'),
})
