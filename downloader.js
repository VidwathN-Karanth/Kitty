// Downloader for the island's Download page: a YouTube or Instagram link -> video (always with its sound, MP4) or
// audio (MP3), into Downloads. It runs yt-dlp (the open-source downloader) with ffmpeg (joins HD video with its
// sound, makes the MP3). Both come from their official GitHub releases into Kitty's own folder, the first time the
// user asks for them; yt-dlp keeps itself up to date (sites change often). On Linux an installed ffmpeg is used.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { app, net } = require('electron')

const LINUX = process.platform === 'linux'
const GH = 'https://github.com/yt-dlp'
const SRC = {
  ytdlp: LINUX ? `${GH}/yt-dlp/releases/latest/download/yt-dlp_linux` : `${GH}/yt-dlp/releases/latest/download/yt-dlp.exe`,
  ffmpeg: LINUX ? `${GH}/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz` : `${GH}/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip`,
}
const SIZE_MB = LINUX ? { ytdlp: 39, ffmpeg: 62 } : { ytdlp: 23, ffmpeg: 196 } // shown before anything is fetched
const bin = () => path.join(app.getPath('userData'), 'bin')
const exe = (n) => path.join(bin(), LINUX ? n : `${n}.exe`)
const systemFfmpeg = () => (LINUX ? ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find((p) => fs.existsSync(p)) : null)
const ffmpegDir = () => (fs.existsSync(exe('ffmpeg')) ? bin() : systemFfmpeg() ? path.dirname(systemFfmpeg()) : null)

// ---------- links ----------
// only YouTube (videos, shorts, music) and Instagram (posts, reels, tv)
function site(raw) {
  let u
  try { u = new URL(String(raw).trim()) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  const h = u.hostname.replace(/^(www|m)\./, '')
  if (h === 'youtu.be' || h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') return /\/(watch|shorts|live|embed)|youtu\.be\/./.test(u.href) || u.searchParams.has('v') ? 'youtube' : null
  if (h === 'instagram.com' && /^\/(p|reel|reels|tv)\/[\w-]+/.test(u.pathname)) return 'instagram'
  return null
}

// ---------- state ----------
let state = { tools: { ytdlp: false, ffmpeg: false }, size: SIZE_MB, setup: null, jobs: [] }
let push = () => {}
const set = (p) => { state = { ...state, ...p }; push(state) }
const tools = () => ({ ytdlp: fs.existsSync(exe('yt-dlp')), ffmpeg: !!ffmpegDir() })
const job = (id, p) => set({ jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) })

// ---------- getting the tools ----------
async function fetchTo(url, file, onPct) {
  const res = await net.fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const total = +res.headers.get('content-length') || 0
  const tmp = file + '.part', out = fs.createWriteStream(tmp)
  let got = 0, last = 0
  try {
    for await (const chunk of res.body) {
      got += chunk.length
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r))
      if (total && Date.now() - last > 200) { last = Date.now(); onPct(Math.round((got / total) * 100)) }
    }
  } finally { await new Promise((r) => out.end(r)) }
  if (total && got !== total) { fs.rmSync(tmp, { force: true }); throw new Error('Download was cut off') }
  fs.renameSync(tmp, file)
}
const run = (cmd, args, timeout = 300000) => new Promise((ok, fail) => {
  const p = spawn(cmd, args, { windowsHide: true })
  let err = ''
  const t = setTimeout(() => { p.kill(); fail(new Error('Took too long')) }, timeout)
  p.stderr?.on('data', (d) => { err += d })
  p.on('error', (e) => { clearTimeout(t); fail(e) })
  p.on('close', (c) => { clearTimeout(t); c === 0 ? ok() : fail(new Error(err.trim().split('\n').pop() || `exit ${c}`)) })
})
function findIn(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { const f = findIn(p, name); if (f) return f } else if (e.name === name) return p
  }
  return null
}
async function setup() {
  if (state.setup) return
  fs.mkdirSync(bin(), { recursive: true })
  try {
    if (!fs.existsSync(exe('yt-dlp'))) {
      set({ setup: { step: 'yt-dlp', pct: 0 } })
      await fetchTo(SRC.ytdlp, exe('yt-dlp'), (pct) => set({ setup: { step: 'yt-dlp', pct } }))
      if (LINUX) fs.chmodSync(exe('yt-dlp'), 0o755)
      fs.writeFileSync(path.join(bin(), '.updated'), String(Date.now()))
    }
    if (!ffmpegDir()) {
      set({ setup: { step: 'ffmpeg', pct: 0 } })
      const archive = path.join(os.tmpdir(), `kitty-ffmpeg-${Date.now()}${LINUX ? '.tar.xz' : '.zip'}`)
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitty-ffmpeg-'))
      try {
        await fetchTo(SRC.ffmpeg, archive, (pct) => set({ setup: { step: 'ffmpeg', pct } }))
        set({ setup: { step: 'unpacking', pct: 100 } })
        if (LINUX) await run('tar', ['-xJf', archive, '-C', dir])
        else await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`])
        for (const n of ['ffmpeg', 'ffprobe']) {
          const f = findIn(dir, LINUX ? n : `${n}.exe`)
          if (!f) throw new Error(`${n} wasn't in the download`)
          fs.copyFileSync(f, exe(n)); if (LINUX) fs.chmodSync(exe(n), 0o755)
        }
      } finally { fs.rmSync(archive, { force: true }); fs.rmSync(dir, { recursive: true, force: true }) }
    }
    set({ setup: null, tools: tools() })
  } catch (e) { set({ setup: { step: 'error', error: e.message }, tools: tools() }) }
}
// sites change their pages often; a yt-dlp a few days old may no longer work
async function freshen() {
  const mark = path.join(bin(), '.updated')
  let at = 0; try { at = +fs.readFileSync(mark, 'utf8') } catch {}
  if (Date.now() - at < 3 * 86400000) return
  try { await run(exe('yt-dlp'), ['-U'], 120000) } catch {} // offline or no update: keep the one we have
  fs.writeFileSync(mark, String(Date.now()))
}

// ---------- downloading ----------
const procs = new Map()
const plain = (msg) => {
  const m = String(msg)
  if (/private video/i.test(m)) return 'This video is private'
  if (/sign in to confirm your age|age-restricted/i.test(m)) return 'This video is age-restricted (YouTube wants a sign-in)'
  if (/sign in to confirm you.re not a bot/i.test(m)) return 'YouTube is asking for a sign-in right now. Try again in a while'
  if (/login required|rate-limit|empty media response|requested content is not available/i.test(m)) return 'Instagram wants you signed in for this post (or is limiting downloads for now)'
  if (/video unavailable|not available/i.test(m)) return 'This video isn\'t available'
  if (/unable to download webpage|getaddrinfo|timed out|network/i.test(m)) return 'No connection to the site'
  if (/ffmpeg/i.test(m)) return 'ffmpeg is needed for this (get the downloader again)'
  return m.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, '').slice(0, 140) || 'Download failed'
}
async function start(url, kind) {
  const where = site(url)
  if (!where) return
  if (!tools().ytdlp) return
  const id = Date.now().toString(36)
  set({ jobs: [{ id, url: String(url).trim(), site: where, kind: kind === 'audio' ? 'audio' : 'video', status: 'working', pct: 0, speed: '', eta: '', title: '' }, ...state.jobs].slice(0, 6) })
  await freshen()
  const ff = ffmpegDir()
  const temp = path.join(os.tmpdir(), 'kitty-downloads')
  const args = ['--newline', '--no-playlist', '--no-mtime', '--windows-filenames', '--no-warnings',
    '-P', `home:${app.getPath('downloads')}`, '-P', `temp:${temp}`, '-o', '%(title).150B [%(id)s].%(ext)s',
    '--progress', '--progress-template', 'download:KITTY|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--no-simulate', '--print', 'before_dl:KITTYTITLE|%(title)s', '--print', 'after_move:KITTYFILE|%(filepath)s',
    ...(ff ? ['--ffmpeg-location', ff] : []),
    ...(kind === 'audio'
      ? ff ? ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0'] : ['-f', 'ba[ext=m4a]/ba']
      // video always with its sound: phone-friendly H.264 + AAC first, else the best there is, joined into an MP4
      : ff ? ['-f', 'bv*[vcodec^=avc1]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b', '--merge-output-format', 'mp4'] : ['-f', 'b[vcodec!=none][acodec!=none]']),
    '--', String(url).trim()]
  const p = spawn(exe('yt-dlp'), args, { windowsHide: true })
  procs.set(id, p)
  let err = '', buf = '', out = null, phase = 0
  p.stdout.setEncoding('utf8')
  p.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      if (l.startsWith('KITTYTITLE|')) job(id, { title: l.slice(11) })
      else if (l.startsWith('KITTYFILE|')) out = l.slice(10)
      else if (l.startsWith('KITTY|')) {
        const [, pct, speed, eta] = l.split('|')
        const n = parseFloat(pct) || 0
        if (n >= 100) phase++ // video and audio come separately: two runs to 100%
        job(id, { pct: Math.min(99, kind === 'video' && ff ? Math.round((phase ? 50 : 0) + n / 2) : Math.round(n)), speed: speed?.trim() === 'Unknown B/s' ? '' : speed?.trim(), eta: eta?.trim() === 'Unknown' ? '' : eta?.trim() })
      }
    }
  })
  p.stderr.on('data', (d) => { err += d })
  p.on('error', (e) => { procs.delete(id); job(id, { status: 'error', error: e.message }) })
  p.on('close', (code) => {
    const cancelled = procs.get(id) === null
    procs.delete(id)
    if (cancelled) return job(id, { status: 'cancelled' })
    if (code === 0 && out && fs.existsSync(out)) job(id, { status: 'done', pct: 100, out, title: state.jobs.find((j) => j.id === id)?.title || path.parse(out).name })
    else job(id, { status: 'error', error: plain(err.split('\n').filter((l) => /ERROR/.test(l)).pop() || err.trim().split('\n').pop() || `yt-dlp stopped (${code})`) })
  })
}
function cancel(id) { const p = procs.get(id); if (p) { procs.set(id, null); p.kill() } }

module.exports = {
  start: (onState) => { push = onState; state = { ...state, tools: tools() } },
  get: () => ({ ...state, tools: tools() }),
  site, setup, download: start, cancel,
  clear: () => set({ jobs: state.jobs.filter((j) => j.status === 'working') }),
  isOutput: (p) => state.jobs.some((j) => j.out === p),
}
