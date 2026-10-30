import type { Outfit } from './catStyle'

// Hats and glasses, drawn in the 100x80 space of the vector cat (head centre at 50,48, head width 80).
// The artwork cat reuses them through a transform, so outfits work with both.
export default function Outfits({ outfit }: { outfit: Outfit }) {
  return (
    <>
      {outfit === 'party' && <g><path d="M38 22 L50 -10 L62 22 Z" fill="#ff6fae" /><path d="M43 12 L57 12 M40 19 L60 19" stroke="#fff" strokeWidth="2.5" /><circle cx="50" cy="-11" r="4" fill="#ffd84a" /></g>}
      {outfit === 'sunglasses' && <g><rect x="20" y="37" width="30" height="19" rx="8" fill="#15151a" /><rect x="50" y="37" width="30" height="19" rx="8" fill="#15151a" /><path d="M26 41 L32 41" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" strokeLinecap="round" /></g>}
      {(outfit === 'crown' || outfit === 'kings') && <g><path d="M35 24 L36 4 L44 14 L50 0 L56 14 L64 4 L65 24 Z" fill={outfit === 'kings' ? '#ff8a1f' : '#f6c443'} stroke="#c9961a" strokeWidth="1.2" /><circle cx="50" cy="16" r="2.6" fill="#ff5a7a" /><circle cx="41" cy="18" r="2" fill="#6ec6ff" /><circle cx="59" cy="18" r="2" fill="#6ec6ff" /></g>}
      {outfit === 'santa' && <g><path d="M30 24 Q38 -14 70 -2 Q62 8 66 24 Z" fill="#d9362f" /><rect x="28" y="19" width="42" height="9" rx="4.5" fill="#fff" /><circle cx="71" cy="-2" r="5" fill="#fff" /></g>}
      {outfit === 'witch' && <g><path d="M36 22 L56 -22 L66 22 Z" fill="#3b2a5c" /><rect x="40" y="10" width="22" height="6" fill="#f0a030" /><ellipse cx="50" cy="22" rx="30" ry="5.5" fill="#3b2a5c" /></g>}
    </>
  )
}
