# Sola's Spell Smash

A spelling practice game for first graders. See a word, hear it spoken aloud, then type it from memory to launch it as a physics projectile at a building made of blocks.

## How to Play

1. A word appears briefly on screen and is spoken aloud
2. Type the word from memory in the input box
3. Press **Enter** or **Space** to launch
4. Knock the building below the red threshold line to advance
5. Complete all 8 buildings to win

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

Pushes to `main` automatically deploy to GitHub Pages via the included workflow.
