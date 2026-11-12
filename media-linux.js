// Linux twin of media.ps1: same JSON lines on stdout, same commands on stdin (toggle | next | prev | vol <0-1> | mute |
// gpu on | gpu off). Run by Kitty's own Node (ELECTRON_RUN_AS_NODE). It asks the usual desktop tools and quietly
// skips whatever a PC doesn't have:
//   music: playerctl (MPRIS: Spotify, browsers, VLC...)   volume: wpctl (PipeWire) or pactl (PulseAudio)
//   radios: rfkill + nmcli   microphone in use: pactl   GPU: nvidia-smi or the AMD/Intel busy percentage in /sys
// Exits when stdin closes.
const { execFile } = require('child_process')
const fs = require('fs')

const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const missing = new Set() // tools this PC doesn't have: never asked again
function run(cmd, args) {
  return new Promise((ok) => {
    if (missing.has(cmd)) return ok(null)
    execFile(cmd, args, { timeout: 3000, maxBuffer: 1 << 20 }, (err, out) => {
      if (err?.code === 'ENOENT') missing.add(cmd)
      ok(err ? null : String(out))
    })
  })
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------- music (MPRIS through playerctl) ----------
// every player at once; prefer the one already shown, then one that is playing, so the title doesn't flip
const FMT = ['{{playerName}}', '{{status}}', '{{xesam:title}}', '{{xesam:artist}}', '{{position}}', '{{mpris:length}}', '{{mpris:artUrl}}'].join('\t')
let player = '', key = ''
async function music() {
  const out = await run('playerctl', ['-a', 'metadata', '--format', FMT])
  const all = (out || '').split('\n').filter(Boolean).map((l) => {
    const [name, status, title, artist, pos, len, art] = l.split('\t')
    return { name, status, title, artist, pos: +pos / 1e6 || 0, end: +len / 1e6 || 0, art }
  })
  const p = all.find((x) => x.status === 'Playing' && `${x.title}|${x.artist}` === key) || all.find((x) => x.status === 'Playing') || all.find((x) => x.name === player) || all[0]
  const state = p
    ? { type: 'state', active: true, title: p.title, artist: p.artist, playing: p.status === 'Playing', pos: Math.round(p.pos * 10) / 10, end: Math.round(p.end * 10) / 10, app: p.name }
    : { type: 'state', active: false, sessions: 0 }
  player = p?.name || ''
  emit(state) // sent every round, like on Windows: the position keeps moving
  if (p && `${p.title}|${p.artist}` !== key) { key = `${p.title}|${p.artist}`; art(p.art) }
  if (!p) key = ''
}
async function art(url) {
  try {
    let bytes
    if (/^file:\/\//.test(url || '')) bytes = fs.readFileSync(decodeURIComponent(new URL(url).pathname))
    else if (/^https?:\/\//.test(url || '')) bytes = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(5000) })).arrayBuffer())
    if (!bytes?.length) return
    const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png'
    emit({ type: 'art', mime, data: bytes.toString('base64') })
  } catch {}
}

// ---------- volume ----------
let lastVol = null
async function volume() {
  let v = null, mute = false
  const w = await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@']) // "Volume: 0.40 [MUTED]"
  if (w) { const m = w.match(/([\d.]+)/); if (m) { v = Math.min(1, +m[1]); mute = /MUTED/.test(w) } }
  else {
    const p = await run('pactl', ['get-sink-volume', '@DEFAULT_SINK@']) // "... / 40% / ..."
    const m = p?.match(/(\d+)%/)
    if (m) { v = Math.min(1, +m[1] / 100); mute = /yes/i.test((await run('pactl', ['get-sink-mute', '@DEFAULT_SINK@'])) || '') }
  }
  if (v === null) return
  const now = { type: 'vol', v: Math.round(v * 1000) / 1000, mute }
  if (!same(now, lastVol)) { lastVol = now; emit(now) }
}
// a dragged slider sends many values: one change runs at a time, and only the latest value waits for it
let volTarget = null, volBusy = false
async function setVolume(x) {
  volTarget = Math.max(0, Math.min(1, +x || 0))
  if (volBusy) return
  volBusy = true
  while (volTarget !== null) {
    const v = volTarget; volTarget = null
    if (!missing.has('wpctl')) await run('wpctl', ['set-volume', '@DEFAULT_AUDIO_SINK@', v.toFixed(3)])
    else await run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', Math.round(v * 100) + '%'])
  }
  volBusy = false
  volume()
}
function toggleMute() {
  if (!missing.has('wpctl')) run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', 'toggle']).then(volume)
  else run('pactl', ['set-sink-mute', '@DEFAULT_SINK@', 'toggle']).then(volume)
}

// ---------- radios: airplane mode, Wi-Fi, Bluetooth ----------
let lastAir = null, lastRadios = null
async function radios() {
  const out = await run('rfkill', ['-J', '-o', 'TYPE,SOFT,HARD'])
  let list = []
  try { list = JSON.parse(out || '{}').rfkilldevices || [] } catch {}
  const on = (t) => { const r = list.filter((x) => x.type === t); return r.length ? (r.some((x) => x.soft === 'unblocked' && x.hard === 'unblocked') ? 'on' : 'off') : null }
  let wifi = on('wlan'), bt = on('bluetooth')
  if (wifi === 'on' && /^wifi:connected/m.test((await run('nmcli', ['-t', '-f', 'TYPE,STATE', 'device'])) || '')) wifi = 'connected'
  const air = list.length > 0 && list.every((x) => x.soft !== 'unblocked' || x.hard !== 'unblocked')
  if (air !== lastAir) { lastAir = air; emit({ type: 'air', on: air }) }
  const r = { type: 'radios', wifi, bt }
  if (!same(r, lastRadios)) { lastRadios = r; emit(r) }
}

// ---------- microphone in use (Linux has no general "camera in use" signal, so the camera dot stays off) ----------
let lastPriv = null
async function privacy() {
  const out = await run('pactl', ['list', 'short', 'source-outputs'])
  const p = { type: 'priv', mic: !!(out && out.trim()), cam: false }
  if (!same(p, lastPriv)) { lastPriv = p; emit(p) }
}

// ---------- GPU usage (only while it is shown) ----------
let gpuOn = false
async function gpu() {
  if (!gpuOn) return
  let g = null
  const n = await run('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'])
  if (n) g = Math.max(...n.split('\n').filter(Boolean).map(Number))
  else {
    try {
      for (const c of fs.readdirSync('/sys/class/drm')) {
        const f = `/sys/class/drm/${c}/device/gpu_busy_percent` // AMD (and some Intel) cards
        if (fs.existsSync(f)) g = Math.max(g ?? 0, +fs.readFileSync(f, 'utf8'))
      }
    } catch {}
  }
  emit({ type: 'gpu', gpu: Number.isFinite(g) ? Math.round(g) : null })
}

// ---------- commands from Kitty ----------
let rest = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => {
  rest += d
  let i
  while ((i = rest.indexOf('\n')) >= 0) {
    const line = rest.slice(0, i).trim(); rest = rest.slice(i + 1)
    const args = player ? ['-p', player] : []
    if (line === 'toggle') run('playerctl', [...args, 'play-pause']).then(music)
    else if (line === 'next') run('playerctl', [...args, 'next']).then(music)
    else if (line === 'prev') run('playerctl', [...args, 'previous']).then(music)
    else if (line.startsWith('vol ')) setVolume(line.slice(4))
    else if (line === 'mute') toggleMute()
    else if (line === 'gpu on') { gpuOn = true; gpu() }
    else if (line === 'gpu off') gpuOn = false
  }
})
process.stdin.on('end', () => process.exit(0))

// ---------- rounds (spawning tools is cheap, but not free: each at its own pace) ----------
const every = (ms, fn) => { const go = () => fn().catch(() => {}).finally(() => setTimeout(go, ms)); go() }
every(1000, music)
every(700, volume)
every(3000, radios)
every(2000, privacy)
every(2000, gpu)
