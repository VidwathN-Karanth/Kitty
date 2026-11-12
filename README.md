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

Kitty reads music, volume and radios from the usual desktop tools. Most desktops already have them; if music or volume
doesn't show, install them (Ubuntu/Debian: `sudo apt install playerctl pipewire-bin network-manager rfkill upower`).
On Wayland desktops Kitty runs through XWayland so it can stay on top.

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
