// Turns the three Gemini sprite sheets into the transparent frames Kitty uses.
//
//   npx electron tools/slice-cat-sheets.js sheet1.png sheet2.png sheet3.png
//
// Each sheet is a 3x3 grid on a flat magenta (#FF00FF) background (PNG, JPG or WebP). The script:
//   1. paints over the little Gemini sparkle watermark in the bottom-right corner,
//   2. keys out the magenta (with edge clean-up),
//   3. resizes every frame by the SAME amount so the "normal" cat lands exactly where the app expects it
//      (ear tips at 20% of the frame, chin at 82%, centred), so frames don't jump when they swap,
//   4. saves each cell as a 512x512 PNG named after its mood in src/assets/cat/.
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')

const SHEETS = [
  ['normal', 'happy', 'love', 'surprised', 'curious', 'focused', 'wink', 'sad', 'dizzy'],
  ['sleepy', 'asleep', 'listening', 'angry', 'excited', 'crying', 'laugh', 'shy', 'smug'],
  ['scared', 'bored', 'yawn', 'wave', 'blink', 'look-left', 'look-right', 'look-up', 'look-down'],
]
const OUT = path.join(__dirname, '..', 'src', 'assets', 'cat')
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
// --skip=blink,look-up  leaves frames out (Kitty falls back to the normal frame for them)
const skip = new Set((process.argv.find((a) => a.startsWith('--skip=')) || '').replace('--skip=', '').split(',').filter(Boolean))

const PAGE = `(async (sheets, names) => {
  const S = 512
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('could not read an image')); i.src = src })
  const raw = {}, info = {}
  for (let s = 0; s < 3; s++) {
    const img = await load(sheets[s])
    // whole sheet on a canvas, with the bottom-right watermark painted magenta
    const sh = document.createElement('canvas'); sh.width = img.width; sh.height = img.height
    const sg = sh.getContext('2d'); sg.drawImage(img, 0, 0)
    sg.fillStyle = '#ff00ff'; sg.fillRect(img.width * 0.905, img.height * 0.905, img.width, img.height)
    const cw = img.width / 3, ch = img.height / 3
    for (let i = 0; i < 9; i++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S
      const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'
      const side = Math.min(cw, ch), sx = (i % 3) * cw + (cw - side) / 2, sy = Math.floor(i / 3) * ch + (ch - side) / 2
      g.drawImage(sh, sx, sy, side, side, 0, 0, S, S)
      const d = g.getImageData(0, 0, S, S), p = d.data
      let bg = 0; for (const [x, y] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5]]) { const o = (y * S + x) * 4; bg += Math.min(p[o], p[o + 2]) - p[o + 1] }
      let top = S, bottom = 0, left = S, right = 0, solid = 0
      const fur = []                                             // orange fur pixels, used to line the heads up
      for (let o = 0, k = 0; o < p.length; o += 4, k++) {
        const m = Math.min(p[o], p[o + 2]) - p[o + 1]            // how magenta this pixel is
        let a = 1
        if (m > 150) a = 0; else if (m > 45) a = 1 - (m - 45) / 105
        if (a < 1 && m > 0) { p[o] = Math.max(0, p[o] - m * 0.85); p[o + 2] = Math.max(0, p[o + 2] - m * 0.85) } // no pink fringe
        p[o + 3] = Math.round(a * 255)
        if (a > 0.5) { solid++; const x = k % S, y = (k / S) | 0; if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x
          if (p[o] > 190 && p[o + 1] > 90 && p[o + 1] < 200 && p[o + 2] < 140 && p[o] - p[o + 1] > 40) fur.push(k) }
      }
      g.putImageData(d, 0, 0)
      raw[names[s][i]] = cv
      // head position from the fur only (ignores headphones, hearts, tears, z's): ear tips, chin, and the
      // centre of the ears + forehead band (a waving paw lower down doesn't pull it sideways)
      // ear tips = first row of a solid run of fur (stars, sparkles or a swirl floating above the head don't count)
      const rows = new Array(S).fill(0); for (const k of fur) rows[(k / S) | 0]++
      let ft = 0; while (ft < S - 8 && !rows.slice(ft, ft + 8).every((c) => c >= 4)) ft++
      let fb = S - 1; while (fb > 8 && !rows.slice(fb - 8, fb).every((c) => c >= 4)) fb--
      let sx2 = 0, n2 = 0; for (const k of fur) { const y = (k / S) | 0; if (y <= ft + (fb - ft) * 0.35) { sx2 += k % S; n2++ } }
      info[names[s][i]] = { coverage: solid / (S * S), bg: bg / 4, top, bottom, left, right, ft, fb, fcx: n2 ? sx2 / n2 : S / 2 }
    }
  }
  // one shared size, measured on the calm "normal" face (ear tips -> 20%, chin -> 82%), then every frame is moved
  // so its own ear tips and forehead centre land on the same spot: no jumping when the face changes
  const n = info.normal
  const k = (0.62 * S) / Math.max(1, n.fb - n.ft)
  const out = []
  for (const [name, cv] of Object.entries(raw)) {
    const f = info[name]
    const dx = S / 2 - f.fcx * k, dy = 0.2 * S - f.ft * k
    const o = document.createElement('canvas'); o.width = o.height = S
    const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'
    g.drawImage(cv, dx, dy, S * k, S * k)
    out.push({ name, png: o.toDataURL('image/png').split(',')[1], ...info[name] })
  }
  return { out, scale: k }
})`

app.setPath('userData', path.join(os.tmpdir(), 'kitty-slicer'))
app.whenReady().then(async () => {
  if (args.length !== 3) { console.log('Usage: npx electron tools/slice-cat-sheets.js sheet1.png sheet2.png sheet3.png [--skip=blink]'); return app.exit(1) }
  fs.mkdirSync(OUT, { recursive: true })
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f)) // start clean
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  const mime = (f) => ({ jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', png: 'png' }[path.extname(f).slice(1).toLowerCase()] || 'png')
  const sheets = args.map((f) => `data:image/${mime(f)};base64,` + fs.readFileSync(f).toString('base64'))
  let res
  try { res = await win.webContents.executeJavaScript(`${PAGE}(${JSON.stringify(sheets)}, ${JSON.stringify(SHEETS)})`) }
  catch (e) { console.log(e.message); return app.exit(1) }
  let problems = 0
  for (const c of res.out) {
    if (skip.has(c.name)) { console.log(`skip     ${c.name}`); continue }
    fs.writeFileSync(path.join(OUT, c.name + '.png'), Buffer.from(c.png, 'base64'))
    const warn = c.bg < 120 ? '  <-- background is not magenta here' : c.coverage < 0.04 ? '  <-- nearly empty cell' : ''
    if (warn) problems++
    console.log(`${c.name.padEnd(11)} cat covers ${(c.coverage * 100).toFixed(0)}% of its cell${warn}`)
  }
  console.log(`\nShrunk/grown by ${res.scale.toFixed(2)}x to fit Kitty's frame. ${problems ? problems + ' warning(s).' : 'No problems.'} Frames are in ${OUT}`)
  app.exit(problems ? 2 : 0)
})
