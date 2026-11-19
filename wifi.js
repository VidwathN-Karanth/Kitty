// Wi-Fi networks for the Control Center: list what is around, and join one (with a password when it is new).
// Windows: netsh. Linux: nmcli (NetworkManager). Arguments go straight to the tool, never through a shell.
const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const LINUX = process.platform === 'linux'
const run = (cmd, args, timeout = 15000) => new Promise((ok) =>
  execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 1 << 20 }, (err, out, errOut) => ok({ err, out: String(out || ''), errOut: String(errOut || '') })))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function current() {
  if (LINUX) {
    const { out } = await run('nmcli', ['-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi'])
    const l = out.split('\n').find((x) => x.startsWith('yes:'))
    return l ? l.slice(4).replace(/\\:/g, ':') : null
  }
  const { out } = await run('netsh', ['wlan', 'show', 'interfaces'])
  return /^\s*SSID\s*:\s*(.+?)\s*$/m.exec(out)?.[1] ?? null
}

// [{ ssid, signal (0-100), secure }], strongest first, one row per name
async function list() {
  const nets = new Map()
  const add = (n) => { if (n.ssid && (!nets.has(n.ssid) || nets.get(n.ssid).signal < n.signal)) nets.set(n.ssid, n) }
  if (LINUX) {
    const { err, out } = await run('nmcli', ['-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list'])
    if (err) return { current: null, nets: [], error: 'NetworkManager (nmcli) is needed to list networks.' }
    for (const l of out.split('\n')) {
      const [ssid, signal, sec] = l.split(/(?<!\\):/).map((x) => (x || '').replace(/\\:/g, ':'))
      add({ ssid, signal: +signal || 0, secure: !!sec && sec !== '--' })
    }
  } else {
    const { out } = await run('netsh', ['wlan', 'show', 'networks', 'mode=bssid'])
    // Windows 11 asks for Location access before it lists networks
    if (/location/i.test(out) && !/SSID \d+ :/.test(out)) return { current: await current(), nets: [], error: 'Windows needs Location turned on to list Wi-Fi networks.', fix: 'ms-settings:privacy-location' }
    // ponytail: parses netsh's English-ish layout (SSID lines and "NN%" stay the same in every language; "Open" may not)
    for (const block of out.split(/^SSID \d+ : /m).slice(1)) {
      const ssid = block.split(/\r?\n/)[0].trim()
      const signal = Math.max(0, ...[...block.matchAll(/:\s*(\d+)%/g)].map((m) => +m[1]))
      const auth = /^\s*Authentication\s*:\s*(.+)$/m.exec(block)?.[1] ?? ''
      add({ ssid, signal, secure: !/^open/i.test(auth.trim()) })
    }
  }
  return { current: await current(), nets: [...nets.values()].sort((a, b) => b.signal - a.signal) }
}

const xml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
// ponytail: WPA2-Personal profile (also joins WPA2/WPA3 mixed networks); WPA3-only and enterprise networks need Windows' own UI
const profile = (ssid, pw) => `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>${xml(ssid)}</name>
<SSIDConfig><SSID><name>${xml(ssid)}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode>
<MSM><security><authEncryption><authentication>${pw ? 'WPA2PSK' : 'open'}</authentication><encryption>${pw ? 'AES' : 'none'}</encryption><useOneX>false</useOneX></authEncryption>
${pw ? `<sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${xml(pw)}</keyMaterial></sharedKey>` : ''}</security></MSM></WLANProfile>`

async function addProfile(ssid, pw) {
  const file = path.join(os.tmpdir(), `kitty-wifi-${process.pid}-${Date.now()}.xml`)
  try {
    fs.writeFileSync(file, profile(ssid, pw), { mode: 0o600 })
    return !(await run('netsh', ['wlan', 'add', 'profile', `filename=${file}`, 'user=current'])).err
  } finally { fs.rmSync(file, { force: true }) } // the password never stays on disk outside Windows' own store
}

// { ok } | { needPassword } | { error }
async function join(ssid, password, secure) {
  if (typeof ssid !== 'string' || !ssid) return { error: 'No network' }
  if (password != null && (typeof password !== 'string' || password.length < 8 || password.length > 63)) return { error: 'Wi-Fi passwords are 8 to 63 characters.' }
  if (LINUX) {
    const { err, out, errOut } = await run('nmcli', ['dev', 'wifi', 'connect', ssid, ...(password ? ['password', password] : [])], 45000)
    if (!err) return { ok: true }
    const msg = out + errOut
    if (!password && secure && /secret|password|802-11-wireless-security/i.test(msg)) return { needPassword: true }
    return { error: /secret|password/i.test(msg) ? 'Wrong password?' : msg.trim().split('\n').pop().slice(0, 120) || 'Could not connect.' }
  }
  let added = false
  if (password) added = await addProfile(ssid, password)
  let r = await run('netsh', ['wlan', 'connect', `name=${ssid}`, `ssid=${ssid}`])
  if (r.err && !password) {
    if (secure) return { needPassword: true } // never joined before: ask for the password
    added = await addProfile(ssid, null)
    r = await run('netsh', ['wlan', 'connect', `name=${ssid}`, `ssid=${ssid}`])
  }
  if (r.err) return { error: 'Could not connect.' }
  // netsh only starts the connection: wait to see it actually come up (a wrong password just never does)
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    if ((await current()) === ssid) return { ok: true }
  }
  if (added && password) await run('netsh', ['wlan', 'delete', 'profile', `name=${ssid}`]) // so the next try asks again
  return { error: password ? 'Could not connect. Wrong password?' : 'Could not connect.' }
}

module.exports = { list, join }
