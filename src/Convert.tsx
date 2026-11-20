import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, ArrowRight, ChevronDown, Plus, X, Check, LoaderCircle, FolderOpen, CircleAlert, Wand2 } from 'lucide-react'

// what a format is called on screen, and the colour of its kind
const LABEL: Record<string, string> = { jpg: 'JPG', docx: 'Word', doc: 'DOC', odt: 'ODT', rtf: 'RTF', pdf: 'PDF', heic: 'HEIC', svg: 'SVG' }
const label = (f: string | null) => (f ? LABEL[f] ?? f.toUpperCase() : '?')
const KIND: Record<string, 'image' | 'pdf' | 'word'> = { png: 'image', jpg: 'image', webp: 'image', avif: 'image', gif: 'image', tiff: 'image', bmp: 'image', ico: 'image', heic: 'image', svg: 'image', pdf: 'pdf', docx: 'word', doc: 'word', odt: 'word', rtf: 'word' }
const TONE = { image: '#4fd1c5', pdf: '#ff6b5e', word: '#4f9dff' }
const tone = (f: string | null) => (f && KIND[f] ? TONE[KIND[f]] : '#8a8a92')
const FROM = Object.keys(KIND)
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const EMPTY: ConvertState = { files: [], from: 'auto', to: null, combine: true, running: false, results: {}, toOptions: [], detected: null, mixed: false }

// Convert: drop files (or choose them), the format is found from the files themselves (and can be changed), pick
// what they should become, convert. Results land next to the originals. The job runs in the main process, so it
// keeps going while the island is closed.
export default function Convert() {
  const [s, setS] = useState<ConvertState>(EMPTY)
  const [over, setOver] = useState(false)
  const [pickFrom, setPickFrom] = useState(false)
  const depth = useRef(0)
  useEffect(() => { window.kitty.convert().then(setS); return window.kitty.onConvert(setS) }, [])

  const res = s.results
  const results = Object.values(res)
  const finished = !s.running && results.length > 0 && results.every((r) => r.status === 'done' || r.status === 'error' || r.status === 'skip')
  const ok = results.filter((r) => r.status === 'done').length, bad = results.filter((r) => r.status === 'error').length
  const firstOut = results.find((r) => r.out)?.out
  const fromShown = s.from !== 'auto' ? s.from : s.detected
  const images = s.files.filter((f) => KIND[(s.from === 'auto' ? f.format : s.from) ?? ''] === 'image').length
  const slowDocs = s.running && s.files.some((f) => res[f.path]?.status === 'working' && KIND[(s.from === 'auto' ? f.format : s.from) ?? ''] !== 'image')
  const drag = {
    'data-drop': 'convert',
    onDragEnter: () => { depth.current++; setOver(true) },
    onDragLeave: () => { if (--depth.current <= 0) { depth.current = 0; setOver(false) } },
    onDrop: () => { depth.current = 0; setOver(false) },
  }

  if (!s.files.length)
    return (
      <div className={'cv-empty' + (over ? ' over' : '')} {...drag}>
        <span className="cv-empty-ico"><ArrowLeftRight size={22} /></span>
        <b>Drop files to convert</b>
        <span className="cv-empty-sub">Images to any image format or a PDF · PDF to Word · Word to PDF</span>
        <button className="lk-btn primary" onClick={() => window.kitty.convertPick()}>Choose files</button>
      </div>
    )

  return (
    <div className={'cv' + (over ? ' over' : '')} {...drag} onMouseDown={(e) => { if (!(e.target as Element).closest('.cv-from')) setPickFrom(false) }}>
      <div className="cv-files">
        <AnimatePresence initial={false}>
          {s.files.map((f) => {
            const r = res[f.path], fmt = s.from === 'auto' ? f.format : s.from
            return (
              <motion.div layout key={f.path} className={'cv-file' + (r?.status === 'done' ? ' done' : r?.status === 'error' ? ' bad' : '')}
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                onClick={() => r?.out && window.kitty.convertOpen(r.out)} title={r?.error ?? (r?.out ? `Open ${r.out}` : f.path)}>
                <span className="cv-badge" style={{ ['--c' as string]: tone(fmt) }}>{label(fmt)}</span>
                <span className="cv-txt">
                  <b>{f.name}</b>
                  <small>{r?.status === 'working' ? <><LoaderCircle size={11} className="spin" />Converting…</>
                    : r?.status === 'waiting' ? 'Waiting…'
                    : r?.status === 'done' ? <><Check size={11} />Done · click to open</>
                    : r?.status === 'error' ? <><CircleAlert size={11} />{r.error}</>
                    : r?.status === 'skip' ? <><Check size={11} />Already {label(s.to)}</>
                    : !f.format && s.from === 'auto' ? 'Unknown type' : size(f.size)}</small>
                </span>
                {!s.running && <button className="cv-x" onClick={(e) => { e.stopPropagation(); window.kitty.convertRemove(f.path) }} aria-label={`Remove ${f.name}`}><X size={12} /></button>}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="cv-row">
        <div className="cv-from">
          <button className="cv-chip from" disabled={s.running} onClick={() => setPickFrom((x) => !x)} aria-expanded={pickFrom}
            title={s.from === 'auto' ? (s.mixed ? 'Different types: each file is read as what it is' : 'Found from the files themselves') : 'Set by you'}>
            {s.from === 'auto' && <Wand2 size={12} />}
            <span>{s.from === 'auto' ? (s.mixed ? 'Mixed' : fromShown ? label(fromShown) : 'Unknown') : label(s.from)}</span>
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {pickFrom && (
              <motion.div className="cv-pop" initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.16 }}>
                <div className="cv-grid">
                  <button className={'cv-chip auto' + (s.from === 'auto' ? ' on' : '')} title="Read each file's real type from its contents" onClick={() => { window.kitty.convertSet({ from: 'auto' }); setPickFrom(false) }}><Wand2 size={12} />Auto</button>
                  {FROM.map((f) => (
                    <button key={f} className={'cv-chip' + (s.from === f ? ' on' : '') + (s.from === 'auto' && s.detected === f ? ' det' : '')} style={{ ['--c' as string]: tone(f) }}
                      title={s.from === 'auto' && s.detected === f ? 'Found automatically' : `Treat the files as ${label(f)}`} onClick={() => { window.kitty.convertSet({ from: f }); setPickFrom(false) }}>{label(f)}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ArrowRight size={15} className="cv-arrow" />
        <div className="cv-to" role="radiogroup" aria-label="Convert to">
          {s.toOptions.length ? s.toOptions.map((t) => (
            <button key={t} role="radio" aria-checked={s.to === t} disabled={s.running} className={'cv-chip to' + (s.to === t ? ' on' : '')} style={{ ['--c' as string]: tone(t) }}
              onClick={() => window.kitty.convertSet({ to: t })}>
              {s.to === t && <motion.i layoutId="cv-to" className="cv-to-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <span>{label(t)}</span>
            </button>
          )) : <span className="cv-none">{s.files.some((f) => !f.format) && s.from === 'auto' ? 'What are these files? Pick it on the left' : 'These files can\'t all become the same thing: convert them in groups'}</span>}
        </div>
      </div>

      <div className="cv-foot">
        <span className="cv-status">
          {s.running ? (slowDocs ? 'Word is converting… a PDF can take a minute' : 'Converting…')
            : finished ? `${ok} converted${bad ? ` · ${bad} failed` : ''} · next to the originals`
            : !s.toOptions.length ? ''
            : !s.to ? 'Pick what they should become'
            : `${s.files.length} file${s.files.length > 1 ? 's' : ''} → ${label(s.to)}`}
        </span>
        {s.to === 'pdf' && images > 1 && !s.running && !finished && (
          <button className={'cv-toggle' + (s.combine ? ' on' : '')} role="switch" aria-checked={s.combine} onClick={() => window.kitty.convertSet({ combine: !s.combine })}><i />One PDF</button>
        )}
        {finished && firstOut && <button className="lk-btn" onClick={() => window.kitty.convertReveal(firstOut)}><FolderOpen size={14} />Show</button>}
        {!s.running && <button className="lk-btn" onClick={() => window.kitty.convertPick()} aria-label="Add files"><Plus size={14} />Add</button>}
        {!s.running && <button className="lk-btn" onClick={() => window.kitty.convertClear()}>Clear</button>}
        <button className="lk-btn primary cv-go" disabled={!s.to || s.running || !s.toOptions.length} onClick={() => window.kitty.convertRun()}>
          {s.running ? <><LoaderCircle size={14} className="spin" />Working</> : 'Convert'}
        </button>
      </div>
    </div>
  )
}
