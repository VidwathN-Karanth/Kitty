// Rough Claude Code usage in the last 5 hours, summed from the local transcripts in ~/.claude/projects.
// Kitty cannot see your plan's real limit, so the percentage is measured against a budget you choose in Settings.
// Transcripts can be tens of MB, so each file is read once in small chunks, then only the part added since the last
// look; only the token counts of the last 5 hours are kept in memory.
const fs = require('fs')
const os = require('os')
const path = require('path')

const WINDOW = 5 * 3600 * 1000
const CHUNK = 1 << 20

const files = new Map() // path -> { offset, rest (unfinished last line), entries: [{ t, id, n }] }

function readNew(fp, f, size, cutoff) {
  const fd = fs.openSync(fp, 'r')
  try {
    const buf = Buffer.alloc(CHUNK)
    while (f.offset < size) {
      const got = fs.readSync(fd, buf, 0, Math.min(CHUNK, size - f.offset), f.offset)
      if (!got) break
      f.offset += got
      const lines = (f.rest + buf.toString('utf8', 0, got)).split('\n')
      f.rest = lines.pop() // may be cut off mid-line: finished on the next read
      for (const line of lines) {
        if (!line.includes('"usage"')) continue
        try {
          const o = JSON.parse(line)
          const t = Date.parse(o.timestamp), u = o.message?.usage
          if (!(t >= cutoff) || !u) continue
          f.entries.push({ t, id: o.message.id || o.uuid, n: (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) })
        } catch {}
      }
    }
  } finally { fs.closeSync(fd) }
}

function tokensUsed() {
  const root = path.join(os.homedir(), '.claude', 'projects')
  const cutoff = Date.now() - WINDOW
  const live = new Set()
  let dirs = []
  try { dirs = fs.readdirSync(root) } catch { return 0 }
  for (const d of dirs) {
    const dir = path.join(root, d)
    let names = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue
      const fp = path.join(dir, n)
      let st
      try { st = fs.statSync(fp) } catch { continue }
      if (st.mtimeMs < cutoff) continue
      live.add(fp)
      let f = files.get(fp)
      if (!f || st.size < f.offset) { f = { offset: 0, rest: '', entries: [] }; files.set(fp, f) } // new, or rewritten
      try { readNew(fp, f, st.size, cutoff) } catch {}
    }
  }
  for (const fp of files.keys()) if (!live.has(fp)) files.delete(fp) // nothing from it in the last 5 hours
  const seen = new Set()
  let sum = 0
  for (const f of files.values()) {
    f.entries = f.entries.filter((e) => e.t >= cutoff)
    for (const e of f.entries) {
      if (e.id && seen.has(e.id)) continue // streamed messages repeat in the file
      if (e.id) seen.add(e.id)
      sum += e.n
    }
  }
  return sum
}

let used = 0
function start(onChange) {
  const tick = () => { try { const u = tokensUsed(); if (u !== used) { used = u; onChange(used) } } catch (e) { console.log('[usage]', e.message) } }
  tick()
  setInterval(tick, 90 * 1000)
}

module.exports = { start, get: () => used, tokensUsed }
