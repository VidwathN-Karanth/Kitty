# Kitty

A dynamic island for your desktop, with a cat. It sits at the top of the screen and shows your music, volume,
battery, Wi-Fi, CPU/RAM/GPU and what Claude Code is doing. Hover to open it for music controls, a focus timer, a file
tray, clipboard history, notes and a chat.

## Install

Download the latest version from [Releases](https://github.com/VidwathN-Karanth/Kitty/releases/latest).

**Windows:** run `Kitty-Setup-<version>.exe` and pick where to install it.

**Linux:** download `Kitty-<version>.AppImage`, make it runnable and start it:

```bash
chmod +x Kitty-*.AppImage && ./Kitty-*.AppImage
```

If it doesn't start, install FUSE (Ubuntu 22.04: `sudo apt install libfuse2`, 24.04 and newer: `libfuse2t64`).
On Wayland desktops Kitty runs through XWayland (it restarts itself once for that) so it can sit at the top and stay
on top.

Kitty reads music, volume, radios and more from the usual desktop tools. Most desktops have them already; if a
feature doesn't show, install what it needs (Ubuntu/Debian names):

| Feature | Package |
|---|---|
| Music, volume, mic dot | `playerctl pipewire-bin` |
| Wi-Fi list and joining, airplane mode | `network-manager rfkill` |
| Bluetooth battery levels | `upower` |
| Brightness, power mode | `brightnessctl power-profiles-daemon` |
| Night light and its strength | GNOME |
| Send to phone | `kdeconnect` (phone paired in KDE Connect) |
| Convert: Word and PDF / HEIC photos | `libreoffice` / `libheif-examples` |
| Download: video with sound, MP3 | `ffmpeg` (or Kitty fetches it) |

## Updates

Kitty updates itself: it checks on start-up and every 6 hours, downloads in the background, and installs when you
choose **Restart & update** or next quit. On Linux this works for the AppImage.

## Build

```bash
npm install
npm run dev          # run from source
npm run dist         # Windows installer, in release/
npm run dist:linux   # Linux AppImage (build on Linux, e.g. WSL), in release/
```

A release on GitHub needs the installer files plus `latest.yml` (Windows) and `latest-linux.yml` (Linux).
