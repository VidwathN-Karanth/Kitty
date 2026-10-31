import { createRoot } from 'react-dom/client'
import App from './App'
import SettingsApp from './Settings'
// Cascadia Mono everywhere (island and Settings), bundled so it works on PCs that don't have it installed
import '@fontsource/cascadia-mono/latin-400.css'
import '@fontsource/cascadia-mono/latin-600.css'
import '@fontsource/cascadia-mono/latin-700.css'
import './style.css'

// The same bundle serves two windows: the island overlay, the Settings window (?settings=...)
const q = new URLSearchParams(location.search)
const isSettings = q.has('settings')
if (isSettings) document.body.classList.add('sw-body')
createRoot(document.getElementById('root')!).render(isSettings ? <SettingsApp /> : <App />)
