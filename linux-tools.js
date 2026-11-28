// Linux: which of the desktop tools Kitty uses are installed, and installing the missing ones in a terminal (the user
// types their password there; Kitty never sees it). Each tool: what it powers, the command that shows it's there,
// and its package on apt (Debian/Ubuntu), dnf (Fedora), pacman (Arch) and zypper (openSUSE).
const fs = require('fs')
const path = require('path')
const { spawn, execFile } = require('child_process')

const TOOLS = [
  { id: 'playerctl', what: 'Music: what is playing, play/pause/next', bins: ['playerctl'], pkg: { apt: 'playerctl', dnf: 'playerctl', pacman: 'playerctl', zypper: 'playerctl' } },
  { id: 'audio', what: 'Volume slider and mute', bins: ['wpctl', 'pactl'], pkg: { apt: 'pipewire-bin', dnf: 'wireplumber', pacman: 'wireplumber', zypper: 'wireplumber' } },
  { id: 'nmcli', what: 'Wi-Fi: list networks and join them', bins: ['nmcli'], pkg: { apt: 'network-manager', dnf: 'NetworkManager', pacman: 'networkmanager', zypper: 'NetworkManager' } },
  { id: 'rfkill', what: 'Wi-Fi and Bluetooth switches, airplane mode', bins: ['rfkill'], pkg: { apt: 'rfkill', dnf: 'util-linux', pacman: 'util-linux', zypper: 'util-linux' } },
  { id: 'upower', what: 'Battery levels of Bluetooth devices', bins: ['upower'], pkg: { apt: 'upower', dnf: 'upower', pacman: 'upower', zypper: 'upower' } },
  { id: 'brightnessctl', what: 'Brightness slider', bins: ['brightnessctl'], pkg: { apt: 'brightnessctl', dnf: 'brightnessctl', pacman: 'brightnessctl', zypper: 'brightnessctl' } },
  { id: 'powerprofilesctl', what: 'Power mode (battery / balanced / performance)', bins: ['powerprofilesctl'], pkg: { apt: 'power-profiles-daemon', dnf: 'power-profiles-daemon', pacman: 'power-profiles-daemon', zypper: 'power-profiles-daemon' } },
  { id: 'kdeconnect', what: 'Send to phone (pair the phone in KDE Connect)', bins: ['kdeconnect-cli'], pkg: { apt: 'kdeconnect', dnf: 'kde-connect', pacman: 'kdeconnect', zypper: 'kdeconnect-kde' } },
  { id: 'libreoffice', what: 'Convert: Word to PDF and PDF to Word', bins: ['soffice', 'libreoffice'], pkg: { apt: 'libreoffice-writer', dnf: 'libreoffice-writer', pacman: 'libreoffice-fresh', zypper: 'libreoffice-writer' } },
  { id: 'heif', what: 'Convert: HEIC photos from phones', bins: ['heif-convert', 'heif-dec'], pkg: { apt: 'libheif-examples', dnf: 'libheif-tools', pacman: 'libheif', zypper: 'libheif-tools' } },
  { id: 'ffmpeg', what: 'Download: HD video with sound, MP3 (else Kitty fetches its own)', bins: ['ffmpeg'], pkg: { apt: 'ffmpeg', dnf: 'ffmpeg-free', pacman: 'ffmpeg', zypper: 'ffmpeg-7' } },
  { id: 'curl', what: 'Claude Code tracking (its hooks call Kitty with curl)', bins: ['curl'], pkg: { apt: 'curl', dnf: 'curl', pacman: 'curl', zypper: 'curl' } },
  // GNOME hides tray icons without this extension; Ubuntu has it, Fedora and others don't
  { id: 'appindicator', what: 'Kitty\'s tray icon on GNOME (log out and in after installing)', gnome: true, pkg: { apt: 'gnome-shell-extension-appindicator', dnf: 'gnome-shell-extension-appindicator', pacman: 'gnome-shell-extension-appindicator', zypper: 'gnome-shell-extension-appindicator' } },
]

const DIRS = [...(process.env.PATH || '').split(':'), '/usr/bin', '/usr/sbin', '/bin', '/sbin', '/usr/local/bin', '/snap/bin']
const which = (bin) => DIRS.map((d) => path.join(d, bin)).find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true } catch { return false } }) ?? null
const gnome = () => /gnome/i.test(process.env.XDG_CURRENT_DESKTOP || '')
const pm = () => ['apt', 'dnf', 'pacman', 'zypper'].find((m) => which(m === 'apt' ? 'apt-get' : m)) ?? null
const extEnabled = () => new Promise((ok) => {
  if (!which('gnome-extensions')) return ok(false)
  execFile('gnome-extensions', ['list', '--enabled'], { timeout: 5000 }, (e, out) => ok(!e && /appindicator/i.test(String(out))))
})

// { manager, desktop, tools: [{ id, what, ok, pkg }] }
async function status() {
  const m = pm()
  const tools = []
  for (const t of TOOLS) {
    if (t.gnome && !gnome()) continue
    const ok = t.id === 'appindicator' ? await extEnabled() : t.bins.some((b) => which(b))
    tools.push({ id: t.id, what: t.what, ok, pkg: m ? t.pkg[m] : null })
  }
  return { manager: m, desktop: process.env.XDG_CURRENT_DESKTOP || '', session: process.env.XDG_SESSION_TYPE || '', tools }
}

// the shell line that installs them (and switches the GNOME extension on)
function command(ids) {
  const m = pm()
  if (!m) return null
  const want = TOOLS.filter((t) => ids.includes(t.id) && t.pkg[m])
  const pkgs = [...new Set(want.map((t) => t.pkg[m]))]
  if (!pkgs.length) return null
  const install = { apt: `sudo apt-get update && sudo apt-get install -y ${pkgs.join(' ')}`, dnf: `sudo dnf install -y ${pkgs.join(' ')}`,
    pacman: `sudo pacman -S --needed --noconfirm ${pkgs.join(' ')}`, zypper: `sudo zypper install -y ${pkgs.join(' ')}` }[m]
  const ext = want.some((t) => t.id === 'appindicator')
    ? ' && (gnome-extensions enable ubuntu-appindicators@ubuntu.com 2>/dev/null || gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com 2>/dev/null || true)' : ''
  return install + ext
}

// a terminal the desktop has, and how it wants the command to run
const TERMS = [
  ['ptyxis', (c) => ['--', ...c]], ['kgx', (c) => ['--', ...c]], ['gnome-terminal', (c) => ['--', ...c]], ['konsole', (c) => ['-e', ...c]],
  ['xfce4-terminal', (c) => ['-x', ...c]], ['mate-terminal', (c) => ['-x', ...c]], ['tilix', (c) => ['-e', c.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')]],
  ['x-terminal-emulator', (c) => ['-e', ...c]], ['kitty', (c) => c], ['alacritty', (c) => ['-e', ...c]], ['foot', (c) => c], ['wezterm', (c) => ['start', '--', ...c]],
  ['lxterminal', (c) => ['-e', ...c]], ['terminator', (c) => ['-x', ...c]], ['xterm', (c) => ['-e', ...c]],
]
// opens a terminal that shows what will be installed, runs it (asking for the password there) and waits for Enter.
// A terminal that fails to start (or quits with an error at once) is skipped for the next one; some hand the window
// to a server and quit at once with 0, which counts as opened.
const tryTerminal = (exe, args) => new Promise((ok) => {
  let done = false
  const finish = (v) => { if (!done) { done = true; ok(v) } }
  let p
  try { p = spawn(exe, args, { detached: true, stdio: 'ignore' }) } catch { return finish(false) }
  p.on('error', () => finish(false))
  p.on('exit', (code) => finish(code === 0))
  setTimeout(() => { p.unref(); finish(true) }, 1500) // still running: the window is up
})
async function install(ids) {
  const cmd = command(ids)
  if (!cmd) return { error: 'No package manager Kitty knows (apt, dnf, pacman, zypper)' }
  const script = `echo; echo "  Kitty is installing the tools it needs:"; echo "  ${cmd.replace(/"/g, '\\"')}"; echo; ${cmd}; echo; echo "  Done. Press Enter to close this window."; read -r _`
  for (const [name, args] of TERMS) {
    const exe = which(name)
    if (exe && await tryTerminal(exe, args(['bash', '-c', script]))) return { ok: true, terminal: name, command: cmd }
  }
  return { error: 'No terminal found: run this yourself', command: cmd }
}

module.exports = { status, command, install, TOOLS }
