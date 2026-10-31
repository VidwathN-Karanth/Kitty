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
  lightPreset: 'neon', lightWork: '#ffe600', lightDone: '#39ff14', lightError: '#ff1744',

  // sounds & notifications
  sounds: true, soundLevel: 'normal', notifications: true, confetti: true,
  warnAt: 80,             // % of the 5-hour budget (0 = never)
  usageBudget: 1000000,   // tokens you consider "full" for 5 hours (Kitty cannot see your plan's real limit)

  // island
  musicGlow: 'adaptive', // running light around the island while music plays: adaptive | rainbow | white | off
  islandTop: '#000000', islandBottom: '#000000', // island background (same = solid, different = gradient)
  songTicker: true,       // scrolling song title next to the cat while music plays
  speed: 'fast', volumeBar: true, showBattery: true, batteryWarning: true, privacyDot: true,
  weatherCity: '', calendarUrl: '',
  startWithWindows: true, // starts with Windows and shows in Windows' Startup apps list
  testMode: false,
  // system stats: which ones, and where (the resting notch and/or the open island)
  stats: { cpu: true, ram: true, gpu: true }, statsRest: true, statsOpen: true,
  peekOnQuestion: true,   // open the island when Claude asks something (finishing only plays the sound + dot)

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
  stats: { ...base.stats, ...(p.stats || {}) },
})

function load(dir) {
  file = path.join(dir, 'settings.json')
  try { current = merge(DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf8'))) } catch {}
  // one-time switch-on for people whose settings were saved while the default was still "off"
  if (!current.autostartSet) { current = { ...current, startWithWindows: true, autostartSet: true }; save() }
  // one-time move from the old default lights to neon (custom colours are kept)
  if (!current.neonSet) { if (current.lightPreset === 'classic') current = { ...current, lightPreset: 'neon', lightWork: '#ffe600', lightDone: '#39ff14', lightError: '#ff1744' }; current.neonSet = true; save() }
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
