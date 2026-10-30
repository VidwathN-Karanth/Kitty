// Weather (Open-Meteo, no key), calendar (a Google Calendar "secret iCal address") and Bluetooth battery levels.
// Everything is fetched here in the main process and pushed to the island; nothing leaves the PC except these requests.
const path = require('path')
const { spawn } = require('child_process')
const ical = require('node-ical')

const info = { weather: null, events: [], bt: [] }
let push = () => {}

// ---------- weather ----------
const WMO = (c) =>
  c === 0 ? ['☀️', 'Clear'] : c <= 2 ? ['⛅', 'Partly cloudy'] : c === 3 ? ['☁️', 'Cloudy']
  : c <= 48 ? ['\u{1F32B}️', 'Fog'] : c <= 57 ? ['\u{1F326}️', 'Drizzle'] : c <= 67 ? ['\u{1F327}️', 'Rain']
  : c <= 77 ? ['\u{1F328}️', 'Snow'] : c <= 82 ? ['\u{1F326}️', 'Showers'] : c <= 86 ? ['\u{1F328}️', 'Snow showers'] : ['⛈️', 'Thunderstorm']

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.json()
}
let geo = { city: '', lat: 0, lon: 0, name: '' }
async function refreshWeather(city) {
  city = (city || '').trim()
  if (!city) { info.weather = null; return }
  try {
    if (geo.city !== city) {
      const g = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      const hit = g.results?.[0]
      if (!hit) { info.weather = { error: `Couldn't find "${city}"` }; return }
      geo = { city, lat: hit.latitude, lon: hit.longitude, name: hit.name }
    }
    const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code`)
    const [emoji, text] = WMO(w.current.weather_code)
    info.weather = { city: geo.name, temp: Math.round(w.current.temperature_2m), emoji, text }
  } catch (e) { console.log('[weather]', e.message); if (!info.weather) info.weather = { error: 'Weather unavailable' } }
}

// ---------- calendar ----------
const MEETING = /https:\/\/[^\s<>"')]*(zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)[^\s<>"')]*/i
async function refreshCalendar(url) {
  url = (url || '').trim()
  if (!/^https:\/\//i.test(url)) { info.events = []; return }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error('HTTP ' + r.status) // never log the url itself: it is a secret
    const data = ical.sync.parseICS(await r.text())
    const now = Date.now(), until = now + 36 * 3600 * 1000, out = []
    for (const ev of Object.values(data)) {
      if (ev.type !== 'VEVENT' || !ev.start) continue
      const dur = (ev.end ? +ev.end : +ev.start) - +ev.start
      const starts = ev.rrule
        ? ev.rrule.between(new Date(now - dur), new Date(until), true).filter((d) => !Object.keys(ev.exdate || {}).some((k) => k.startsWith(d.toISOString().slice(0, 10))))
        : [ev.start]
      for (const s of starts) {
        const st = +s, en = st + dur
        if (ev.datetype === 'date') continue // all-day events are not "next up"
        if (en > now && st < until) {
          const text = [ev.location, ev.description, ev.url].filter(Boolean).join(' ')
          out.push({ id: `${ev.uid}:${st}`, title: String(ev.summary || '(no title)'), start: st, end: en, link: text.match(MEETING)?.[0] || '' })
        }
      }
    }
    info.events = out.sort((a, b) => a.start - b.start).slice(0, 5)
  } catch (e) { console.log('[calendar]', e.message); info.events = [] }
}

// ---------- Bluetooth batteries (headphones, mouse...) ----------
function refreshBluetooth() {
  return new Promise((resolve) => {
    let out = ''
    const p = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'bt.ps1').replace('app.asar', 'app.asar.unpacked')], { windowsHide: true })
    p.stdout.on('data', (d) => { out += d })
    p.on('error', () => resolve())
    p.on('close', () => { try { info.bt = JSON.parse(out.trim() || '[]') } catch { info.bt = [] } resolve() })
  })
}

// ---------- scheduling ----------
let cfg = { weatherCity: '', calendarUrl: '' }
async function refreshAll() {
  await Promise.all([refreshWeather(cfg.weatherCity), refreshCalendar(cfg.calendarUrl), refreshBluetooth()])
  push(info)
}
function start(settings, onPush) {
  push = onPush
  cfg = { weatherCity: settings.weatherCity, calendarUrl: settings.calendarUrl }
  refreshAll()
  setInterval(() => refreshWeather(cfg.weatherCity).then(() => push(info)), 30 * 60 * 1000)
  setInterval(() => refreshCalendar(cfg.calendarUrl).then(() => push(info)), 5 * 60 * 1000)
  setInterval(() => refreshBluetooth().then(() => push(info)), 5 * 60 * 1000)
}
// called when settings change: refetch only what changed
function settingsChanged(s) {
  const city = s.weatherCity !== cfg.weatherCity, cal = s.calendarUrl !== cfg.calendarUrl
  cfg = { weatherCity: s.weatherCity, calendarUrl: s.calendarUrl }
  if (city || cal) Promise.all([city && refreshWeather(cfg.weatherCity), cal && refreshCalendar(cfg.calendarUrl)]).then(() => push(info))
}

module.exports = { start, settingsChanged, get: () => info }
