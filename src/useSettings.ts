import { useEffect, useState } from 'react'

export const DEFAULT_SETTINGS: Settings = {
  name: 'Kitty', userName: '', theme: 'dark',
  follow: true, faces: true, blinking: true, dancing: true, sleepEffect: true, sleepMins: 10, startupAnim: true, appAnim: true, hunger: true,
  bodyColor: 'orange', eyeColor: 'mint', outfit: 'best', seasonal: true,
  lightPreset: 'neon', lightWork: '#ffe600', lightDone: '#39ff14', lightError: '#ff1744',
  islandTop: '#000000', islandBottom: '#000000', songTicker: true,
  sounds: true, soundLevel: 'normal', notifications: true, confetti: true, warnAt: 80, usageBudget: 1000000,
  musicGlow: 'adaptive', speed: 'fast', volumeBar: true, showBattery: true, batteryWarning: true, privacyDot: true, weatherCity: '', calendarUrl: '',
  startWithWindows: true, testMode: false,
  stats: { cpu: true, ram: true, gpu: true }, statsRest: true, statsOpen: true, peekOnQuestion: true,
  shortcuts: { open: 'Ctrl+Alt+T', home: 'Ctrl+Alt+Shift+1', music: 'Ctrl+Alt+Shift+2', claude: 'Ctrl+Alt+Shift+3', focus: 'Ctrl+Alt+Shift+4', clipboard: 'Ctrl+Alt+Shift+5', note: 'Ctrl+Alt+Shift+6' },
  apps: { claude: true, music: true, chat: true, focus: true, tray: true, clipboard: true, note: true, clock: true },
}

// Settings live in the main process; the island and the Settings window both read them here and stay in sync.
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  useEffect(() => {
    window.kitty.settings().then(setSettings)
    return window.kitty.onSettings(setSettings)
  }, [])
  return { settings, set: (p: SettingsPatch) => window.kitty.setSettings(p) }
}

// Traffic-light presets (the colours the status dot and the cat's eyes use)
export const LIGHT_PRESETS = {
  neon: { name: 'Neon', work: '#ffe600', done: '#39ff14', error: '#ff1744' },
  classic: { name: 'Classic', work: '#f0a030', done: '#5fe05f', error: '#e5483d' },
  soft: { name: 'Soft', work: '#f6c177', done: '#9ad8a8', error: '#e89a9a' },
  blind: { name: 'Colour-blind', work: '#f0a030', done: '#4f9dff', error: '#c06bff' },
} as const
export const LIGHT_SWATCHES = {
  work: ['#ffe600', '#f0a030', '#f6b73c', '#f6d34a', '#f06fa0', '#b79bff', '#7fb8ff'],
  done: ['#39ff14', '#5fe05f', '#a6f0a6', '#d3e8a0', '#6fe0d0', '#4f8dff', '#ffffff'],
  error: ['#ff1744', '#e5483d', '#f0a39a', '#d0314a', '#f07f20', '#e050c0', '#a050f0'],
}
export const lights = (s: Settings) => ({ work: s.lightWork, done: s.lightDone, error: s.lightError })
