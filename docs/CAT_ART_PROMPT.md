# Kitty artwork v3: the Gemini prompt (same cat every time)

Gemini draws a slightly different cat every time it starts from words alone. So this version gives it a
**picture of Kitty to copy**, and asks for one sheet per message **in the same chat**, so it keeps looking at the
same cat.

The eyes sheet (sheet 1) and the two wardrobe sheets (5 and 6) are already good. Only the three face sheets need
redoing.

## How to do it

1. Open a **new** Gemini chat (an image model such as Gemini 2.5 Flash Image / "Nano Banana").
2. Attach **`art/kitty-reference.png`** and paste **Message 1** below. Save the result as `sheet2.png`.
3. In the **same chat**, attach `art/kitty-reference.png` again and paste **Message 2**. Save it as `sheet3.png`.
4. Same chat, attach the reference again, paste **Message 3**. Save it as `sheet4.png`.
5. If one face drifts (bigger head, different ears, a body, other eyes), don't redo the whole sheet. Reply:
   *"Cell N doesn't match the reference. Redraw only that cell with exactly the same head as the attached image,
   then give me the full 3x3 sheet again."*
6. Put the three files in `art/v3/` with `sheet1`, `sheet5` and `sheet6` copied from `art/v2/`, and send them to me
   (or run `npx electron tools/slice-cat-sheets.js art/v3`).

Before saving, check each sheet against the reference: same head shape, same ear size, same eye size and colour,
no body, a 3x3 grid, no text or lines. Every cell should look like the same sticker with only the face changed.

---

## Message 1 (attach `art/kitty-reference.png`)

```
The attached image is "Kitty", a mascot cat. I need a 3 x 3 sprite sheet of Kitty's facial expressions.

KITTY MUST LOOK EXACTLY LIKE THE ATTACHED IMAGE IN ALL 9 CELLS. Copy it; do not redesign it.
- Same head shape: wide, rounded, a little wider than tall, softly flattened at the bottom. HEAD ONLY:
  no neck, no shoulders, no body, no arms (only a small paw if a cell asks for one).
- Same ears: same size, same shape, same cream-coloured insides, same position.
- Same fur colour, same three forehead stripes, same two short stripes on each cheek, same cream muzzle and chin.
- Same eye size, eye spacing and mint-green iris with a dark-brown pupil and a white highlight
  (unless the cell says the eyes change, e.g. closed, hearts, stars).
- Same small pink nose, same thin dark-brown outline thickness, same thick white sticker edge around the head.
- Same flat, clean sticker style and the same soft colours. No extra shading, no texture, no new details.
- Only these may change: eyes, eyelids, eyebrows (thin, short, dark brown), mouth, cheek blush, and the small
  extras that a cell asks for.

LAYOUT (a script cuts this image automatically, so follow it exactly)
- One SQUARE image, 2048 x 2048 if possible, split into a 3 x 3 grid of 9 equal square cells.
- In every cell the head is the SAME SIZE and in the SAME PLACE as in the attached image: centred, the head
  (not counting the white edge) about 62% of the cell wide, ear tips about 18% from the top of the cell.
  Do not make some heads bigger or smaller.
- Background everywhere: one flat solid pure magenta #FF00FF. No gradient, no shadow, no floor.
- NO text, NO labels, NO numbers, NO grid lines, NO borders, NO frames between the cells.
- Never use magenta, purple or pink-purple on the cat or the extras (hearts red, tears light blue).
- Extras stay inside their own cell with some magenta margin around them.

THE 9 CELLS (left to right, top to bottom)
1. happy: eyes closed into happy upside-down "U" arcs, open smile with a small pink tongue, light pink blush.
2. love: eyes are two red hearts, open smile, light pink blush, two tiny red hearts beside the head.
3. surprised: eyes a bit wider with smaller pupils, eyebrows raised high, small round "o" mouth.
4. curious: one eyebrow raised, pupils looking up-right, small "w" mouth, a small light-blue "?" at the upper
   right. Head NOT tilted.
5. focused: upper eyelids lowered a little, short eyebrows angled down, small straight mouth.
6. wink: left eye open, right eye closed in a happy arc, small smile, a tiny yellow sparkle by the closed eye.
7. sad: eyebrows raised in the middle, droopy eyelids, small frown, one light-blue tear under the left eye.
8. dizzy: eyes are two dark-brown spirals, wavy mouth, three small yellow stars in a ring above the head.
9. sleepy: eyelids half closed, relaxed small "w" mouth.
```

## Message 2 (same chat, attach `art/kitty-reference.png` again)

```
Great. Now the next 3 x 3 sheet with exactly the same rules as before: Kitty must look EXACTLY like the attached
image in every cell (same head shape and size, same ears, same stripes, same eyes, same white sticker edge,
head only, no body), the same size and position in every cell, flat magenta #FF00FF background, no text, no
labels, no grid lines.

THE 9 CELLS (left to right, top to bottom)
1. asleep: eyes closed as gentle downward curves, tiny open mouth, a small light-blue snot bubble at the nose,
   two small dark-brown "z" letters at the upper right.
2. listening: dark-grey over-ear headphones (band over the top of the head between the ears, round ear cups on
   the sides of the head), eyes closed and relaxed, small content smile, one small dark-brown music note.
3. angry: eyebrows sharply angled down, narrowed eyes, small frown, a small red anger mark at the upper right.
4. excited: eyes are two golden-yellow stars, big open smile with tongue, light pink blush, small yellow
   sparkles around the head.
5. crying: worried eyebrows, eyes squeezed shut, wobbly open mouth, two streams of light-blue tears.
6. laughing: eyes closed in happy arcs, wide open laughing mouth with tongue, small tears of joy at the corners.
7. shy: strong pink blush on both cheeks, eyes looking down and to the side, tiny wobbly smile, worried eyebrows,
   one small orange paw raised in front of the mouth.
8. smug: half-closed eyes, one eyebrow raised, lopsided smirk.
9. scared: wide eyes with tiny pupils, worried eyebrows, wavy mouth, a light-blue sweat drop at the upper right.
   Same fur colour as always (no blue on the head).
```

## Message 3 (same chat, attach `art/kitty-reference.png` again)

```
Great. One more 3 x 3 sheet with exactly the same rules: Kitty must look EXACTLY like the attached image in every
cell (same head shape and size, same ears, same stripes, same mint-green eyes, same white sticker edge, HEAD
ONLY with no shoulders or body), the same size and position in every cell, flat magenta #FF00FF background,
no text, no labels, no grid lines. Where a paw is asked for, draw only one small round orange paw next to the
face, not an arm or a body.

THE 9 CELLS (left to right, top to bottom)
1. bored: half-closed flat eyelids, pupils looking to the side, flat straight mouth.
2. yawning: eyes squeezed closed, mouth wide open in a big yawn, one small paw in front of the mouth.
3. wave: happy open eyes, open smile, one small paw raised next to the right cheek, two little motion lines.
4. purring: eyes closed in blissful happy arcs, content "w" smile, strong pink blush, three small red hearts
   floating around the head.
5. hungry: big shiny pleading eyes, small open mouth with a light-blue drool drop, a small fish in a white
   thought bubble at the upper right.
6. thinking: pupils looking up-right, one eyebrow raised, mouth pushed to one side, one small paw on the chin.
7. confused: one eye bigger than the other, wavy tilted mouth, a light-blue "?" at the upper right.
   Head NOT tilted.
8. proud: eyes closed, confident smile, a small gold medal on a red ribbon just under the chin.
9. celebrating: eyes in happy arcs, big open smile, a small striped party hat between the ears, small colourful
   confetti (red, yellow, blue, green) around the head.
```

---

## Notes

- **Why a reference picture?** Words alone let Gemini pick a new head shape, eye style and body every time. With
  the picture attached to every message, it copies one cat.
- **Why magenta?** Image models can't output real transparency. A flat #FF00FF is easy to remove cleanly.
- **Sizes:** the slicer also evens out head sizes (it measures head width and lines up the head tops), so small
  differences are fixed automatically. Big differences in head shape or a body can't be fixed afterwards.
- **Eyes and wardrobe:** sheet 1 (normal, blinks, look directions, blank eyes) and sheets 5–6 (wardrobe) from
  `art/v2` are kept as they are.
