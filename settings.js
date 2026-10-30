// App settings: one JSON file in the user data folder, shared by the island and the Settings window.
const fs = require('fs')
const os = require('os')
const path = require('path')

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')

const DEFAULTS = {
  name: 'Kitty',
  userName: cap(os.userInfo().username), // used in "Good morning, ..."
  theme: 'dark',          // Settings window: 'dark' | 'light'

  // cat
  follow: true,           // eyes follow the cursor
  faces: true,            // expressions on/off
  blinking: true,
  dancing: true,          // dances along with music
  sleepEffect: true,      // falls asleep when idle
  sleepMins: 10,          // minutes of no input before sleeping
  startupAnim: true,      // waves and says hi at startup
  appAnim: true,          // a little trick when you open an app
  hunger: true,
  bodyColor: 'orange', eyeColor: 'mint', outfit: 'best', seasonal: true,
  // traffic-light colours (what the status dot and eyes show)
  lightPreset: 'classic', lightWork: '#f0a030', lightDone: '#5fe05f', lightError: '#e5483d',

  // sounds & notifications
  sounds: true, soundLevel: 'normal', notifications: true, confetti: true,
  warnAt: 80,             // % of the 5-hour budget (0 = never)
  usageBudget: 1000000,   // tokens you consider "full" for 5 hours (Kitty cannot see your plan's real limit)

  // island
  speed: 'fast', volumeBar: true, showBattery: true, batteryWarning: true, privacyDot: true,
  weatherCity: '', calendarUrl: '',
  startWithWindows: false,
  testMode: false,

  shortcuts: {
    open: 'Ctrl+Alt+T', home: 'Ctrl+Alt+Shift+1', music: 'Ctrl+Alt+Shift+2', claude: 'Ctrl+Alt+Shift+3',
    focus: 'Ctrl+Alt+Shift+4', clipboard: 'Ctrl+Alt+Shift+5', note: 'Ctrl+Alt+Shift+6',
  },
  apps: { claude: true, music: true, chat: true, focus: true, tray: true, clipboard: true, note: true, clock: true },
}

let file = null
let current = structuredClone(DEFAULTS)

const merge = (base, p) => ({
  ...base, ...p,
  apps: { ...base.apps, ...(p.apps || {}) },
  shortcuts: { ...base.shortcuts, ...(p.shortcuts || {}) },
})

function load(dir) {
  file = path.join(dir, 'settings.json')
  try { current = merge(DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf8'))) } catch {}
}
function save() {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(current, null, 2)) } catch (e) { console.log('[settings]', e.message) }
}

module.exports = {
  DEFAULTS,
  load,
  get: () => current,
  patch: (p) => { current = merge(current, p); save(); return current },
  // "Reset everything" keeps who you are (names, calendar link, city)
  reset: () => { const keep = { name: current.name, userName: current.userName, weatherCity: current.weatherCity, calendarUrl: current.calendarUrl }; current = merge(structuredClone(DEFAULTS), keep); save(); return current },
  resetShortcuts: () => { current = { ...current, shortcuts: { ...DEFAULTS.shortcuts } }; save(); return current },
}
