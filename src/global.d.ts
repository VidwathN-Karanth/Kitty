type MediaState = { active: boolean; title?: string; artist?: string; playing?: boolean; pos?: number; end?: number; app?: string; at?: number; sessions?: number }
type Media = { state: MediaState; art: { mime: string; data: string } | null; vol: { v: number; mute: boolean } | null; air?: boolean; priv?: { mic: boolean; cam: boolean } }
type ClaudeSession = { id: string; project: string; state: 'idle' | 'working' | 'question' | 'done' | 'error'; step: number; label: string; prompt: string; startedAt: number; endedAt: number | null; updatedAt: number }
type ClaudeData = { sessions: ClaudeSession[]; stats: { total: number; today: number; streak: number; hunger: number; counters: { focus: number; dj: number; answers: number }; flags: { night?: boolean; early?: boolean; long?: boolean }; runs: { project: string; prompt: string; startedAt: number; ms: number; status: string }[] } }
type ClaudeEvent = { type: 'question' | 'done' | 'error'; project: string; message?: string; ms?: number }
type UpdateStatus = { state: 'idle' | 'dev' | 'checking' | 'downloading' | 'ready' | 'uptodate' | 'error'; current: string; version?: string; percent?: number; error?: string }
type Info = { weather: { city?: string; temp?: number; emoji?: string; text?: string; error?: string } | null; events: { id: string; title: string; start: number; end: number; link: string }[]; bt: { name: string; level: number }[] }
type TrayFile = { path: string; name: string; icon: string }
type ShortcutKey = 'open' | 'home' | 'music' | 'claude' | 'focus' | 'clipboard' | 'note'
type Settings = {
  name: string; userName: string; theme: 'dark' | 'light'
  follow: boolean; faces: boolean; blinking: boolean; dancing: boolean; sleepEffect: boolean; sleepMins: number; startupAnim: boolean; appAnim: boolean; hunger: boolean
  bodyColor: string; eyeColor: string; outfit: string; seasonal: boolean
  lightPreset: string; lightWork: string; lightDone: string; lightError: string
  islandTop: string; islandBottom: string; songTicker: boolean
  sounds: boolean; soundLevel: 'soft' | 'normal' | 'loud'; notifications: boolean; confetti: boolean; warnAt: number; usageBudget: number
  musicGlow: 'adaptive' | 'rainbow' | 'white' | 'off'; speed: 'fast' | 'normal'; volumeBar: boolean; showBattery: boolean; batteryWarning: boolean; privacyDot: boolean; weatherCity: string; calendarUrl: string
  startWithWindows: boolean; testMode: boolean
  stats: { cpu: boolean; ram: boolean; gpu: boolean }; statsRest: boolean; statsOpen: boolean; peekOnQuestion: boolean
  shortcuts: Record<ShortcutKey, string>
  apps: { claude: boolean; music: boolean; chat: boolean; focus: boolean; tray: boolean; clipboard: boolean; note: boolean; clock: boolean }
}
type SettingsPatch = Partial<Omit<Settings, 'apps' | 'shortcuts' | 'stats'>> & { apps?: Partial<Settings['apps']>; shortcuts?: Partial<Settings['shortcuts']>; stats?: Partial<Settings['stats']> }
type SysStats = { cpu: number | null; ram: number | null; ramUsed: number; ramTotal: number; gpu: number | null }

interface Window {
  kitty: {
    quit(): void
    restart(): void
    rect(r: { x: number; y: number; w: number; h: number }): void
    track(on: boolean): void
    onCursor(cb: (p: { x: number; y: number }) => void): () => void
    idle(): Promise<number>
    clips(): Promise<{ text: string; t: number }[]>
    copyClip(text: string): void
    clearClips(): void
    onClips(cb: (c: { text: string; t: number }[]) => void): () => void
    tray(): Promise<TrayFile[]>
    onTray(cb: (f: TrayFile[]) => void): () => void
    removeFile(path: string): void
    openFile(path: string): void
    dragFile(path: string | string[]): void
    media(): Promise<Media>
    onMedia(cb: (m: Media) => void): () => void
    mediaCmd(cmd: string): void
    claude(): Promise<ClaudeData>
    claudeInstalled(): Promise<boolean>
    claudeSetInstalled(on: boolean): Promise<{ installed: boolean; error?: string }>
    onClaude(cb: (d: ClaudeData) => void): () => void
    onClaudeEvent(cb: (e: ClaudeEvent) => void): () => void
    usage(): Promise<number>
    onUsage(cb: (tokens: number) => void): () => void
    cli(): Promise<{ claude: boolean; codex: boolean }>
    chatAsk(id: number, prompt: string): void
    onChatChunk(cb: (m: { id: number; text: string }) => void): () => void
    onChatDone(cb: (m: { id: number; error: string; clear?: boolean }) => void): () => void
    settings(): Promise<Settings>
    setSettings(p: SettingsPatch): Promise<Settings>
    onSettings(cb: (s: Settings) => void): () => void
    resetSettings(): void
    resetShortcuts(): void
    onShortcutsFailed(cb: (keys: ShortcutKey[]) => void): () => void
    openSettings(page?: string): void
    onSettingsPage(cb: (page: string) => void): () => void
    updateStatus(): Promise<UpdateStatus>
    onUpdate(cb: (u: UpdateStatus) => void): () => void
    checkUpdate(): void
    installUpdate(): void
    info(): Promise<Info>
    onInfo(cb: (i: Info) => void): () => void
    openUrl(url: string): void
    onGoto(cb: (tab: string) => void): () => void
    onToggle(cb: () => void): void
    onFold(cb: () => void): () => void
    bump(name: 'focus' | 'answers'): void
    stats(): Promise<SysStats>
    onStats(cb: (s: SysStats) => void): () => void
    isPaused(): Promise<boolean>
    onPaused(cb: (p: boolean) => void): () => void
    testRun(kind: string): void
    onTest(cb: (kind: string) => void): () => void
  }
}
