// Send to phone through KDE Connect (its own command-line tool, the same thing as its "Send file"): the phone has to
// be paired and reachable in KDE Connect. Works with the Microsoft Store and installer versions on Windows and with
// the kdeconnect package on Linux. Nothing here when KDE Connect isn't installed.
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const LINUX = process.platform === 'linux'
function cli() {
  const c = LINUX ? ['/usr/bin/kdeconnect-cli', '/usr/local/bin/kdeconnect-cli', '/snap/bin/kdeconnect-cli']
    : [path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'kdeconnect-cli.exe'), // Store version (app alias)
      ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map((d) => path.join(d, 'KDE Connect', 'bin', 'kdeconnect-cli.exe'))]
  // lstat: the Store version's command is an app alias (a special link that existsSync doesn't see)
  return c.find((p) => { try { fs.lstatSync(p); return true } catch { return false } }) ?? null
}
const run = (args, timeout = 20000) => new Promise((ok, fail) => {
  const exe = cli()
  if (!exe) return fail(new Error('KDE Connect is not installed'))
  execFile(exe, args, { timeout, windowsHide: true }, (err, out, errOut) => (err ? fail(new Error(String(errOut || err.message).trim().split('\n')[0])) : ok(String(out))))
})

// paired phones that can be reached now: [{ id, name }]; null when KDE Connect isn't installed
async function devices() {
  if (!cli()) return null
  try {
    return (await run(['-a', '--id-name-only'])).split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => ({ id: l.slice(0, l.indexOf(' ')), name: l.slice(l.indexOf(' ') + 1) })).filter((d) => /^[\w-]+$/.test(d.id))
  } catch { return [] }
}

// { ok, device, sent } or { error }
async function send(paths) {
  const files = [].concat(paths).filter((p) => typeof p === 'string' && fs.existsSync(p) && fs.statSync(p).isFile())
  if (!files.length) return { error: 'Nothing to send' }
  const list = await devices()
  if (list === null) return { error: 'KDE Connect is not installed' }
  if (!list.length) return { error: 'No phone reachable (open KDE Connect on it)' }
  const d = list[0]
  try {
    for (const f of files) await run(['-d', d.id, '--share', f], 120000)
    return { ok: true, device: d.name, sent: files.length }
  } catch (e) { return { error: e.message || 'Couldn\'t send' } }
}

module.exports = { devices, send }
