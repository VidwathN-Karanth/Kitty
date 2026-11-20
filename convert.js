// File converter for the island's Convert page: images to any image format (or into a PDF), Word to PDF, PDF to Word.
// Images: sharp (libvips, off the main thread). BMP and ICO are written here; BMP, ICO and HEIC are read with
// Windows' own decoders. Documents: Microsoft Word when installed (its own converter, best result), else LibreOffice,
// else (Word to PDF only) a built-in page render. The job lives here, so it survives the island closing.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { app, BrowserWindow } = require('electron')

const LINUX = process.platform === 'linux'
let sharpLib
const sharp = (...a) => (sharpLib ??= require('sharp'))(...a) // native, loaded on first use

// ---------- formats ----------
const IMAGES_OUT = ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff', 'bmp', 'ico']
const KIND = { png: 'image', jpg: 'image', webp: 'image', avif: 'image', gif: 'image', tiff: 'image', bmp: 'image', ico: 'image', heic: 'image', svg: 'image', pdf: 'pdf', docx: 'word', doc: 'word', odt: 'word', rtf: 'word' }
const EXT = { jpeg: 'jpg', jpe: 'jpg', jfif: 'jpg', tif: 'tiff', heif: 'heic', hif: 'heic' }
// what a format can become
function targets(from) {
  const k = KIND[from]
  if (k === 'image') return [...IMAGES_OUT.filter((f) => f !== from), 'pdf']
  if (k === 'pdf') return ['docx']
  if (k === 'word') return from === 'docx' ? ['pdf'] : ['pdf', 'docx']
  return []
}

// The real format from the file's first bytes (a renamed file is still found out); the extension only as a last word
function detect(file) {
  let b
  try { const fd = fs.openSync(file, 'r'); b = Buffer.alloc(4096); b = b.subarray(0, fs.readSync(fd, b, 0, 4096, 0)); fs.closeSync(fd) } catch { return null }
  const s = (o, n) => b.toString('latin1', o, o + n)
  const ext = path.extname(file).slice(1).toLowerCase()
  const byExt = KIND[EXT[ext] ?? ext] ? (EXT[ext] ?? ext) : null
  if (b.length < 4) return byExt
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (s(0, 4) === 'GIF8') return 'gif'
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp'
  if (s(0, 2) === 'BM' && b.length > 26) return 'bmp'
  if (b.readUInt32BE(0) === 0x00000100) return 'ico'
  if (s(0, 4) === 'II*\0' || s(0, 4) === 'MM\0*') return 'tiff'
  if (s(4, 4) === 'ftyp') { // HEIF family: the brands say AVIF or HEIC
    const brands = s(8, Math.min(64, b.length - 8))
    if (/avi[fs]/.test(brands)) return 'avif'
    if (/hei[cxms]|hev[cx]|mif1|msf1/.test(brands)) return 'heic'
  }
  if (s(0, 5) === '%PDF-') return 'pdf'
  if (s(0, 4) === 'PK\x03\x04') return ['docx', 'odt'].includes(byExt) ? byExt : b.includes('word/') ? 'docx' : b.includes('opendocument.text') ? 'odt' : byExt
  if (b.readUInt32BE(0) === 0xd0cf11e0) return byExt === 'doc' ? 'doc' : byExt ?? 'doc'
  if (s(0, 5) === '{\\rtf') return 'rtf'
  if (/<svg[\s>]/i.test(s(0, b.length))) return 'svg'
  return byExt
}

// ---------- images ----------
// BMP, ICO, HEIC (and anything else sharp can't read): Windows' own decoders turn it into a PNG first
async function decodeWithWindows(file) {
  if (LINUX) throw new Error('This kind of image can\'t be read on Linux')
  const tmp = path.join(os.tmpdir(), `kitty-convert-${process.pid}-${Date.now()}.png`)
  try {
    await ps(['wic', file, tmp], 60000)
    return fs.readFileSync(tmp)
  } catch (e) {
    throw new Error(/heic|heif/i.test(file) ? 'Windows can\'t read this HEIC photo (install "HEVC Video Extensions" from the Microsoft Store)' : 'Windows couldn\'t read this image')
  } finally { fs.rmSync(tmp, { force: true }) }
}
async function source(file, from) {
  return ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff', 'svg'].includes(from) ? file : decodeWithWindows(file)
}
// 24-bit BMP (the kind every app opens), bottom-up rows padded to 4 bytes
function bmp(rgb, w, h) {
  const row = Math.ceil((w * 3) / 4) * 4, size = 54 + row * h, b = Buffer.alloc(size)
  b.write('BM', 0, 'latin1'); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14)
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28)
  b.writeUInt32LE(row * h, 34); b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42) // 72 dpi
  for (let y = 0; y < h; y++) {
    const o = 54 + (h - 1 - y) * row
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; b[o + x * 3] = rgb[i + 2]; b[o + x * 3 + 1] = rgb[i + 1]; b[o + x * 3 + 2] = rgb[i] }
  }
  return b
}
// ICO with PNG images inside (Windows Vista and later), several sizes so it looks sharp everywhere
function ico(pngs, sizes) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
  let off = head.length
  pngs.forEach((p, i) => {
    const e = 6 + 16 * i, s = sizes[i] >= 256 ? 0 : sizes[i]
    head[e] = s; head[e + 1] = s; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(p.length, e + 8); head.writeUInt32LE(off, e + 12); off += p.length
  })
  return Buffer.concat([head, ...pngs])
}
async function image(file, from, to) {
  try { return await encode(file, from, to) }
  catch (e) { throw /unsupported image|input buffer|corrupt|premature end|not a known|bad seek|improper/i.test(e.message) ? new Error(`This doesn't look like a real ${from.toUpperCase()} (pick another type under From)`) : e }
}
async function encode(file, from, to) {
  const input = await source(file, from)
  const animated = ['gif', 'webp'].includes(from) && ['gif', 'webp'].includes(to) // keep the animation
  const img = () => sharp(input, { animated, density: from === 'svg' ? 300 : undefined }).rotate() // camera orientation applied
  switch (to) {
    case 'png': return img().png().toBuffer()
    case 'jpg': return img().flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
    case 'webp': return img().webp({ quality: 90 }).toBuffer()
    case 'avif': return img().avif({ quality: 60 }).toBuffer()
    case 'gif': return img().gif().toBuffer()
    case 'tiff': return img().tiff({ compression: 'lzw' }).toBuffer()
    case 'bmp': {
      const { data, info } = await img().flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true })
      return bmp(data, info.width, info.height)
    }
    case 'ico': {
      const sizes = [16, 32, 48, 256]
      return ico(await Promise.all(sizes.map((s) => img().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())), sizes)
    }
  }
  throw new Error(`Can't make ${to.toUpperCase()} from an image`)
}

// ---------- PDFs made by Chromium (images into a PDF; Word to PDF without Word) ----------
async function printPdf(html, dir) {
  const page = path.join(dir, 'page.html')
  fs.writeFileSync(page, html)
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await w.loadFile(page) // resolves after the images have loaded
    return await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true })
  } finally { w.destroy() }
}
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kitty-convert-'))
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
// one image per A4 page, as big as fits, portrait or landscape to suit it
async function imagesToPdf(items) {
  const dir = tempDir()
  try {
    const pages = []
    for (const [i, it] of items.entries()) {
      const input = await source(it.path, it.from)
      const s = sharp(input, { density: it.from === 'svg' ? 300 : undefined }).rotate()
      const m = await sharp(await s.clone().png().toBuffer()).metadata()
      const name = `${i}.${m.hasAlpha ? 'png' : 'jpg'}`
      await (m.hasAlpha ? s.png() : s.flatten({ background: '#fff' }).jpeg({ quality: 92 })).toFile(path.join(dir, name))
      pages.push({ name, wide: m.width > m.height })
    }
    const css = '@page { size: A4; margin: 0 } @page wide { size: A4 landscape; margin: 0 } html, body { margin: 0 } ' +
      '.p { width: 210mm; height: 297mm; display: flex; align-items: center; justify-content: center; break-after: page; overflow: hidden } ' +
      '.p.w { page: wide; width: 297mm; height: 210mm } img { max-width: calc(100% - 20mm); max-height: calc(100% - 20mm); object-fit: contain }'
    const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>` + pages.map((p) => `<div class="p${p.wide ? ' w' : ''}"><img src="${p.name}"></div>`).join('')
    return await printPdf(html, dir)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
async function wordToPdfBuiltIn(file) {
  const { value } = await require('mammoth').convertToHtml({ path: file })
  const dir = tempDir()
  try {
    const css = '@page { size: A4; margin: 22mm 20mm } body { font: 11pt/1.45 Calibri, "Segoe UI", Arial, sans-serif; color: #111 } ' +
      'h1, h2, h3 { line-height: 1.2 } table { border-collapse: collapse; margin: 6pt 0 } td, th { border: 1px solid #999; padding: 4pt 6pt; vertical-align: top } img { max-width: 100% }'
    return await printPdf(`<!doctype html><meta charset="utf-8"><style>${css}</style>${value}`, dir)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

// ---------- Word and LibreOffice ----------
const helper = path.join(__dirname, 'convert.ps1').replace('app.asar', 'app.asar.unpacked') // PowerShell can't read inside the asar
function ps(args, timeout, onLine) {
  return new Promise((ok, fail) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', helper, ...args], { windowsHide: true })
    let out = '', err = '', buf = ''
    const t = setTimeout(() => { p.kill(); fail(new Error('Took too long')) }, timeout)
    p.stdout.setEncoding('utf8')
    p.stdout.on('data', (d) => { out += d; buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) onLine?.(l) } })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', (e) => { clearTimeout(t); fail(e) })
    p.on('close', (code) => { clearTimeout(t); code === 0 ? ok(out) : fail(new Error(err.trim().split('\n')[0] || 'Failed')) })
  })
}
let word // is Microsoft Word installed? (asked once)
const hasWord = () => (word ??= !LINUX && ps(['hasword'], 20000).then((o) => o.trim() === 'yes').catch(() => false))
function soffice() {
  const c = LINUX ? ['/usr/bin/soffice', '/usr/bin/libreoffice', '/usr/local/bin/soffice', '/snap/bin/libreoffice', '/opt/libreoffice/program/soffice']
    : [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map((d) => path.join(d, 'LibreOffice', 'program', 'soffice.exe'))
  return c.find((p) => fs.existsSync(p)) ?? null
}
function libreOffice(file, to) {
  const exe = soffice()
  if (!exe) return null
  const dir = tempDir()
  const args = ['--headless', '--norestore', '--nolockcheck', ...(to === 'docx' && detect(file) === 'pdf' ? ['--infilter=writer_pdf_import'] : []),
    '--convert-to', to === 'docx' ? 'docx:MS Word 2007 XML' : 'pdf', '--outdir', dir, file]
  return new Promise((ok, fail) => {
    const p = spawn(exe, args, { windowsHide: true })
    const t = setTimeout(() => { p.kill(); fail(new Error('Took too long')) }, 180000)
    p.on('error', (e) => { clearTimeout(t); fail(e) })
    p.on('close', () => {
      clearTimeout(t)
      const made = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith('.' + to))
      if (!made) { fs.rmSync(dir, { recursive: true, force: true }); return fail(new Error('LibreOffice couldn\'t convert it')) }
      const buf = fs.readFileSync(path.join(dir, made)); fs.rmSync(dir, { recursive: true, force: true }); ok(buf)
    })
  })
}

// ---------- output files ----------
function outPath(src, ext, dir) {
  const base = path.join(dir, path.parse(src).name)
  let p = `${base}.${ext}`
  for (let i = 1; fs.existsSync(p); i++) p = `${base} (${i}).${ext}`
  return p
}
// next to the original; if that folder can't be written to, into Downloads
function save(src, ext, buf, nameFrom = src) {
  try { const p = outPath(nameFrom, ext, path.dirname(src)); fs.writeFileSync(p, buf, { flag: 'wx' }); return p }
  catch (e) { if (!['EACCES', 'EPERM', 'EROFS'].includes(e.code)) throw e }
  const p = outPath(nameFrom, ext, app.getPath('downloads')); fs.writeFileSync(p, buf, { flag: 'wx' }); return p
}

// ---------- the job ----------
let state = { files: [], from: 'auto', to: null, combine: true, running: false, results: {} }
let push = () => {}
// What the page shows: the job, plus what all the files can become (only formats every one of them can turn into)
// and the format they share when they all have the same one (that is what "From" shows when left on auto).
const ORDER = [...IMAGES_OUT, 'pdf', 'docx']
function view() {
  // a file that already is the target just stays as it is, so with mixed files their own formats count too
  const froms = state.files.map(fmtOf).filter(Boolean)
  const sets = froms.map((f) => [...targets(f), f])
  const toOptions = sets.length ? ORDER.filter((t) => sets.every((s) => s.includes(t)) && !froms.every((f) => f === t)) : []
  const formats = [...new Set(state.files.map((f) => f.format))]
  return { ...state, toOptions, detected: formats.length === 1 ? formats[0] : null, mixed: formats.length > 1 }
}
const set = (p) => {
  state = { ...state, ...p }
  if (state.to && !view().toOptions.includes(state.to)) state = { ...state, to: null } // no longer possible: pick again
  const only = view().toOptions
  if (!state.to && only.length === 1 && !state.running) state = { ...state, to: only[0] } // only one thing they can become: picked already
  push(view())
}
const result = (file, r) => set({ results: { ...state.results, [file]: r } })
const fmtOf = (f) => (state.from === 'auto' ? f.format : state.from)

function add(paths) {
  if (state.running) return
  const have = new Set(state.files.map((f) => f.path))
  const files = [...state.files]
  for (const p of [].concat(paths)) {
    if (typeof p !== 'string' || have.has(p)) continue
    let st; try { st = fs.statSync(p) } catch { continue }
    if (!st.isFile()) continue
    files.push({ path: p, name: path.basename(p), size: st.size, format: detect(p) }); have.add(p)
  }
  set({ files, results: {} })
}

async function run() {
  if (state.running || !state.to || !state.files.length) return
  const to = state.to
  set({ running: true, results: Object.fromEntries(state.files.map((f) => [f.path, { status: 'waiting' }])) })
  const items = state.files.map((f) => ({ ...f, from: fmtOf(f) }))
  const ok = (it) => it.from && targets(it.from).includes(to)
  for (const it of items) {
    if (it.from === to) result(it.path, { status: 'skip', error: `Already ${to.toUpperCase()}` })
    else if (!ok(it)) result(it.path, { status: 'error', error: it.from ? `A ${it.from.toUpperCase()} can't become ${to.toUpperCase()}` : 'Unknown file type' })
  }
  const todo = items.filter(ok)
  const done = (it, buf, nameFrom) => result(it.path, { status: 'done', out: save(it.path, to === 'jpg' ? 'jpg' : to, buf, nameFrom) })
  const fail = (it, e) => result(it.path, { status: 'error', error: e.message || String(e) })
  try {
    // images (and images into one PDF)
    const imgs = todo.filter((it) => KIND[it.from] === 'image')
    if (to === 'pdf' && state.combine && imgs.length > 1) {
      imgs.forEach((it) => result(it.path, { status: 'working' }))
      try {
        const buf = await imagesToPdf(imgs)
        const out = save(imgs[0].path, 'pdf', buf, path.join(path.dirname(imgs[0].path), `${path.parse(imgs[0].path).name} and ${imgs.length - 1} more`))
        imgs.forEach((it) => result(it.path, { status: 'done', out }))
      } catch (e) { imgs.forEach((it) => fail(it, e)) }
    } else {
      for (const it of imgs) {
        result(it.path, { status: 'working' })
        try { done(it, to === 'pdf' ? await imagesToPdf([it]) : await image(it.path, it.from, to)) } catch (e) { fail(it, e) }
      }
    }
    // documents: one Word session for all of them, else LibreOffice, else the built-in Word to PDF
    const docs = todo.filter((it) => KIND[it.from] !== 'image')
    if (docs.length) {
      if (await hasWord()) {
        const dir = tempDir()
        // Word gets a fresh-named copy: a file it once choked on would make it ask "open it anyway?" (a dialog nobody
        // can see), and odd characters in names can't trip it
        const jobs = docs.map((it, i) => {
          const copy = path.join(dir, `in-${i}${path.extname(it.path) || '.' + it.from}`)
          fs.copyFileSync(it.path, copy)
          return { id: i, in: copy, out: path.join(dir, `${i}.${to}`), fmt: to === 'pdf' ? 17 : 16 }
        })
        const jobFile = path.join(dir, 'jobs.json')
        fs.writeFileSync(jobFile, JSON.stringify(jobs))
        docs.forEach((it) => result(it.path, { status: 'working' }))
        let wordPid = null // the hidden Word started for this run
        try {
          await ps(['word', jobFile], 120000 + docs.length * 180000, (line) => {
            try {
              const m = JSON.parse(line), it = docs[m.id]
              if (m.pid) wordPid = m.pid
              if (!it) return
              if (m.ok && fs.existsSync(jobs[m.id].out)) done(it, fs.readFileSync(jobs[m.id].out))
              else fail(it, new Error(m.error ? `Word: ${m.error}` : 'Word couldn\'t convert it'))
            } catch {}
          })
        } catch (e) {
          if (wordPid) try { process.kill(wordPid) } catch {} // stuck (a dialog nobody can see): don't leave it running
          docs.forEach((it) => { if (state.results[it.path]?.status === 'working') fail(it, e) })
        }
        finally { fs.rmSync(dir, { recursive: true, force: true }) }
      } else {
        for (const it of docs) {
          result(it.path, { status: 'working' })
          try {
            const lo = libreOffice(it.path, to)
            if (lo) done(it, await lo)
            else if (to === 'pdf' && it.from === 'docx') done(it, await wordToPdfBuiltIn(it.path))
            else throw new Error(to === 'docx' ? 'PDF to Word needs Microsoft Word or LibreOffice' : `${it.from.toUpperCase()} files need Microsoft Word or LibreOffice`)
          } catch (e) { fail(it, e) }
        }
      }
    }
  } finally { set({ running: false }) }
}

module.exports = {
  start: (onState) => { push = onState },
  get: () => view(),
  add,
  remove: (p) => { if (!state.running) set({ files: state.files.filter((f) => f.path !== p), results: {} }) },
  clear: () => { if (!state.running) set({ files: [], results: {}, from: 'auto' }) },
  set: (p) => { if (!state.running) set({ ...(p.from !== undefined && { from: p.from }), ...(p.to !== undefined && { to: p.to }), ...(p.combine !== undefined && { combine: !!p.combine }), results: {} }) },
  run,
  // only files this job made can be opened or shown
  isOutput: (p) => Object.values(state.results).some((r) => r.out === p),
  FROM: Object.keys(KIND), targets, detect,
  _image: image, // for tools/convert.check.js
}
