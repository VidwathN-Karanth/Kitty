import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Lightbulb, SpellCheck, Languages, AlignLeft } from 'lucide-react'
import Cat, { Mood } from './Cat'
import { CatLook } from './catStyle'

const CHIPS = [
  { label: 'Explain', icon: Lightbulb, color: '#6ea8ff', ask: (t: string) => `Explain this clearly and briefly:\n\n${t}` },
  { label: 'Check my spelling', icon: SpellCheck, color: '#6fd06f', ask: (t: string) => `Fix the spelling and grammar of this text. Reply with only the corrected text:\n\n${t}` },
  { label: 'Translate', icon: Languages, color: '#4fb0e8', ask: (t: string) => `Translate this to English (or to Dutch if it is already English). Reply with only the translation:\n\n${t}` },
  { label: 'Summarize', icon: AlignLeft, color: '#b36ee8', ask: (t: string) => `Summarize this in at most 3 short bullet points:\n\n${t}` },
]

// Kitty chat: asks your own Claude (through the Claude Code CLI). The buttons work on what you typed, or on your last copy.
export default function Chat({ name, follow, look, mood, setMood, blink }: {
  name: string; follow: boolean; look: CatLook; mood: Mood; setMood: (m: Mood | null) => void; blink: boolean
}) {
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const reqId = useRef(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const offA = window.kitty.onChatChunk(({ id, text: t }) => { if (id === reqId.current) setAnswer((a) => a + t) })
    const offB = window.kitty.onChatDone(({ id, error, clear }) => {
      if (id !== reqId.current) return
      setBusy(false)
      if (clear) setAnswer('')
      if (error) { setNote(error); setMood('sad') } else setMood('happy')
    })
    return () => { offA(); offB() }
  }, [])
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight) }, [answer])

  const send = (prompt: string) => {
    reqId.current++
    setAnswer(''); setNote(''); setBusy(true); setMood('focused')
    window.kitty.chatAsk(reqId.current, prompt)
  }
  const ask = async (make?: (t: string) => string) => {
    let t = text.trim()
    if (!t && make) t = (await window.kitty.clips())[0]?.text ?? ''
    if (!t) { setNote(make ? 'Type something, or copy some text first.' : ''); return }
    send(make ? make(t) : t)
    setText('')
  }

  const showing = busy || answer || note
  return (
    <div className="chat">
      {showing ? (
        <div className="chat-answer" ref={box}>
          {busy && !answer && <span className="dim">{name} is thinking{'…'}</span>}
          {answer}
          {note && <span className="warn">{note}</span>}
        </div>
      ) : (
        <div className="chat-hello">
          <Cat size={72} follow={follow} mood={mood} body={look.body} eyes={look.eyes} outfit={look.outfit} blink={blink} />
          <b>What can I do for you?</b>
          <span className="dim">Copy some text, then pick an action. Or ask below.</span>
        </div>
      )}
      {!busy && <div className={'chips' + (showing ? ' small' : '')}>{CHIPS.map((c) => <button key={c.label} onClick={() => ask(c.ask)}><c.icon size={showing ? 14 : 16} color={c.color} />{c.label}</button>)}</div>}
      <form className="chat-in" onSubmit={(e) => { e.preventDefault(); ask() }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask ${name} something…`} disabled={busy} />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send"><ArrowUp size={18} /></button>
      </form>
    </div>
  )
}
