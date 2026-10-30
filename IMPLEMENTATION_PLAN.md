# Dynamic Island for Windows: Implementation Plan

Derived from 20 screenshots of the reference app (shown as "TwoCode", twocode.nl). This is a **feature-parity plan**. Use your own name, mascot art and logo. Only the features and layout are copied, not the branding.

---

## 1. What it is

A black, notch-style overlay pinned to the top-centre of the screen. It folds out into mini-apps and has a mascot ("Robo") that reacts to what your AI coding tools and music are doing. A separate **Settings window** (the sidebar app in the screenshots) configures everything.

Two surfaces:
1. **The Island**: a frameless, transparent, always-on-top window.
2. **The Settings window**: a normal window with a sidebar (Home, Connections, AI & Chat, Apps, Robo, Wardrobe, General, News).

---

## 2. Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Shell | **Electron** + TypeScript | Transparent, always-on-top windows, `globalShortcut`, `startDrag` for dragging files out of the tray, `Notification` and tray icon are all built in |
| UI | **React + Vite**, plain CSS and CSS variables | Fast to build, easy theming |
| Animation | **Framer Motion** (spring physics) | Island expand and collapse, tab pill morph |
| State and persistence | `electron-store` (JSON in `%APPDATA%`) | Settings, stats, notes, tray list, clipboard history |
| Windows media (Spotify) | **SMTC** (System Media Transport Controls) through a tiny C# or WinRT helper exe, or `@nodert-win10-rs4/windows.media.control` | Gives title, artist, artwork, position, play state and play/pause/next/prev for any media app. Works with Spotify with no API keys |
| System volume | Helper exe or the `loudness` npm package | Volume slider in the ••• menu |
| Claude Code tracking | **Claude Code hooks** posting to a local HTTP server | See §5 |
| Codex tracking | Tail Codex's session or log files, or its `notify` config | See §5 |
| AI chat | Spawn `claude -p` (headless mode) | "Uses your own Claude account, through Claude Code": no API key |
| Packaging and updates | `electron-builder` (NSIS `.exe` installer) + `electron-updater` + GitHub Releases + GitHub Actions | One downloadable `.exe`; one-click "Restart & update" (see §4.2) |
| Cursor tracking | Main-process polling of `screen.getCursorScreenPoint()` | The island window is click-through, so DOM mouse events can't see the whole screen (see §4.1) |

If you would rather have a small binary and low RAM, Tauri 2 works for everything above. Electron is the lower-risk route, especially for dragging files out.

---

## 3. Island: layout and behaviour

### 3.1 Window
- Frameless, transparent, `alwaysOnTop: 'screen-saver'`, `skipTaskbar`, no focus-steal when idle.
- Anchored to the top-centre of the primary display. It resizes to its content with animation.
- Black (`#000`) body, large radius on the **bottom corners only**, flush with the top edge.
- Click-through on the transparent area outside the island, using `setIgnoreMouseEvents(true, {forward:true})` toggled on hover.

### 3.2 States
1. **Collapsed**: a small pill showing Robo's eyes, plus a tiny status bit (music bars or a traffic-light colour).
2. **Expanded**: opens on hover or click, the **Ctrl+Alt+T** shortcut, or when an event happens (Claude is done, a question, a timer ends).
3. **Folded in**: the "Fold in" item in the ••• menu collapses it fully.

### 3.3 Header (every expanded view)
- **Left:** view title with the last word accent-coloured ("Claude **Code**", "Music **Player**", "File **Tray**", "Focus **Timer**", "Clip**board**", "Note**pad**", "Robo **Chat**"). The accent colour matches the app's tab colour.
- **Centre:** Robo's two eyes, then `Fri 30 Oct 2026 09:16` (the time in bold).
- **Right:** a mini audio-visualiser (animated bars, tinted by state) and a **•••** button.
- **••• menu:** system volume slider, All apps, Settings, Check for updates, Fold in, Quit (red).

### 3.4 Bottom tab bar
Icons for Home, Claude, Music, Chat, Focus, Tray, Clipboard, Note, and a volume icon at the far right. The active tab expands into a pill with its label and a tinted background in the app's colour:
- Claude: orange
- Music: tan
- Chat: green
- Focus: purple
- Tray: yellow
- Clipboard: blue
- Note: yellow

The pill morph is a shared-layout animation. Only enabled apps appear (see Apps settings).

### 3.5 Views

**Home**: three glass cards with gradient backgrounds (the Music card takes its colour from the album art):
- *Claude Code*: running spinner ring, big count of "jobs today".
- *Music*: art thumbnail, animated bars, truncated title and artist, pause button.
- *Focus*: big play button, `25:00 Ready to start`.

**Claude Code**
- Project name with its icon, and a large elapsed timer (`0:01`).
- Status line: `Thinking · step 1 of 4`.
- A speech bubble showing the user's prompt, truncated, and "Claude is thinking…".
- A 4-segment progress bar: **Read → Edit → Test → Done**.
- On a question, the eyes go to the "question" colour and the island pops open with the question text and an answer box. This is the "Helpful: answered 10 times from the island" achievement.

**Music Player**: album art, title, artist, a seek bar with elapsed and remaining time (`1:12 … -4:05`), prev, play/pause and next, and a source chip ("Spotify"). The whole island takes a gradient tint from the art's dominant colour. Dancing bars at the right.

**Robo Chat**: big eyes, "What can I do for you?", quick-action chips (**Explain / Check my spelling / Translate / Summarize**), and an input with a send button. Each chip is a prompt template. A picker appears when both Claude and Codex are connected.

**Focus Timer**: a scroll-wheel picker for hr and min, quick presets (5, 15, 25, 50 min), Reset and Start buttons, and "Done at HH:MM". On finish: sound, a Windows notification and confetti.

**File Tray**: a dashed drop zone ("Drop files here · Drag them out any time · click to open"). Stored as paths (or copies). Dragging out uses Electron `webContents.startDrag`. Clicking a file opens it.

**Clipboard**: the last N copies with type icon, truncated text and age (`13 min`). Click re-copies. A "Clear history" link.

**Note**: a single autosaved notepad. Typing `[ ]` converts to a check circle. Placeholder: "Click to type · Saved by itself".

---

### 3.6 Island extras (from General > Island)
- **Weather on Home:** the user types a city, saved in the store. Geocode and fetch with Open-Meteo (free, no key). Shown as a Home card or chip, refreshed every ~30 min. Hidden when no city is set.
- **Calendar:** the user pastes a Google Calendar "Secret address in iCal format" (`.ics` URL). Fetch it, parse it with `node-ical`, and show the next event on Home. Fire a notification shortly before an event starts. Treat the URL as a secret: store it locally, never log it.
- **Volume bar:** when the system volume changes (hardware keys), the island pops open briefly with a volume slider, then folds back. Needs a volume-change listener in the audio helper.
- **Battery warning:** notify when the laptop battery is low, and for Bluetooth devices (headphones, mouse) when they report low charge. Laptop: `powerMonitor` plus the Windows battery API. Bluetooth: read the battery property through a WinRT/PowerShell helper (best-effort, not every device reports it).
- **Start with Windows:** `app.setLoginItemSettings`.
- **Anonymous statistics:** an optional ping with a random install ID and the version, no personal data. Default it **off** in your build unless you really run a counter.
- **Reset everything:** resets the General settings to defaults (not stats or Robo progress).

---

## 4. Robo (the mascot)

Two glowing eyes in the island header, plus a full face (a visor with eyes) in settings and chat.

- **Expressions:** Happy, In love, Surprised, Curious, Focused, Wink, Sad, Dizzy, Sleepy. Build these as SVG with parameterised eye shapes, then animate between them. A settings page has a "See emotions" row to preview each one.
- **Traffic-light eyes:** the eye colour shows AI state.
  - Working or question: orange
  - Done: green
  - Error: red
  - Presets are Classic, Soft and Colour-blind, with 6 swatches per state.
- **Behaviours** (each has a toggle):
  - Faces
  - Blinking
  - Dancing to music, driven by the playback state
  - Sleep effect, with fall asleep after 5, 10 or 30 min of inactivity
  - Startup animation (wave and say "hi" + name)
  - Hunger: each task feeds Robo (a % bar). The screenshot shows "79% full"
- **Wardrobe:**
  - Outfit options: Best (auto), None, Party hat (5 tasks), Sunglasses (15 tasks), Crown (30 tasks).
  - Body colours: Cloud, Mint, Sky, Rose, Classic, Night, Blue, Purple, Pink, Gold.
  - Eye colours: Mint, White, Blue, Pink, Purple, Yellow.
  - Seasonal outfits: Santa hat in December, witch hat around Halloween, orange crown on King's Day (27 April). The screenshot shows a witch hat, so the date was around Halloween.
- **Robo Buddy:** drag Robo out of the island and drop him on anything on screen. He then captures that region or window (or reads its text with UI Automation) and asks the AI "what does this say / explain it". He can also check spelling in Word. Implement it as a borderless "carried Robo" window that follows the cursor, then on drop does `desktopCapturer` or UI Automation at that point, and sends it to Robo Chat.
- **Name:** user-editable, spoken at startup.

**Gamification**
- Stats: tasks done, tasks today, days-in-a-row streak.
- 12 achievements (locked or unlocked cards):
  - First task
  - Ten tasks
  - Fifty tasks
  - Helpful (answered 10 times from the island)
  - Night owl (a task done after midnight)
  - Early bird (a task done before 7 am)
  - Long haul (a task over 15 min)
  - Focus master (5 focus blocks finished)
  - DJ (controlled Spotify 10 times from the island)
  - Collector (5 files in the tray)
  - On a roll (used the mirror, which is a feature not shown in the screenshots; skip or define it)
  - Fashion icon (all outfits earned)
- Counters live in the store, and a small event bus unlocks achievements and fires confetti and a toast.

---

### 4.1 Cat mode: cat face and eyes that follow the cursor

The reference island only has two plain oval eyes. This build adds a **cute cartoon cat** as an alternative mascot face.

**Settings (Robo page, "Look" section)**
- **Mascot style:** `Robot` (default, as in the reference) or `Cat`.
- **Eyes follow my cursor** toggle (default on when Cat is selected). Applies to both styles.
- Cat colour presets (fur: orange tabby, black, white, grey, calico, Siamese) and eye colours reuse the Wardrobe swatch pattern. Outfits (hats, sunglasses, crown) sit on the cat's head with per-style anchor points.

**Art**
- A cat head in SVG: round face, two triangle ears (inner-ear pink), whiskers, a small nose and mouth, and big glossy eyes with a pupil, highlight and eyelids. Collapsed pill shows a small cat head or just the eyes with ears. Expanded header shows the full cat face. The settings preview shows a large one.
- The same expression set as Robo (Happy, In love, Surprised, Curious, Focused, Wink, Sad, Dizzy, Sleepy) is redrawn for the cat. Cat extras: ears twitch on events, slit pupils when "Surprised", slow blink when "Happy", tail wag on the Home card if you want it later.
- One `<Mascot style=... expression=... gaze={x,y} />` component so every view, the tray and Robo Buddy get the cat for free.

**Cursor tracking (the part that needs care)**
- The island is a small window that is mostly click-through, so DOM `mousemove` events will **not** fire for the rest of the screen. Instead, the **main process polls `screen.getCursorScreenPoint()`** and sends the position to the renderer over IPC.
  - Poll at ~60 Hz while the cursor is moving, drop to ~5 Hz after ~1 s of stillness, and pause fully while the island is hidden, asleep or the PC is locked. This keeps CPU near zero.
  - Coordinates are in DIP screen space. The renderer subtracts the window bounds and the eye element's `getBoundingClientRect()` centre, so it works on any monitor and DPI scale (subscribe to display-change events).
- Gaze maths: `v = cursor - eyeCentre`, `angle = atan2(v.y, v.x)`, `dist = min(|v| / 400px, 1)`. Move the pupil by `angle * dist * maxOffset` inside the eye. Smooth with a spring (Framer Motion `useSpring`) so it glides instead of snapping. Move the whole head a few pixels toward the cursor for a subtle parallax.
- Each eye uses its own centre so they converge slightly on a close cursor, which looks more alive.
- Behaviour rules:
  - Cursor far away or idle for a while: the eyes drift back to centre.
  - Sleepy or asleep: eyes closed, tracking off.
  - Mid-event (Claude question, done, error): the traffic-light colour wins and the eyes look at the island content, not the cursor.
  - Music playing: head bobs, eyes still track.
  - Fullscreen or game detected (`powerMonitor`/foreground-window check): tracking pauses.
- Toggle off: eyes return to the fixed forward gaze, and the polling timer is stopped entirely.

---

## 4.2 Installer and one-click updates

**Download:** a single signed Windows installer, `IslandSetup-x.y.z.exe`, built with `electron-builder` (NSIS target).
- Per-user install (no admin prompt) into `%LOCALAPPDATA%`, with Start-menu entry, optional desktop shortcut and an uninstaller. A finish page offers "Launch now" and "Start with Windows".
- Bundles everything the app needs: the Electron runtime, the media/volume/battery helper exe, and the sounds and art. No separate runtimes to install by hand. If the C# helper needs .NET, publish it **self-contained** so the user installs nothing.
- Also publish a **portable `.exe`** if you want, but note it cannot auto-update, so make the installer the main download.
- **Code signing:** an unsigned exe triggers Windows SmartScreen ("unknown publisher") and some antivirus false positives. Sign releases with an OV/EV certificate or Azure Trusted Signing. For friends-only testing you can skip it and tell them to click "More info → Run anyway".

**Updates (easy by design)**
- **Mechanism:** `electron-updater` reads release metadata (`latest.yml`) from a release host. Easiest is **GitHub Releases** (free, a public or private repo). A static S3/R2 bucket also works. Your CI (GitHub Actions on a version tag) builds the installer, signs it, and uploads the installer, `latest.yml` and the `.blockmap` (the blockmap gives small delta downloads).
- **When it checks:** on launch, then every ~6 hours, silently in the background.
- **Where the user sees it:**
  - ••• menu: **Check for updates** (as in the reference). While an update is ready it changes to a highlighted **Update available → Restart & update** item.
  - Settings > General > App: current version, **Check for updates** button, status line ("You're up to date" / "Downloading 42%" / "Ready to install"), and a toggle **Download updates automatically** (default on).
  - Robo reacts: a small badge on the island and a happy animation when a new version is ready.
- **One click:** the update downloads in the background (`autoDownload`). When the user clicks **Restart & update**, call `autoUpdater.quitAndInstall()`. The app closes, the installer applies the update silently (no wizard, no admin), and the app relaunches by itself. Settings, notes, tray and stats are preserved because they live in `%APPDATA%`, not the install dir. Add `autoInstallOnAppQuit` so a pending update also installs when the user just quits.
- **Safety:** verify the update's signature and checksum (electron-updater does this), keep the previous version's installer around for rollback, and migrate the store schema with versioned migrations on first launch after an update.
- **Release notes:** show the changelog in the News page after an update.
- **Dev flow for you:** bump the version → `git tag vX.Y.Z` → CI builds and publishes → every installed copy picks it up. No manual re-sharing of exe files.

---

## 5. Integrations

### Claude Code ("no windows to pick, no code")
1. On enabling the toggle, **auto-merge hooks into `~/.claude/settings.json`**: `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification` and `Stop`. Each hook runs a one-liner that POSTs the JSON payload (it includes `session_id`, `cwd`, the prompt and the tool name) to `http://127.0.0.1:<port>`. Back up the file first, and remove only our entries on disable.
2. The island runs the local server and derives the state:
   - Prompt submitted: Thinking.
   - Tool use: map the tool to a step (Read/Grep → Read, Edit/Write → Edit, Bash tests → Test).
   - `Notification` (permission or idle): **question** (orange).
   - `Stop`: **done** (green, ding, confetti if the task was long).
   - Error: **red**.
3. The project name comes from `cwd`. It works in the terminal, VS Code and the desktop app, because they all read `settings.json`.
4. "Connected" badge: the config file exists, the hooks are installed and a recent event has been received.

### Codex
Toggle is disabled with "Not found on this PC" when the binary or config is missing. Otherwise use Codex's `notify` config hook, or tail its session logs.

### Chat apps (Claude, ChatGPT)
Marked "Coming soon" in the reference. It needs a Chrome extension that watches for a finished answer. **Defer this.**

### Spotify and media
Poll SMTC every ~1 s, or use its event listeners. Filter to the Spotify session, or show any session if you prefer. Controls call the SMTC session's `TryTogglePlayPauseAsync` and related methods. Use the thumbnail stream for the artwork, and extract the dominant colour with canvas for the gradient.

---

## 6. Settings window

Sidebar: Home, Connections, AI & Chat, Apps, then **Robo** (Robo, Wardrobe), then **Settings** (General, News). The Robo mini-card with the task count and a theme toggle sits at the bottom. There is a global search box at the top right.

| Page | Contents |
|---|---|
| **Home** | Greeting ("Good morning, <name>"), Claude Code status chip, 3 stat tiles (tasks done, today, days in a row), searchable **Activity** feed (prompt text, status Error/Done, time, tool, project, duration), shortcut links to Wardrobe, Connections and General, and a rotating tip card |
| **Connections** | Coding AI: Claude Code and Codex, each with a status badge and a toggle. Chat apps: Claude and ChatGPT ("Coming soon") |
| **AI & Chat** | Which AI Robo's chat talks to: Claude ("Connected", uses Claude Code login) and Codex ("Connect") |
| **Apps** | Toggle cards: AI assistants (always on), Robo Buddy, Spotify, Focus, Tray, Clipboard, Note, Clock, Settings (always on). Includes a "More apps are coming" teaser |
| **Robo** | Name and Save, the traffic-light eyes presets and colours, Behaviour toggles, See emotions, Hunger, Achievements grid |
| **Wardrobe** | Live preview with spotlight, outfit picker, body and eye colours, seasonal toggle |
| **General** | Sections, top to bottom: **Island** (Weather city + Save, Calendar iCal URL + Save, Volume bar toggle, Battery warning toggle, Reset everything), **Testing** (Test mode: buttons that simulate Claude and music events), **Animations** (Speed Fast/Normal, App animations, Confetti), **Focus & notifications** (traffic-light sounds, Windows notifications, Warn at limit 70/80/90%/Never of the 5-hour usage limit, then a "Sound level" row with 4 options, cut off in the screenshot), **Keyboard shortcuts**, **Language** (Nederlands/English), **App** (Start with Windows, Anonymous statistics, Restart, Quit) |
| **News** | Not shown in the screenshots. Start as an empty "what's new" changelog page |

**Default shortcuts** (all rebindable, with a Reset button):

| Action | Shortcut |
|---|---|
| Open the island | Ctrl+Alt+T |
| Home | Ctrl+Alt+Shift+1 |
| Music | Ctrl+Alt+Shift+2 |
| Claude Code | Ctrl+Alt+Shift+3 |
| Focus timer | Ctrl+Alt+Shift+4 |
| Clipboard | Ctrl+Alt+Shift+5 |
| Note | Ctrl+Alt+Shift+6 |

**Design tokens** (from the screenshots):
- Dark surface `#0d0f12`, card `#181a1f`, hairline borders.
- Accent: lime `#cfe89a` (toggles and selected pills).
- Toggle: pill with a dark knob when on.
- Segmented controls with the selected option in lime.

**i18n:** a plain `en.json` and `nl.json` dictionary with a `t()` helper.

---

## 7. Architecture

```
main process
  ├─ windows.ts        island + settings windows, click-through, positioning
  ├─ store.ts          electron-store schema + migrations
  ├─ shortcuts.ts      globalShortcut registry (rebindable)
  ├─ hookServer.ts     127.0.0.1 HTTP server ← Claude Code hooks
  ├─ claudeHooks.ts    install/remove hooks in ~/.claude/settings.json
  ├─ media.ts          SMTC helper bridge (state + controls)
  ├─ volume.ts         system volume get/set
  ├─ clipboard.ts      poll clipboard → history
  ├─ tray.ts           file shelf, startDrag
  ├─ notify.ts         Windows notifications + sounds
  └─ updater.ts
renderer (React)
  ├─ island/           Header, TabBar, views/*
  ├─ settings/         pages/*
  ├─ robo/             Face.tsx (SVG), expressions, outfits, eyes
  └─ shared/           i18n, event bus, achievements, confetti
```
Main and renderer talk over typed IPC. The renderer subscribes to a single `state` stream (ai, media, timer, robo) so both windows stay in sync.

---

## 7b. Bonus features (my additions)

These are not in the reference app. I picked ones that are useful daily, fit the island's "glanceable" idea, and are realistic on Windows. Each has a tier: **A** = high value, cheap; **B** = high value, more work; **C** = nice later.

| # | Feature | Tier | What it does and how |
|---|---|---|---|
| 1 | **Approve or deny Claude Code actions from the island** | B | Claude asks "run this command?" and the island pops open with the command and **Allow / Deny** buttons (plus "Always allow this"). A `PreToolUse`/permission hook blocks, asks the local server, and returns the decision as the hook's JSON. Always fall back to Claude's normal terminal prompt after a timeout (~30 s) or if the island isn't running, so it can never wedge a session. This is the headline "cool and workable" feature. |
| 2 | **Multiple Claude sessions** | A | Hooks carry `session_id` and `cwd`. Show each running session as a row (project, step, timer, state colour) and let the user click one to focus its terminal window. Eyes show the most urgent state across all sessions (question > error > working > done). |
| 3 | **Usage meter** | B | Read token counts from Claude Code's local transcript files and show a daily or 5-hour bar in the Claude view. It also powers the "Warn at limit" setting properly, and is the best-effort data source noted in §9. Include estimated cost if the model prices are configured. |
| 4 | **Command palette** | A | A global hotkey (default Ctrl+Alt+Space) drops the island open with a search box. Type to jump to an app, search clipboard history and notes, start a timer ("focus 25"), toggle mute, or ask Robo. One input, fuzzy matching, no mouse. |
| 5 | **Smarter clipboard** | A | Pin items, search, image previews, and one-click transforms (trim, lowercase, prettify JSON, strip tracking from URLs). **Never record items flagged by password managers** (clipboard format `ExcludeClipboardContentFromMonitorProcessing`) and add a "pause history" switch and a per-app ignore list. |
| 6 | **Screenshots and downloads land in the Tray** | A | Watch for Win+Shift+S clipboard images and new files in `Downloads`. Offer "Add to tray" with a thumbnail, and show a small progress bar while a `.crdownload`/`.part` file grows. Drag out to any app. Feeds the "Collector" achievement. |
| 7 | **Mic and camera privacy dot** | A | Like iOS: an orange or green dot appears in the island when an app is using the microphone or camera, with the app's name on hover. Read the `CapabilityAccessManager\ConsentStore` registry keys (no admin needed). Add a one-click **mute mic** button. |
| 8 | **Meeting join button** | A | From the iCal feed, parse Zoom, Meet and Teams links. 5 minutes before the event the island shows a countdown and a **Join** button, and Robo gets excited. |
| 9 | **Focus mode with teeth** | A | Starting a focus block can also turn on Windows Focus Assist / Do Not Disturb, mute chosen apps, and show the remaining time in the collapsed pill. Auto-break timer after the block (pomodoro cycles: 25/5, long break every 4). Counts toward "Focus master". |
| 10 | **Quick toggles row** | B | Wi-Fi, Bluetooth, night light, dark mode, mute, "open Windows Settings". A small expandable strip on Home. Some need the helper exe; start with mute and dark mode. |
| 11 | **Smart auto-hide and placement** | A | Hide in fullscreen apps and games. Choose which monitor, notch style (attached to the top edge) or floating (a gap below the top), and size (compact, normal, large). Remember per display. |
| 12 | **Themes and accent colour** | A | Light, dark and "match the wallpaper" (pick the accent from the desktop wallpaper). The island stays black by default so it reads as a notch, but the accent drives pills, toggles and glow. |
| 13 | **Accessibility pass** | A | Reduce-motion toggle (also follows the Windows setting), full keyboard navigation of the island, screen-reader labels, high-contrast eyes preset (the Colour-blind preset already covers colour). |
| 14 | **Privacy mode hotkey** | A | One shortcut blurs clipboard and note contents (for screen sharing). Sensitive stuff is also redacted from the Activity feed. |
| 15 | **Backup, export and diagnostics** | A | Export or import all settings as one JSON, and a "Copy diagnostics" button (version, OS, which integrations are connected, last errors). Makes bug reports from friends painless. |
| 16 | **Little delights** | A | Robo reacts to things: startup wave, falls asleep at idle, looks at a file you drop, gets sad on error, a cake on your "days in a row" milestones, and a cat purr sound option for the cat mascot. Low cost, big charm. |
| 17 | **Plugin mini-apps** | C | Later: each mini-app is a folder with a manifest and a small web view, so new apps (weather, stocks, to-dos) can be added without touching the core. Only do this after the built-in apps stabilise. |

**Deliberately left out:** reading other apps' Windows toast notifications (needs package identity and is fragile), lyrics (licensing), and cloud sync (adds accounts, servers and privacy duties). Say so if you want any of them.

**Suggested slice for the first public build:** the reference feature set plus #2, #4, #5, #6, #7, #8, #9, #11, #12, #15, #16. Then #1 and #3 as the first update, since they're the biggest wow but need the most careful testing.

---

## 8. Build order

1. **Skeleton:** Electron + Vite + React. A transparent top-centre island window with expand and collapse animation, and a ••• menu (Fold in and Quit working).
2. **Chrome:** header (clock, eyes placeholder), tab bar with the morphing active pill, and the Home layout with placeholder cards.
3. **Simple apps:** Clock, Note, Clipboard, Focus timer (a timer with sound and a notification). These need no external tools.
4. **Tray:** drop zone, persistence, drag-out.
5. **Music:** SMTC helper, now-playing view, controls, gradient from the art.
6. **Claude Code:** hook server and installer, state machine, status view, traffic-light eyes and sounds, and the Activity log.
7. **Robo:** SVG face with expressions, blink, sleep, dance, startup wave, outfits and colours, and the Wardrobe page. Build the face as one `<Mascot>` component with a style switch from day one, then add the **cat face and cursor-following eyes** (§4.1) right after the robot works.
8. **Settings window:** all pages, plus store wiring, shortcuts, Apps toggles and i18n (English and Dutch).
9. **Gamification:** task counters, streaks, hunger, 12 achievements, confetti.
10. **Chat:** `claude -p` bridge, the quick-action chips, and the Codex option.
11. **Robo Buddy:** drag-out Robo, capture on drop, ask the AI, and spelling check.
12. **Polish:** Windows notifications, the 5-hour usage-limit warning, plus Test mode.
12b. **Ship it (§4.2):** NSIS installer `.exe`, code signing, GitHub Actions release pipeline, `electron-updater` wired to the ••• menu and Settings. Do a dry run early (steps 1 to 3) by publishing a v0.0.1 and a v0.0.2 and confirming the one-click update works, so the pipeline isn't a surprise at the end.
13. **Island extras:** weather, calendar (.ics), volume pop-up, battery warnings, start with Windows (§3.6).
14. **Bonus features (§7b):** first the cheap tier-A ones (command palette, clipboard upgrades, tray auto-add, privacy dot, meeting join, focus mode, themes, accessibility, export/diagnostics), then multi-session view, usage meter and in-island **approve/deny** for Claude Code.

Milestone checks: after step 3 the island is already useful. After step 6 you have the main feature. Steps 7 to 11 are the personality.

---

## 9. Risks and open questions

- **Usage-limit warning ("5-hour limit"):** there is no clean public source for this on the client. Options are parsing Claude Code's local usage data or estimating from its transcripts. Treat it as best-effort, and put it late.
- **Hook injection** edits a user config file, so it must be reversible, back up first, and be merge-safe.
- **Always-on-top over fullscreen apps and games** needs `screen-saver` level and testing. Windows may block it over exclusive fullscreen.
- **Multi-monitor and DPI:** position per display and handle scale changes. Cursor-tracking maths must use DIP coordinates on the right display.
- **Cursor-tracking cost and privacy:** polling is cheap but must back off when idle. It only reads the cursor position, nothing else, and nothing leaves the PC.
- **Updates need a signed build and a stable release host.** Without signing, SmartScreen warns on every new version. Auto-update only works for the installer build, not the portable exe.
- **Robo Buddy screen reading** is the riskiest feature (UI Automation per app). Start with screenshot to AI vision, and add text extraction later.
- **Unseen screens:** News, the "mirror" (the "On a roll" achievement), the options of the "Sound level" row in General (still cut off), the Weather and Calendar cards on Home (the Home screenshot predates a city being set), and what the island does when you drop a file onto it while collapsed. Send screenshots of these and I'll fill them in.
- **Branding and IP:** this plan mirrors someone else's shipped product. Name, mascot art, icons and copy should be your own.

---

## 10. Next step

Say "go" and I'll scaffold step 1 (Electron + React island window with the expand and collapse animation).
