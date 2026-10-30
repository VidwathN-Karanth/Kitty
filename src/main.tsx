import { createRoot } from 'react-dom/client'
import App from './App'
import SettingsApp from './Settings'
import './style.css'

// The same bundle serves two windows: the island overlay, the Settings window (?settings=...)
const q = new URLSearchParams(location.search)
const isSettings = q.has('settings')
if (isSettings) document.body.classList.add('sw-body')
createRoot(document.getElementById('root')!).render(isSettings ? <SettingsApp /> : <App />)
