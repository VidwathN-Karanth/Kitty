export const BODY = [
  { id: 'orange', name: 'Orange', c: '#f2a65a' }, { id: 'cream', name: 'Cream', c: '#f0d9b0' },
  { id: 'white', name: 'White', c: '#f4f1ea' }, { id: 'grey', name: 'Grey', c: '#9aa0aa' },
  { id: 'black', name: 'Black', c: '#3a3a42' }, { id: 'chocolate', name: 'Chocolate', c: '#7a4b32' },
  { id: 'rose', name: 'Rose', c: '#f2b8c6' }, { id: 'sky', name: 'Sky', c: '#9ec9f0' },
  { id: 'mint', name: 'Mint', c: '#a8e0c0' }, { id: 'lilac', name: 'Lilac', c: '#c3a8ee' },
]
export const EYE = [
  { id: 'mint', name: 'Mint', c: '#9be37a' }, { id: 'amber', name: 'Amber', c: '#f3b13e' },
  { id: 'blue', name: 'Blue', c: '#6ec6ff' }, { id: 'pink', name: 'Pink', c: '#f58fc2' },
  { id: 'purple', name: 'Purple', c: '#b79bff' }, { id: 'yellow', name: 'Yellow', c: '#f4e36a' },
  { id: 'white', name: 'White', c: '#f5f5f5' },
]
export const bodyColor = (id: string) => (BODY.find((b) => b.id === id) ?? BODY[0]).c
export const eyeColor = (id: string) => (EYE.find((b) => b.id === id) ?? EYE[0]).c

export type Outfit = 'none' | 'party' | 'sunglasses' | 'crown' | 'santa' | 'witch' | 'kings'

// Outfits earned by finishing tasks. "best" wears the highest one earned (or a seasonal one).
export const OUTFITS = [
  { id: 'best', name: 'Best', need: 0, emoji: '✨' },
  { id: 'none', name: 'None', need: 0, emoji: '\u{1F6AB}' },
  { id: 'party', name: 'Party hat', need: 5, emoji: '\u{1F973}' },
  { id: 'sunglasses', name: 'Sunglasses', need: 15, emoji: '\u{1F60E}' },
  { id: 'crown', name: 'Crown', need: 30, emoji: '\u{1F451}' },
] as const

// Santa hat in December, witch hat around Halloween, orange crown on King's Day (27 April)
export function seasonal(d: Date): Outfit | null {
  const m = d.getMonth(), day = d.getDate()
  if (m === 11) return 'santa'
  if ((m === 9 && day >= 20) || (m === 10 && day <= 2)) return 'witch'
  if (m === 3 && day === 27) return 'kings'
  return null
}

export function wearing(s: { outfit: string; seasonal: boolean }, total: number, d = new Date()): Outfit {
  if (s.outfit === 'best') {
    const sea = s.seasonal ? seasonal(d) : null
    return sea ?? (total >= 30 ? 'crown' : total >= 15 ? 'sunglasses' : total >= 5 ? 'party' : 'none')
  }
  const need = OUTFITS.find((o) => o.id === s.outfit)?.need ?? 0
  return total >= need ? (s.outfit as Outfit) : 'none'
}

export type CatLook = { body: string; eyes: string; outfit: Outfit }
