// Rough Claude Code usage in the last 5 hours, summed from the local transcripts in ~/.claude/projects.
// Kitty cannot see your plan's real limit, so the percentage is measured against a budget you choose in Settings.
const fs = require('fs')
const os = require('os')
const path = require('path')

const WINDOW = 5 * 3600 * 1000

function tokensUsed() {
  const root = path.join(os.homedir(), '.claude', 'projects')
  const cutoff = Date.now() - WINDOW
  const seen = new Set()
  let sum = 0
  let dirs = []
  try { dirs = fs.readdirSync(root) } catch { return 0 }
  for (const d of dirs) {
    const dir = path.join(root, d)
    let files = []
    try { files = fs.readdirSync(dir) } catch { continue }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue
      const fp = path.join(dir, f)
      try { if (fs.statSync(fp).mtimeMs < cutoff) continue } catch { continue }
      let text = ''
      try { text = fs.readFileSync(fp, 'utf8') } catch { continue }
      for (const line of text.split('\n')) {
        if (!line.includes('"usage"')) continue
        try {
          const o = JSON.parse(line)
          if (!(Date.parse(o.timestamp) >= cutoff)) continue
          const u = o.message?.usage
          if (!u) continue
          const id = o.message.id || o.uuid
          if (id && seen.has(id)) continue // streamed messages repeat in the file
          if (id) seen.add(id)
          sum += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0)
        } catch {}
      }
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

module.exports = { start, get: () => used }
