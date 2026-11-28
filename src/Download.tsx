import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download as DownloadIcon, Video, Music2, ClipboardPaste, X, FolderOpen, Smartphone, LoaderCircle, Check, CircleAlert, Play } from 'lucide-react'
import { usePhone } from './usePhone'

// the two sites' marks (simple outlines, drawn here: the icon set has no brand logos)
const Youtube = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="4.5" /><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" /></svg>
const Instagram = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" /></svg>
const SITE = { youtube: { name: 'YouTube', color: '#ff3d3d', Icon: Youtube }, instagram: { name: 'Instagram', color: '#e1306c', Icon: Instagram } }

// YouTube or Instagram link -> video (MP4, always with its sound) or audio (MP3), into Downloads.
// The first time, it fetches the two free tools it uses (yt-dlp and ffmpeg), after asking.
export default function Download() {
  const [s, setS] = useState<DlState | null>(null)
  const [url, setUrl] = useState('')
  const [site, setSite] = useState<'youtube' | 'instagram' | null>(null)
  const [kind, setKind] = useState<'video' | 'audio'>('video')
  const input = useRef<HTMLInputElement>(null)
  const phone = usePhone()
  useEffect(() => { window.kitty.dl().then(setS); return window.kitty.onDl(setS) }, [])
  // a supported link that was just copied is filled in already
  useEffect(() => { window.kitty.clipText().then((t) => window.kitty.dlSite(t).then((x) => { if (x) { setUrl(t.trim()); setSite(x) } })).catch(() => {}) }, [])
  useEffect(() => { const t = url.trim(); if (!t) return setSite(null); window.kitty.dlSite(t).then(setSite) }, [url])

  if (!s) return null
  const ready = s.tools.ytdlp && s.tools.ffmpeg
  if (!ready || s.setup) {
    const need = (s.tools.ytdlp ? 0 : s.size.ytdlp) + (s.tools.ffmpeg ? 0 : s.size.ffmpeg)
    const st = s.setup
    return (
      <div className="dl-setup">
        <span className="dl-setup-ico"><DownloadIcon size={22} /></span>
        <div className="dl-setup-txt">
          <b>{st && st.step !== 'error' ? (st.step === 'unpacking' ? 'Unpacking…' : `Getting ${st.step}… ${st.pct ?? 0}%`) : 'Get the downloader'}</b>
          <span>{st?.step === 'error' ? st.error
            : `Kitty uses yt-dlp and ffmpeg (free, open source) to save videos and music. They come once from their official GitHub pages, about ${need} MB.`}</span>
          {st && st.step !== 'error' && <span className="dl-bar"><i style={{ transform: `scaleX(${(st.pct ?? 0) / 100})` }} /></span>}
        </div>
        {(!st || st.step === 'error') && <button className="lk-btn primary" onClick={() => window.kitty.dlSetup()}>{st ? 'Try again' : `Get them (${need} MB)`}</button>}
      </div>
    )
  }

  const go = () => { if (!site) return input.current?.focus(); window.kitty.dlStart(url.trim(), kind); setUrl('') }
  const S = site ? SITE[site] : null
  return (
    <div className="dl">
      <div className="dl-in" style={S ? { ['--c' as string]: S.color } : undefined}>
        <span className="dl-site">{S ? <S.Icon size={16} /> : <DownloadIcon size={15} />}</span>
        <input ref={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube or Instagram link" spellCheck={false}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }} />
        {url ? <button className="dl-icon-btn" onClick={() => setUrl('')} aria-label="Clear"><X size={14} /></button>
          : <button className="dl-icon-btn" onClick={() => window.kitty.clipText().then(setUrl)} aria-label="Paste" title="Paste"><ClipboardPaste size={15} /></button>}
      </div>
      <div className="dl-row">
        <div className="qs-seg dl-kind" role="radiogroup" aria-label="Download as">
          {([['video', 'Video', 'MP4 with sound', Video], ['audio', 'Audio', 'MP3', Music2]] as const).map(([k, l, sub, I]) => (
            <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {kind === k && <motion.i layoutId="dl-kind" className="qs-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <span><I size={13} />{l}<small>{sub}</small></span>
            </button>
          ))}
        </div>
        <button className="lk-btn primary dl-go" disabled={!site} onClick={go}><DownloadIcon size={14} />Download</button>
      </div>
      <div className="dl-jobs">
        {!s.jobs.length && <span className="dl-note">{url && !site ? 'That isn\'t a YouTube or Instagram video link' : 'Saved to your Downloads folder · only download what you have the right to keep'}</span>}
        <AnimatePresence initial={false}>
          {s.jobs.slice(0, 2).map((j) => {
            const J = SITE[j.site]
            return (
              <motion.div layout key={j.id} className={'dl-job ' + j.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ['--c' as string]: J.color }}>
                <span className="dl-job-ico"><J.Icon size={15} /></span>
                <span className="dl-job-txt">
                  <b>{j.title || j.url}</b>
                  {j.status === 'working' ? <span className="dl-bar"><i style={{ transform: `scaleX(${j.pct / 100})` }} /></span>
                    : <small>{j.status === 'done' ? <><Check size={11} />{j.kind === 'audio' ? 'MP3' : 'MP4'} in Downloads</> : j.status === 'cancelled' ? 'Cancelled' : <><CircleAlert size={11} />{j.error}</>}</small>}
                </span>
                {j.status === 'working' && <small className="dl-pct">{j.pct ? `${j.pct}%` : <LoaderCircle size={12} className="spin" />}{j.eta ? ` · ${j.eta}` : ''}</small>}
                {j.status === 'working' && <button className="dl-icon-btn" onClick={() => window.kitty.dlCancel(j.id)} aria-label="Cancel"><X size={14} /></button>}
                {j.status === 'done' && j.out && <>
                  <button className="dl-icon-btn" onClick={() => window.kitty.dlOpen(j.out!)} aria-label="Play" title="Open"><Play size={14} /></button>
                  <button className="dl-icon-btn" onClick={() => window.kitty.dlReveal(j.out!)} aria-label="Show in folder" title="Show in folder"><FolderOpen size={14} /></button>
                  {phone.device && <button className="dl-icon-btn" onClick={() => phone.send([j.out!])} aria-label="Send to phone" title={`Send to ${phone.device.name}`}><Smartphone size={14} /></button>}
                </>}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
