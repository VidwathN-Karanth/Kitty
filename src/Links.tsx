import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Check, X, Globe } from 'lucide-react'

type Link = { id: string; name: string; url: string; icon?: string | null; color?: string; auto?: boolean }
const KEY = 'kitty-links'
const load = (): Link[] => { try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : [] } catch { return [] } }
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
// "youtube.com/feed" -> "https://youtube.com/feed"; only web pages, with a real host name
function toUrl(raw: string) {
  let s = raw.trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && (u.hostname.includes('.') || u.hostname === 'localhost') ? u.href : null } catch { return null }
}
// The logo's own colour, so the card can wear it: an average weighted by how colourful each pixel is, so the white or
// black background around a logo doesn't wash it out ('' for a grey logo).
function logoColor(src: string): Promise<string> {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 24
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g) return ok('')
      g.drawImage(img, 0, 0, 24, 24)
      let d: Uint8ClampedArray
      try { d = g.getImageData(0, 0, 24, 24).data } catch { return ok('') }
      let r = 0, gr = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) {
        const w = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
        if (d[i + 3] < 128 || w < 40) continue
        r += d[i] * w; gr += d[i + 1] * w; b += d[i + 2] * w; n += w
      }
      ok(n ? `rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})` : '')
    }
    img.onerror = () => ok('')
    img.src = src
  })
}

// Saved sites, one click from the island (opens in your browser, where you are already signed in).
// Add a site with a name and a link; Delete picks sites to remove, then removes them all at once.
export default function Links() {
  const [links, setLinks] = useState<Link[]>(load)
  const [mode, setMode] = useState<'view' | 'add' | 'select'>('view')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [name, setName] = useState(''), [url, setUrl] = useState(''), [err, setErr] = useState('')
  const urlEl = useRef<HTMLInputElement>(null)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(links)) } catch {} }, [links])
  // a site added before its logo arrived (offline, island closed): try again next time
  useEffect(() => { links.filter((l) => l.icon === undefined).forEach(fetchInfo) }, [])

  async function fetchInfo(l: Link) {
    const { icon, title } = await window.kitty.siteInfo(l.url).catch(() => ({ icon: null, title: '' }))
    const color = icon ? await logoColor(icon) : ''
    setLinks((all) => all.map((x) => (x.id === l.id ? { ...x, icon, color, name: x.auto && title ? title.slice(0, 40) : x.name } : x)))
  }
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const u = toUrl(url)
    if (!u) { setErr('That doesn’t look like a web address'); urlEl.current?.focus(); return }
    const l: Link = { id: Date.now().toString(36), name: name.trim() || host(u), url: u, auto: !name.trim() }
    setLinks((all) => [...all, l]); fetchInfo(l)
    setName(''); setUrl(''); setErr(''); setMode('view')
  }
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const done = () => { setSel(new Set()); setMode('view') }
  const remove = () => { setLinks((all) => all.filter((l) => !sel.has(l.id))); done() }

  if (mode === 'add')
    return (
      <form className="lk-form" onSubmit={add} onKeyDown={(e) => { if (e.key === 'Escape') setMode('view') }}>
        <b className="lk-form-t">Add a site</b>
        <div className="lk-fields">
          <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional, e.g. YouTube" maxLength={40} spellCheck={false} /></label>
          <label><span>URL</span><input ref={urlEl} autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setErr('') }} placeholder="youtube.com" spellCheck={false} inputMode="url" /></label>
        </div>
        <div className="lk-actions">
          <small className="lk-err">{err}</small>
          <button type="button" className="lk-btn" onClick={() => { setMode('view'); setErr('') }}>Cancel</button>
          <button type="submit" className="lk-btn primary" disabled={!url.trim()}>Add</button>
        </div>
      </form>
    )

  const picking = mode === 'select'
  return (
    <div className="links">
      <div className="lk-grid">
        <AnimatePresence initial={false}>
          {links.map((l) => (
            <motion.button layout key={l.id} className={'lk' + (sel.has(l.id) ? ' sel' : '') + (picking ? ' picking' : '')} style={{ ['--c' as string]: l.color || '#5a5a66' }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              onClick={() => (picking ? toggle(l.id) : window.kitty.openUrl(l.url))} title={picking ? 'Select' : l.url} aria-pressed={picking ? sel.has(l.id) : undefined}>
              <span className="lk-ico">{l.icon ? <img src={l.icon} alt="" draggable={false} /> : <b>{l.name[0]?.toUpperCase()}</b>}</span>
              <span className="lk-txt"><b>{l.name}</b><small>{host(l.url)}</small></span>
              {picking && <span className="lk-check">{sel.has(l.id) && <Check size={12} strokeWidth={3} />}</span>}
            </motion.button>
          ))}
          {!picking && (
            <motion.button layout key="add" className={'lk add' + (links.length ? '' : ' first')} onClick={() => setMode('add')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {links.length ? <><Plus size={16} /><span>Add a site</span></>
                : <><span className="lk-first-ico"><Globe size={20} /></span><span className="lk-first-t"><b>Add your first site</b><small>YouTube, Gmail, Spotify… its logo shows up by itself</small></span><Plus size={18} className="lk-first-plus" /></>}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="lk-foot">
        {picking ? <>
          <span>{sel.size ? `${sel.size} selected` : 'Tap the sites to delete'}</span>
          <button className="lk-btn" onClick={done}><X size={14} />Cancel</button>
          <button className="lk-btn danger" disabled={!sel.size} onClick={remove}><Trash2 size={14} />Delete{sel.size ? ` ${sel.size}` : ''}</button>
        </> : <>
          <span>Any page, signed in, one click away.</span>
          {links.length > 0 && <button className="lk-btn" onClick={() => setMode('select')}><Trash2 size={14} />Delete</button>}
        </>}
      </div>
    </div>
  )
}
