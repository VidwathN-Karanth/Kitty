import { Home, Music, MessageCircle, Timer, Inbox, Copy, FileText } from 'lucide-react'
import ClaudeMark from './ClaudeMark'

// title = [white part, coloured part] shown top-left, like "Claude Code" / "Music Player"
export const TABS = [
  { id: 'home', label: 'Home', icon: Home, color: '#e8e8e8', title: ['', ''] },
  { id: 'claude', label: 'Claude', icon: ClaudeMark, color: '#d97757', title: ['Claude ', 'Code'] },
  { id: 'music', label: 'Music', icon: Music, color: '#c9a574', title: ['Music ', 'Player'] },
  { id: 'chat', label: 'Kitty', icon: MessageCircle, color: '#6fd06f', title: ['Kitty ', 'Chat'] },
  { id: 'focus', label: 'Focus', icon: Timer, color: '#b36ee8', title: ['Focus ', 'Timer'] },
  { id: 'tray', label: 'Tray', icon: Inbox, color: '#f0d442', title: ['File ', 'Tray'] },
  { id: 'clipboard', label: 'Clipboard', icon: Copy, color: '#6fb6e8', title: ['Clip', 'board'] },
  { id: 'note', label: 'Note', icon: FileText, color: '#f0d442', title: ['Note', 'pad'] },
] as const

export type TabId = (typeof TABS)[number]['id']
