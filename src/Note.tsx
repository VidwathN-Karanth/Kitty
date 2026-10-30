import { useState } from 'react'

const KEY = 'note'
const OPEN = '○', DONE = '●'

// One autosaved note. Typing "[ ]" becomes a circle; clicking a circle toggles it.
export default function Note() {
  const [text, setText] = useState(() => localStorage.getItem(KEY) ?? '')
  const save = (v: string) => { setText(v); localStorage.setItem(KEY, v) }

  return (
    <textarea
      className="note"
      value={text}
      placeholder="Click to type  ·  [ ] makes a check circle"
      spellCheck={false}
      onChange={(e) => save(e.target.value.replace(/\[ ?\]/g, OPEN))}
      onClick={(e) => {
        const i = e.currentTarget.selectionStart - 1
        const c = text[i]
        if (c === OPEN || c === DONE) save(text.slice(0, i) + (c === OPEN ? DONE : OPEN) + text.slice(i + 1))
      }}
    />
  )
}
