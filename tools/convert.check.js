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
    // Kitty's own BMP and ICO open again (through Windows' decoder) with the right size
    if (process.platform === 'win32') {
      for (const f of ['png-to.bmp', 'png-to.ico']) {
        const p = path.join(dir, f), m = await sharp(await cv._image(p, cv.detect(p), 'png')).metadata()
        assert.deepEqual([m.width, m.height], f.endsWith('bmp') ? [320, 200] : [256, 256], `${f} reads back`)
        n++
      }
    }
    // what formats can become
    assert.deepEqual(cv.targets('pdf'), ['docx'])
    assert.deepEqual(cv.targets('docx'), ['pdf'])
    assert.ok(cv.targets('heic').includes('jpg') && cv.targets('png').includes('pdf') && !cv.targets('png').includes('png'))
    console.log(`convert checks passed (${n} conversions)`)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})().catch((e) => { console.error(e); process.exit(1) })
