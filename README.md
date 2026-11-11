# Sola's Spell Smash

**▶ Play it here: [laserpilot.github.io/Spell_Smash](https://laserpilot.github.io/Spell_Smash/)**

A spelling practice game for early elementary kids. See a word, hear it spoken aloud, then type it from memory to launch it as a physics projectile at a building made of blocks.

## How to Play

1. A word appears briefly on screen and is spoken aloud
2. Type the word from memory in the input box
3. Press **Enter** or **Space** to launch
4. Knock the building below the red threshold line to advance
5. Complete all 8 buildings to win

## Word Modes

- **Short / Medium / Long / Hard / Silly** — the word is shown briefly and spoken.
- **Suffixes** — fill-in-the-blank sentences, one spelling rule per building:
  add -s/-ed/-ing → add -es → double the last letter → drop the silent e →
  change y to i → -er/-est → -ful/-less/-ly. Lists are in `src/words/suffixes.ts`.
- **This Week** — this week's school words, also as sentences. Edit
  `src/words/weekly.ts` each week (each sentence needs one `___`).

In the sentence modes the word is never flashed. A wrong try shows how the word
is built (`hop + p + ing`, `prob · a · bly`); a second wrong try shows the answer
for a moment. Missed words come back a couple of words later and are listed on
the end screen under **Practice**.

**Tips:**
- Click **Hear Again** to replay the word
- Get 3+ correct in a row for a streak bonus (super projectile)
- First letter hint appears after a wrong attempt

## Tech Stack

- **Phaser 3.80** with Matter.js physics
- **TypeScript** + **Vite**
- Web Speech API for text-to-speech

## Development

```bash
npm install
npm run dev     # http://localhost:8080
npm run build   # production build in dist/
```

## Deployment

Pushes to `main` automatically deploy to [GitHub Pages](https://laserpilot.github.io/Spell_Smash/) via the included workflow.
