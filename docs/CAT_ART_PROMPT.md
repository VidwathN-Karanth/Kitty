# Kitty artwork: the Gemini prompt

Paste everything inside the box below into Gemini (an image model such as Gemini 2.5 Flash Image). Ask it for **3 images**.
If it only gives one image per message, send the prompt, then reply "now sheet 2" and "now sheet 3".

Save the results as `sheet1.png`, `sheet2.png` and `sheet3.png`, then either send them to me, or run:

```
npx electron tools/slice-cat-sheets.js sheet1.png sheet2.png sheet3.png
```

That cuts out the 27 frames, removes the magenta background and the Gemini sparkle watermark, lines every head up on
the same spot (Gemini never keeps them perfectly still), and puts them in `src/assets/cat/`. Kitty switches to the
artwork automatically. The checker warns you if a cell is empty or the background isn't magenta.

The current sheets are kept in `art/`. Their "blink" and "look-down" frames came out wrong (a smile and a sad face),
so they are left out; Kitty then simply doesn't blink and keeps its normal face when the mouse is below it:

```
npx electron tools/slice-cat-sheets.js art/sheet1.webp art/sheet2.webp art/sheet3.webp --skip=blink,look-down
```

To fix those two later, ask Gemini for just a 1x2 image: "frame 23 blink" and "frame 27 look-down" from the prompt.

---

```
Create 3 sprite-sheet images for a desktop mascot called "Kitty". Same character in every frame; only the
expression changes. Read every rule before drawing.

CHARACTER (identical in all 27 frames)
- A cute, chubby cartoon CAT HEAD only (no body), front view, facing the viewer, head level (not tilted).
- Orange tabby fur (#F2A65A), slightly lighter on the forehead, with exactly three short darker stripes on the forehead (#D98A3C).
- Two pointed ears with light pink insides (#F7B6C2). A small fluffy tuft on each cheek.
- A cream-white muzzle area, a small rounded pink nose (#E0707F), and a small "w"-shaped mouth.
- Big glossy round eyes: white sclera, mint-green iris (#9BE37A) with a darker rim, black vertical pupil,
  one big and one small white highlight in each eye, a thin dark-brown eyeliner on the top of each eye.
- Three thin white whiskers on each side.
- Style: polished flat vector "sticker" illustration, soft cel shading, clean dark-brown outline (#6B3A2A) about
  1.5% of the frame width thick, smooth curves, kawaii, high quality, like a premium app mascot.
- Same proportions, colours, line weight and lighting in every frame.

CANVAS AND GRID (very important, a script will cut the image automatically)
- Each image is SQUARE, as large as possible (2048 x 2048 if you can, at least 1536 x 1536).
- Each image is a 3 x 3 grid of 9 equal square cells. No borders, no gaps, no lines, no labels, no numbers,
  no text anywhere.
- The ENTIRE background of every image is ONE flat solid pure magenta colour: #FF00FF (RGB 255, 0, 255).
  No gradient, no texture, no vignette, no floor, no drop shadow, no glow on the background.
- Never use magenta or purple on the character itself (hearts must be red, tears light blue).

POSITION INSIDE EVERY CELL (keep it exactly the same in all 27 cells)
- Head centred horizontally in the cell.
- Head width (cheek to cheek, not counting whiskers) = 66% of the cell width.
- Centre of the head at 58% of the cell height from the top. Ear tips at about 20% from the top. Chin at about 82%.
- Keep at least 8% empty magenta margin on every side. Extras (headphones, paw, tears, "z" letters, hearts,
  sparkles) must stay inside the cell and must not touch the neighbouring cell.

SHEET 1 (cells left to right, top to bottom)
1. normal: calm, friendly, eyes open looking straight at the viewer, small "w" mouth.
2. happy: eyes closed into happy upside-down "U" arcs, open smiling mouth with a little pink tongue, rosy cheeks.
3. love: eyes are two red hearts (#FF4F74), open smile, rosy cheeks, two tiny red hearts floating beside the head.
4. surprised: eyes wide open with small pupils, eyebrows raised, small round "o" mouth.
5. curious: eyes a bit bigger, one eyebrow raised, small "w" mouth, head NOT tilted.
6. focused: eyes slightly narrowed (upper lids lowered a little), flat determined eyebrows, small straight mouth.
7. wink: left eye open, right eye closed in a happy arc, open smile.
8. sad: droopy eyelids, eyebrows raised in the middle, small frown, one light-blue tear under the left eye.
9. dizzy: eyes are two dark "X" marks, wavy wobbly mouth, two small stars circling above the head.

SHEET 2
10. sleepy: heavy half-closed eyelids, relaxed small mouth.
11. asleep: eyes closed (downward curved lines), small mouth, two light-blue "z" letters floating at the upper right.
12. listening: wearing dark grey over-ear headphones (band over the head between the ears, round ear cups at the
    sides with a small mint-green light), eyes half closed and relaxed, small content smile, two small light-blue
    music notes floating beside the head.
13. angry: lowered angled eyebrows, narrowed eyes, frown, a small red anger mark at the upper right of the head.
14. excited: eyes are two golden yellow stars, big open smile with tongue, rosy cheeks, small yellow sparkles around.
15. crying: sad eyebrows, eyes squeezed and watery, wobbly mouth, two streams of light-blue tears.
16. laughing: eyes closed in happy arcs, very wide open laughing mouth with tongue, small tears of joy at the eye corners.
17. shy: strong pink blush on both cheeks, eyes looking down and to the side, tiny smile, eyebrows slightly worried.
18. smug: half-closed confident eyes, one eyebrow raised, lopsided smirk.

SHEET 3
19. scared: very wide eyes with tiny pupils, worried eyebrows, wavy mouth, a light-blue sweat drop at the upper right.
20. bored: half-closed flat eyelids, straight flat mouth.
21. yawning: eyes closed, mouth wide open in a big yawn.
22. wave: happy smile, eyes open, one small orange paw raised next to the right cheek, waving hello.
23. blink: exactly like frame 1 (normal) but with both eyes fully closed (simple curved lines). Everything else identical.
24. look-left: exactly like frame 1 but both pupils looking to the viewer's LEFT.
25. look-right: exactly like frame 1 but both pupils looking to the viewer's RIGHT.
26. look-up: exactly like frame 1 but both pupils looking UP.
27. look-down: exactly like frame 1 but both pupils looking DOWN.

Frames 1, 23, 24, 25, 26 and 27 must be pixel-for-pixel the same head; only the eyes change. They are swapped
quickly to make the cat blink and follow the mouse, so any difference in size or position will look like jitter.
```

---

## Notes

- **Why magenta?** Image models can't output real transparency. A flat #FF00FF is easy to remove cleanly, and it
  doesn't clash with an orange cat with green eyes.
- **Why a fixed position?** The frames are swapped in place, and hats and glasses are drawn on top using these
  numbers. If the head moves between cells, the cat jumps.
- **Other fur or eye colours:** the artwork has one look baked in, so the Wardrobe's fur and eye colours only change
  the drawn cat. For another colour, re-run the same prompt with the colour lines changed and keep both sets.
- **No artwork yet?** Kitty keeps using the drawn vector cat.
