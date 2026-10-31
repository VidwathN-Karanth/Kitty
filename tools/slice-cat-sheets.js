// Turns the Gemini sprite sheets (see docs/CAT_ART_PROMPT.md) into the transparent frames Kitty uses.
//
//   npx electron tools/slice-cat-sheets.js art/v3
//
// The folder holds sheet1-4 (faces) and sheet7-8 (dressed). PNG, JPG or WebP; the name only has to start with "sheetN". For every sheet:
//   1. the little Gemini sparkle watermark in the bottom-right corner is painted out,
//   2. the magenta background is keyed out (with edge clean-up), and grid lines / text labels are dropped,
//   3. faces: every frame is scaled and moved so its ear tips land on the same spot as the "normal" face,
//      so the cat doesn't jump when the face changes; sheets without the white sticker edge get one,
//   4. dressed Kitty (wearing each outfit) is lined up by its eyes, with extra room above for tall hats,
//   5. the eye whites of "eyes-blank" are measured, so the app can draw pupils that follow the mouse.
// Faces go to src/assets/cat/, Kitty dressed in each outfit to src/assets/wardrobe/ (with tops.json: how high each
// outfit reaches), eye positions to src/assets/cat/eyes.json.
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')

// cols x rows, names left to right, top to bottom ('' = leave out). bottom: ignore everything below this
// part of the cell (labels). edge: add the white sticker edge. dressed: Kitty wearing clothes (blank eyes).
// file: which sheet number in the folder (default: its place in this list).
const SHEETS = [
  { cols: 3, rows: 3, bottom: 0.83, names: ['normal', 'blink', 'half-blink', 'look-left', 'look-right', 'look-down', 'look-down-left', 'look-down-right', 'eyes-blank'] },
  { cols: 3, rows: 3, names: ['happy', 'love', 'surprised', 'curious', 'focused', 'wink', 'sad', 'dizzy', 'sleepy'] },
  { cols: 3, rows: 3, edge: true, names: ['asleep', 'listening', 'angry', 'excited', 'crying', 'laugh', 'shy', 'smug', 'scared'] },
  { cols: 3, rows: 3, edge: true, names: ['bored', 'yawn', 'wave', 'purr', 'hungry', 'thinking', 'confused', 'proud', 'celebrate'] },
  { file: 7, cols: 3, rows: 3, dressed: true, names: ['bow', 'glasses', 'party', 'bowtie', 'beanie', 'collar', 'sunglasses', 'scarf', 'flowers'] },
  { file: 8, cols: 3, rows: 3, dressed: true, names: ['headphones', 'chef', 'crown', 'heartglasses', 'bandana', 'tophat', 'cowboy', 'wizard', 'halo'] },
]
const ROOT = path.join(__dirname, '..', 'src', 'assets')

const PAGE = `(async (sheets, cfg) => {
  const S = 512
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('could not read an image')); i.src = src })
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

  // keeps only the solid shapes; drops what touches the cell edge and is long and thin (grid lines)
  function clean(p, w, h) {
    const seen = new Uint8Array(w * h)
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || p[s * 4 + 3] < 128) continue
      const stack = [s], blob = []; seen[s] = 1
      let x0 = w, x1 = 0, y0 = h, y1 = 0, edge = false
      while (stack.length) {
        const k = stack.pop(); blob.push(k)
        const x = k % w, y = (k / w) | 0
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        if (x < w * 0.03 || y < h * 0.03 || x > w * 0.97 || y > h * 0.97) edge = true
        for (const n of [k - 1, k + 1, k - w, k + w]) if (n >= 0 && n < w * h && !seen[n] && p[n * 4 + 3] >= 128 && Math.abs((n % w) - x) <= 1) { seen[n] = 1; stack.push(n) }
      }
      const thin = blob.length < (x1 - x0 + 1) * (y1 - y0 + 1) * 0.15
      const line = edge && ((thin && (x1 - x0 > w * 0.8 || y1 - y0 > h * 0.8)) || blob.length < w * h * 0.01) // grid lines, or a sliver of the next cell
      if (line || blob.length < 30) for (const k of blob) p[k * 4 + 3] = 0
    }
  }

  // dressed cells are one sticker (cat and outfit share the white edge): small bits of the next cell are dropped
  function keepMain(p, w, h) {
    const id = new Int32Array(w * h).fill(-1), size = [], edges = []
    for (let s = 0; s < w * h; s++) {
      if (id[s] >= 0 || p[s * 4 + 3] < 128) continue
      const c = size.length, st = [s]; id[s] = c; let n = 0, edge = false
      while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; n++
        if (x < w * 0.04 || y < h * 0.04 || x > w * 0.96 || y > h * 0.96) edge = true
        for (const m of [k - 1, k + 1, k - w, k + w]) if (m >= 0 && m < w * h && id[m] < 0 && p[m * 4 + 3] >= 128 && Math.abs((m % w) - x) <= 1) { id[m] = c; st.push(m) } }
      size.push(n); edges.push(edge)
    }
    const main = size.indexOf(Math.max(...size))
    // small loose bits go, and bigger ones too if they touch the cell edge (part of the next cell); a halo floating
    // above the head stays
    const keep = (c) => c === main || size[c] >= size[main] * (edges[c] ? 0.15 : 0.05)
    for (let k = 0; k < w * h; k++) if (id[k] >= 0 && !keep(id[k])) { p[k * 4 + 3] = 0; id[k] = -1 }
    // faint see-through pixels count only next to something that stays (soft edges, a halo's glow); faint smudges
    // on their own (the edge of the next cell) go
    const near = new Uint8Array(w * h), R = 4
    for (let k = 0; k < w * h; k++) if (id[k] >= 0) { const x = k % w, y = (k / w) | 0
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1 } }
    for (let k = 0; k < w * h; k++) if (id[k] < 0 && !near[k]) p[k * 4 + 3] = 0
  }
  const faces = {}, items = {}
  for (let s = 0; s < cfg.length; s++) {
    const { cols, rows, names, bottom = 1, edge, dressed } = cfg[s]
    const img = await load(sheets[s])
    const W = img.width, H = img.height
    const sh = canvas(W, H), sg = sh.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0)
    // watermark: the pinkish-purple sparkle in the corner (orange fur and white edges are left alone)
    const wm = sg.getImageData(W * 0.88, H * 0.88, W * 0.12, H * 0.12), q = wm.data
    for (let o = 0; o < q.length; o += 4) if (q[o + 2] > q[o + 1] + 25 && !(q[o] > 235 && q[o + 1] > 235)) { q[o] = 255; q[o + 1] = 0; q[o + 2] = 255 }
    sg.putImageData(wm, W * 0.88, H * 0.88)
    const cw = W / cols, ch = H / rows
    names.forEach((name, i) => {
      if (!name) return
      const x0 = Math.round((i % cols) * cw), y0 = Math.round(Math.floor(i / cols) * ch), w = Math.round(cw), h = Math.round(ch * bottom)
      const cv = canvas(w, h), g = cv.getContext('2d', { willReadFrequently: true })
      g.drawImage(sh, x0, y0, w, h, 0, 0, w, h)
      const d = g.getImageData(0, 0, w, h), p = d.data
      for (let o = 0; o < p.length; o += 4) {
        const m = Math.min(p[o], p[o + 2]) - p[o + 1]            // how magenta this pixel is
        let a = 1
        if (m > 150) a = 0; else if (m > 45) a = 1 - (m - 45) / 105
        if (a < 1 && m > 0) { p[o] = Math.max(0, p[o] - m * 0.85); p[o + 2] = Math.max(0, p[o + 2] - m * 0.85) } // no pink fringe
        p[o + 3] = Math.round(a * 255)
      }
      clean(p, w, h)                                              // slivers of the next cell first, while they still touch the edge
      const m = Math.round(w * 0.02)                              // then a thin border band: grid lines live there
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < m || y < m || x >= w - m || y >= h - m) p[(y * w + x) * 4 + 3] = 0
      clean(p, w, h)
      g.putImageData(d, 0, 0)
      if (dressed) { keepMain(p, w, h); g.putImageData(d, 0, 0); items[name] = { cv, sheet: s }; return }
      // ear tips: the top fur pixel on each side of the head (fur = orange)
      // only the biggest patch of fur counts (orange confetti or stars floating around are not the head)
      const isFur = new Uint8Array(w * h)
      for (let o = 0, k = 0; o < p.length; o += 4, k++) if (p[o + 3] > 200 && p[o] > 190 && p[o + 1] > 90 && p[o + 1] < 200 && p[o + 2] < 150 && p[o] - p[o + 1] > 35) isFur[k] = 1
      let fur = []
      for (let s0 = 0; s0 < w * h; s0++) {
        if (isFur[s0] !== 1) continue
        const st = [s0], blob = []; isFur[s0] = 2
        while (st.length) { const k = st.pop(); blob.push(k); const x = k % w
          for (const n of [k - 1, k + 1, k - w, k + w, k - w - 1, k - w + 1, k + w - 1, k + w + 1]) if (n >= 0 && n < w * h && isFur[n] === 1 && Math.abs((n % w) - x) <= 1) { isFur[n] = 2; st.push(n) } }
        if (blob.length > fur.length) fur = blob
      }
      let lo = w, hi = 0; for (const k of fur) { const x = k % w; if (x < lo) lo = x; if (x > hi) hi = x }
      const mid = (lo + hi) / 2
      const tip = (side) => { let best = null; for (const k of fur) { const x = k % w, y = (k / w) | 0; if ((side < 0 ? x < mid - w * 0.05 : x > mid + w * 0.05) && (!best || y < best[1])) best = [x, y] } return best || [mid, 0] }
      // head width: how wide the fur is, row by row, from the top of the head down (a raised paw or the
      // shoulders lower down are skipped by taking a high percentile of the upper rows, not the widest row)
      let top = h; const rl = new Array(h).fill(w), rr = new Array(h).fill(-1)
      for (const k of fur) { const x = k % w, y = (k / w) | 0; if (y < top) top = y; if (x < rl[y]) rl[y] = x; if (x > rr[y]) rr[y] = x }
      const band = []; for (let y = top; y < Math.min(h, top + (hi - lo) * 0.8); y++) if (rr[y] >= 0) band.push([rr[y] - rl[y], (rl[y] + rr[y]) / 2])
      band.sort((a, b) => a[0] - b[0])
      const at = band[Math.floor(band.length * 0.9)] || [hi - lo, mid]
      faces[name] = { cv, l: tip(-1), r: tip(1), edge, n: fur.length, sheet: s, hw: at[0], hx: at[1], top }
    })
  }

  // Every face gets the same head size. Each sheet draws the cat a little differently (round heads with small
  // ears, half a body...), so the size comes from the head WIDTH, one size per sheet (Gemini draws the cells of
  // one sheet alike). "normal" sets the size: its ear tips 50% of the frame apart, at 20% from the top.
  const out = {}, dbg = {}
  const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] }
  const all = Object.values(faces), sheetOf = (f) => all.filter((g) => g.sheet === f.sheet)
  const n0 = faces.normal, HW = median(sheetOf(n0).map((g) => g.hw)) * (0.5 * S) / (Math.hypot(n0.r[0] - n0.l[0], n0.r[1] - n0.l[1]) || 1)
  const TOP = 0.2 * S - (Math.min(n0.l[1], n0.r[1]) - n0.top) * HW / median(sheetOf(n0).map((g) => g.hw)) // where the top of the head goes
  for (const f of all) {
    const same = sheetOf(f), mw = median(same.map((g) => g.hw)), mt = median(same.map((g) => g.top)), mx = median(same.map((g) => g.hx))
    f.k = HW / mw
    // a thought bubble, headphones or a tinted forehead can fool the measuring: then use the sheet's usual spot
    f.guess = Math.abs(f.top - mt) > 0.1 * f.cv.height || Math.abs(f.hx - mx) > 0.08 * f.cv.width
    f.mx = f.guess ? mx : f.hx; f.my = f.guess ? mt : f.top
  }
  for (const [name, f] of Object.entries(faces)) {
    const { k, mx, my } = f
    const o = canvas(S, S), g = o.getContext('2d'); g.imageSmoothingQuality = 'high'
    const dx = S / 2 - mx * k, dy = TOP - my * k
    if (f.edge) {   // white sticker edge, like the other sheets: a white silhouette drawn around it
      const sil = canvas(S, S), sg = sil.getContext('2d'); sg.drawImage(f.cv, dx, dy, f.cv.width * k, f.cv.height * k)
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, S, S)
      for (let a = 0; a < 24; a++) g.drawImage(sil, Math.cos(a / 24 * 2 * Math.PI) * 6, Math.sin(a / 24 * 2 * Math.PI) * 6)
    }
    g.drawImage(f.cv, dx, dy, f.cv.width * k, f.cv.height * k)
    out[name] = o
    dbg[name] = [f.sheet, f.hw, f.top, +k.toFixed(2), f.guess ? 'sheet median' : '']
  }

  // eye whites: the two big, round, pure-white blobs of about the same size, side by side
  function findEyes(cv) {
    const W = cv.width, H = cv.height, p = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
    const white = (k) => p[k * 4 + 3] > 250 && p[k * 4] > 235 && p[k * 4 + 1] > 235 && p[k * 4 + 2] > 235
    const seen = new Uint8Array(W * H), blobs = []
    for (let s = 0; s < W * H; s++) {
      if (seen[s] || !white(s)) continue
      const st = [s]; seen[s] = 1; let n = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0
      while (st.length) { const k = st.pop(), x = k % W, y = (k / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        for (const m of [k - 1, k + 1, k - W, k + W]) if (m >= 0 && m < W * H && !seen[m] && white(m) && Math.abs((m % W) - x) <= 1) { seen[m] = 1; st.push(m) } }
      const bw = x1 - x0, bh = y1 - y0
      if (bw > W * 0.04 && bw < W * 0.3 && bh < W * 0.3 && Math.abs(bw - bh) < Math.max(bw, bh) * 0.35 && n > bw * bh * 0.6) blobs.push({ x: sx / n, y: sy / n, r: (bw + bh) / 4 })
    }
    let best = null, cost = Infinity    // the pair that looks most like two eyes (same height, same size, near the middle)
    for (const a of blobs) for (const b of blobs) if (a.x < b.x) {
      const c = Math.abs(a.y - b.y) + Math.abs(a.r - b.r) * 2 + Math.abs((a.x + b.x) / 2 - W / 2) * 0.5
      if (c < cost && b.x - a.x > a.r * 2.5) { cost = c; best = [a, b] }
    }
    return best
  }
  const blank = out['eyes-blank'] && findEyes(out['eyes-blank'])
  const eyes = blank && blank.map((b) => ({ x: +(b.x / S).toFixed(4), y: +(b.y / S).toFixed(4), r: +(b.r / S).toFixed(4) }))

  // dressed Kitty: lined up by the eyes (hats hide the top of the head) so its eyes land exactly on the
  // blank-eyes frame's, where the app draws the pupils. The frame has room around it (half a frame above, a
  // quarter on each side) for tall hats and wide brims.
  // Sunglasses hide the eyes: those frames use their sheet's usual size and spot.
  const wear = {}, tops = {}
  if (eyes) {
    const ex = (eyes[0].x + eyes[1].x) / 2 * S, ey = (eyes[0].y + eyes[1].y) / 2 * S, ed = (eyes[1].x - eyes[0].x) * S
    const fit = {}
    for (const [name, it] of Object.entries(items)) { const e = findEyes(it.cv); if (e) fit[name] = { k: ed / (e[1].x - e[0].x), mx: (e[0].x + e[1].x) / 2, my: (e[0].y + e[1].y) / 2 } }
    for (const [name, it] of Object.entries(items)) {
      let f = fit[name]
      if (!f) { const same = Object.keys(items).filter((n) => items[n].sheet === it.sheet && fit[n]).map((n) => fit[n]); f = { k: median(same.map((g) => g.k)), mx: median(same.map((g) => g.mx)), my: median(same.map((g) => g.my)) } }
      const o = canvas(S * 1.5, S * 1.5), g = o.getContext('2d'); g.imageSmoothingQuality = 'high'
      g.drawImage(it.cv, S / 4 + ex - f.mx * f.k, S / 2 + ey - f.my * f.k, it.cv.width * f.k, it.cv.height * f.k)
      wear[name] = o.toDataURL('image/png').split(',')[1]
      // how high the outfit reaches (top of the drawing, in frames from the top of this taller frame), so the
      // small cat in the notch can shrink just enough for a hat to fit
      const a = g.getImageData(0, 0, o.width, o.height).data
      let t = 0; while (t < o.height && !a.slice(t * o.width * 4, (t + 1) * o.width * 4).some((v, i) => i % 4 === 3 && v > 60)) t++
      tops[name] = +(t / S).toFixed(3)
      dbg['wear-' + name] = [+f.k.toFixed(2), fit[name] ? 'eyes' : 'sheet median']
    }
  }
  const png = {}; for (const [n, c] of Object.entries(out)) png[n] = c.toDataURL('image/png').split(',')[1]
  return { png, wear, eyes, dbg, tops }
})`

app.setPath('userData', path.join(os.tmpdir(), 'kitty-slicer'))
app.whenReady().then(async () => {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('-'))
  const files = dir && fs.existsSync(dir) ? SHEETS.map((c, i) => fs.readdirSync(dir).find((f) => f.toLowerCase().startsWith('sheet' + (c.file ?? i + 1)))) : []
  if (files.length !== SHEETS.length || files.some((f) => !f)) { console.log('Usage: npx electron tools/slice-cat-sheets.js <folder with sheet1-4, sheet7, sheet8>'); return app.exit(1) }
  const mime = (f) => ({ jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', png: 'png' }[path.extname(f).slice(1).toLowerCase()] || 'png')
  const sheets = files.map((f) => `data:image/${mime(f)};base64,` + fs.readFileSync(path.join(dir, f)).toString('base64'))
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  let res
  try { res = await win.webContents.executeJavaScript(`${PAGE}(${JSON.stringify(sheets)}, ${JSON.stringify(SHEETS)})`) }
  catch (e) { console.log(e.message); return app.exit(1) }
  const cat = path.join(ROOT, 'cat'), wear = path.join(ROOT, 'wardrobe')
  for (const d of [cat, wear]) { fs.mkdirSync(d, { recursive: true }); for (const f of fs.readdirSync(d)) fs.unlinkSync(path.join(d, f)) } // start clean
  for (const [n, b] of Object.entries(res.png)) fs.writeFileSync(path.join(cat, n + '.png'), Buffer.from(b, 'base64'))
  for (const [n, b] of Object.entries(res.wear)) fs.writeFileSync(path.join(wear, n + '.png'), Buffer.from(b, 'base64'))
  if (res.eyes) fs.writeFileSync(path.join(cat, 'eyes.json'), JSON.stringify(res.eyes))
  fs.writeFileSync(path.join(wear, 'tops.json'), JSON.stringify(res.tops))
  if (process.env.SLICE_DEBUG) for (const [n, d] of Object.entries(res.dbg)) console.log(n.padEnd(16), JSON.stringify(d))
  console.log(`${Object.keys(res.png).length} faces, ${Object.keys(res.wear).length} dressed, eyes: ${res.eyes ? JSON.stringify(res.eyes) : 'NOT FOUND'}`)
  app.exit(res.eyes ? 0 : 2)
})
