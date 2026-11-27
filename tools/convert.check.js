// Checks the converter's image paths: every readable format -> every output format, the written file is what it
// claims to be, and Kitty's own BMP/ICO read back. Run from the project folder: node tools/convert.check.js
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')
const cv = require('../convert.js')

;(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitty-convert-check-'))
  try {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" rx="30" fill="#ff8a3d"/><circle cx="110" cy="100" r="60" fill="#4f9dff" fill-opacity=".8"/></svg>')
    const write = async (fmt, s) => { const p = path.join(dir, 'in.' + fmt); await s.toFile(p); return p }
    const inputs = {
      png: await write('png', sharp(svg).png()), jpg: await write('jpg', sharp(svg).flatten({ background: '#fff' }).jpeg()),
      webp: await write('webp', sharp(svg).webp()), avif: await write('avif', sharp(svg).avif()), gif: await write('gif', sharp(svg).gif()),
      tiff: await write('tiff', sharp(svg).tiff()), svg: (fs.writeFileSync(path.join(dir, 'in.svg'), svg), path.join(dir, 'in.svg')),
    }
    // a renamed file is still found out by its bytes
    fs.copyFileSync(inputs.png, path.join(dir, 'really-a-png.jpg'))
    assert.equal(cv.detect(path.join(dir, 'really-a-png.jpg')), 'png')

    let n = 0
    for (const [from, file] of Object.entries(inputs)) {
      assert.equal(cv.detect(file), from, `detects ${from}`)
      for (const to of cv.targets(from).filter((t) => t !== 'pdf')) {
        const out = path.join(dir, `${from}-to.${to}`)
        fs.writeFileSync(out, await cv._image(file, from, to))
        assert.equal(cv.detect(out), to, `${from} -> ${to} writes a real ${to}`)
        n++
      }
    }
    // Kitty's own BMP and ICO open again with the right size
    {
      for (const f of ['png-to.bmp', 'png-to.ico']) {
        const p = path.join(dir, f), m = await sharp(await cv._image(p, cv.detect(p), 'png')).metadata()
        assert.deepEqual([m.width, m.height], f.endsWith('bmp') ? [320, 200] : [256, 256], `${f} reads back`)
        n++
      }
    }
    // BMP and ICO are read by Kitty's own code on every system: hand-made 2x2 images (red, green / blue, white),
    // in each layout apps write, must come out pixel-exact
    const want = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]] // top-left, top-right, bottom-left, bottom-right
    const dib = ({ bpp, comp = 0, masks, topDown, palette, px, ico }) => {
      const stride = Math.ceil((2 * bpp) / 32) * 4, hs = comp === 3 ? 56 : 40
      const pal = palette ? Buffer.concat(palette.map(([r, g, b]) => Buffer.from([b, g, r, 0]))) : Buffer.alloc(0)
      const h = Buffer.alloc(hs); h.writeUInt32LE(hs, 0); h.writeInt32LE(2, 4); h.writeInt32LE((topDown ? -2 : 2) * (ico ? 2 : 1), 8); h.writeUInt16LE(1, 12); h.writeUInt16LE(bpp, 14); h.writeUInt32LE(comp, 16)
      if (palette) h.writeUInt32LE(palette.length, 32)
      if (masks) masks.forEach((m, i) => h.writeUInt32LE(m, 40 + i * 4))
      const rows = [px.slice(0, 2), px.slice(2, 4)] // top row first
      const data = Buffer.concat((topDown ? rows : [...rows].reverse()).map((r) => { const b = Buffer.alloc(stride); r.forEach((v, x) => bpp === 8 ? (b[x] = v) : bpp === 16 ? b.writeUInt16LE(v, x * 2) : bpp === 24 ? (b[x * 3] = v[2], b[x * 3 + 1] = v[1], b[x * 3 + 2] = v[0]) : b.writeUInt32LE(v >>> 0, x * 4)); return b }))
      const and = ico ? Buffer.alloc(8) : Buffer.alloc(0) // all opaque
      if (ico) and[0] = 0b01000000 // ...except the bottom row's right pixel (rows are bottom-up): white -> see-through
      return Buffer.concat([h, pal, data, and])
    }
    const file = (name, body, header = true) => {
      const p = path.join(dir, name)
      if (!header) return fs.writeFileSync(p, body), p
      const fh = Buffer.alloc(14); fh.write('BM', 0, 'latin1'); fh.writeUInt32LE(14 + body.length, 2)
      const hs = body.readUInt32LE(0), colors = body.readUInt16LE(14) <= 8 ? body.readUInt32LE(32) : 0
      fh.writeUInt32LE(14 + hs + colors * 4, 10); fs.writeFileSync(p, Buffer.concat([fh, body])); return p
    }
    const rgb565 = ([r, g, b]) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
    const argb = ([r, g, b, a]) => ((a << 24) | (r << 16) | (g << 8) | b) >>> 0
    const bmps = {
      'pal8.bmp': dib({ bpp: 8, palette: want.map((c) => c.slice(0, 3)), px: [0, 1, 2, 3] }),
      'rgb24.bmp': dib({ bpp: 24, px: want }),
      'rgb24-topdown.bmp': dib({ bpp: 24, px: want, topDown: true }),
      'rgb565.bmp': dib({ bpp: 16, comp: 3, masks: [0xf800, 0x07e0, 0x001f, 0], px: want.map(rgb565) }),
      'argb32.bmp': dib({ bpp: 32, comp: 3, masks: [0xff0000, 0xff00, 0xff, 0xff000000], px: want.map(argb) }),
    }
    for (const [name, body] of Object.entries(bmps)) {
      const p = file(name, body)
      assert.equal(cv.detect(p), 'bmp', `${name} detects as BMP`)
      const { data } = await sharp(await cv._image(p, 'bmp', 'png')).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
      assert.deepEqual([...data], want.flat(), `${name} pixels`); n++
    }
    // an old-style icon: a 24-bit bitmap plus the 1-bit mask that makes one pixel see-through
    const icoBody = dib({ bpp: 24, px: want, ico: true })
    const dir6 = Buffer.alloc(22); dir6.writeUInt16LE(1, 2); dir6.writeUInt16LE(1, 4); dir6[6] = 2; dir6[7] = 2; dir6.writeUInt16LE(1, 10); dir6.writeUInt16LE(24, 12); dir6.writeUInt32LE(icoBody.length, 14); dir6.writeUInt32LE(22, 18)
    const icoP = file('old.ico', Buffer.concat([dir6, icoBody]), false)
    assert.equal(cv.detect(icoP), 'ico')
    const { data: icoPx } = await sharp(await cv._image(icoP, 'ico', 'png')).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    assert.deepEqual([...icoPx], [...want.slice(0, 3).flat(), 255, 255, 255, 0], 'icon pixels with its mask'); n++

    // what formats can become
    assert.deepEqual(cv.targets('pdf'), ['docx'])
    assert.deepEqual(cv.targets('docx'), ['pdf'])
    assert.ok(cv.targets('heic').includes('jpg') && cv.targets('png').includes('pdf') && !cv.targets('png').includes('png'))
    console.log(`convert checks passed (${n} conversions)`)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})().catch((e) => { console.error(e); process.exit(1) })
