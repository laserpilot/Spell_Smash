# Word Wreckers: Technical Design Document

## Overview

A spelling practice game for first graders where typing words correctly launches them as physics-based projectiles at buildings. The core loop: see a word briefly, type it from memory, watch it smash into a structure and break apart satisfyingly.

### Target Audience
- Primary: 6-7 year olds (first grade)
- Secondary: Parents/caregivers who want a low-pressure spelling practice tool

### Design Pillars
1. **No time pressure** - Success comes from accuracy, not speed
2. **Always satisfying** - Every correct word produces fun destruction
3. **Gentle difficulty curve** - Early wins, gradual challenge increase
4. **Physicality** - Words and buildings feel like real objects with weight and momentum

---

## Tech Stack

- **Engine**: Phaser 3 (latest stable)
- **Physics**: Matter.js (via Phaser's built-in integration)
- **Text-to-Speech**: Web Speech API
- **Target Resolution**: 1280x720 (16:9 landscape)
- **Scaling**: Phaser Scale Manager, FIT mode with letterboxing
- **Platform**: Browser (desktop and mobile/tablet, landscape orientation)

---

## Core Game Loop

### Sequence
1. Building appears on right side of screen
2. Word appears on left side, audio plays pronunciation (Web Speech API)
3. Word displays for ~2 seconds, then disappears (default: dual cue with audio + flash)
4. Player types word from memory in input area
5. Player hits spacebar/enter (or "Fire" button on touch)
6. If correct: word assembles as physics body and launches horizontally at building
7. On impact: word breaks into individual letter bodies that scatter with physics
8. Building blocks react to impact, potentially collapsing
9. Repeat until building height is below threshold
10. Victory moment, rubble settles, everything slides left
11. New (taller) building appears, continue

### Failure Handling
- No lives or failure state
- Incorrect words simply don't fire (gentle feedback, try again)
- Player can see the word again by tapping a "hear it again" button (replays audio and briefly re-flashes word)
- After a wrong submit, optionally show a subtle first-letter hint (ghosted) on the next attempt

---

## Architecture

### Scene Structure
```
BootScene        → Asset loading, setup
MainMenuScene    → Title, play button (minimal for MVP)
GameScene        → Core gameplay
```

Future scenes (not in MVP):
- LevelSelectScene
- RecordingBoothScene (for custom audio)
- SettingsScene

### Core Classes/Modules

#### WordManager
- Holds word lists organized by difficulty tier
- Selects next word based on current difficulty level
- Tracks recently used words to avoid repetition
- API:
  - `getNextWord(difficulty: number): string`
  - `getDifficultyForBuilding(buildingIndex: number): number`

#### WordProjectile
- Creates physics body from word string
- Each letter is a separate rectangular Matter body
- Letters are connected with constraints (break on impact)
- Handles launch velocity and trajectory
- API:
  - `create(word: string, startPosition: {x, y}): Phaser.GameObjects.Container`
  - `launch(velocity: {x, y})`
  - `shatter()` - breaks constraints, letters scatter

#### Building
- Procedurally generates a building from blocks
- Configurable height, width, block arrangement
- Calculates current height for win condition
- API:
  - `generate(config: BuildingConfig): void`
  - `getCurrentHeight(): number`
  - `isDestroyed(threshold: number): boolean`

#### BuildingGenerator
- Creates varied building configurations
- Scales difficulty based on progression
- API:
  - `createConfig(buildingIndex: number): BuildingConfig`

#### InputManager
- Handles keyboard input for typing
- Manages touch keyboard considerations
- Tracks current typed string
- Fires events: `onType`, `onBackspace`, `onSubmit`
- Optional hint mode: insert ghosted first letter after wrong submit

#### AudioManager
- Wraps Web Speech API for pronunciation
- Manages sound effect playback
- Placeholder system for custom recorded audio
- API:
  - `speakWord(word: string): Promise<void>`
  - `playEffect(effectName: string): void`
  - `setCustomSound(effectName: string, audioBuffer: AudioBuffer): void`

#### GameState
- Tracks current building index
- Tracks score/words completed
- Manages power-up state (streak counter, active bonuses)

---

## Word Lists

### Structure
```javascript
const wordLists = {
  tier1: [], // 3-letter CVC words (cat, dog, sun, map, big)
  tier2: [], // 3-4 letter sight words (the, and, was, come)
  tier3: [], // 4-letter phonetic words (ship, jump, frog)
  tier4: [], // 4-5 letter sight words (there, where, could)
  tier5: [], // 5-letter words, mixed (plant, drink, these)
};
```

### Sources
- Dolch Pre-Primer, Primer, and First Grade lists
- Fry First 100
- Supplemental CVC words for phonetic regularity
- Optional: a small set of concrete-noun words with matching icons for tier1-2 picture cues

### Difficulty Mapping
- Building 1: tier1 only
- Building 2-3: tier1 + tier2
- Building 4-5: tier2 + tier3
- Building 6+: tier3 + tier4 + tier5

---

## Building Generation

### Block Types (MVP)
Single block type with uniform physics properties. Visual distinction only through color variation.

### Block Types (Future)
Leave architecture open for:
- Heavy blocks (need longer words or multiple hits)
- Fragile blocks (shatter on any impact, chain reactions)
- Structural blocks (load-bearing, collapse triggers)

### Building Shapes (MVP)
Procedural generation with these patterns:
1. **Simple stack**: Blocks directly on top of each other (easiest)
2. **Pyramid**: Wide base, narrows toward top
3. **Tower**: Narrow, tall (less stable)
4. **Offset stack**: Blocks offset horizontally (interesting collapse)

### Generation Parameters
```typescript
interface BuildingConfig {
  totalBlocks: number;       // scales with building index
  maxWidth: number;          // blocks wide at base
  pattern: 'stack' | 'pyramid' | 'tower' | 'offset';
  blockSize: { width: number, height: number };
  stabilityFactor: number;   // affects friction, density
}
```

### Progression
| Building | Words to Destroy | Pattern Pool           | Block Count |
|----------|------------------|------------------------|-------------|
| 1        | 1-2              | simple stack           | 3-5         |
| 2        | 2-3              | simple stack, pyramid  | 5-8         |
| 3        | 3-4              | pyramid, tower         | 8-12        |
| 4        | 4-5              | tower, offset          | 12-16       |
| 5+       | 5+               | all patterns           | 16+         |

---

## Physics Configuration

### Matter.js Settings
```javascript
const physicsConfig = {
  gravity: { x: 0, y: 1 },
  // Tune these during development:
  wordDensity: 0.8,
  blockDensity: 1.0,
  blockFriction: 0.6,
  restitution: 0.3,  // bounciness
  launchVelocity: { x: 15, y: -2 }, // base velocity, adjust for feel
};
```

### Collision Categories
- Word projectiles
- Building blocks
- Ground/boundaries
- Rubble (settled pieces that don't affect win condition)

### Performance Considerations
- Set bodies to static or sleeping when settled
- Remove off-screen bodies
- Limit maximum active bodies (~100)

---

## Power-Up System

### Accuracy Bonus
- **Trigger**: Type word correctly with zero backspaces
- **Effect**: Projectile is "on fire" - larger visual, 1.5x impact force
- **Visual**: Flame particle effect on projectile

### Streak Bonus
- **Trigger**: 3 consecutive words with no errors (no backspaces across all 3)
- **Effect**: Next projectile gets "super" status - explosive impact, screen shake
- **Reset**: Any backspace resets streak counter to 0
- **Visual**: Streak counter visible on screen, glows as it builds

### Power-Up Words (Future)
- Occasionally a word appears with a star/glow
- Successfully typing it grants a one-time special:
  - **Bomb**: Explosive radius on impact
  - **Multi-shot**: Word splits into 3 projectiles
  - **Heavy**: Extra dense, plows through
- Not in MVP, but leave GameState structure open for `activePowerUp`

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Streak: 2]                              [Building 3]       │
│                                                             │
│                                                             │
│                                            ┌───┐            │
│                                          ┌─┴───┴─┐          │
│   ┌─────────────┐                      ┌─┴───────┴─┐        │
│   │   "frog"    │ ─────────────────►   │  BUILDING │        │
│   └─────────────┘                      │   BLOCKS  │        │
│        ▲                               └───────────┘        │
│        │ (launches here)                                    │
│   ┌─────────────────────────┐          ═══════════════      │
│   │  f r o g _              │             (ground)          │
│   └─────────────────────────┘                               │
│   [🔊 Hear Again] [🅰 Show Word]   [FIRE button for touch]  │
└─────────────────────────────────────────────────────────────┘
```

### Elements
- **Word display area**: Shows target word during flash period, empty otherwise
- **Optional picture cue**: Small icon for tier1-2 concrete nouns (off by default)
- **Input field**: Shows typed letters, cursor
- **Fire button**: For touch devices (spacebar/enter on keyboard)
- **Hear Again button**: Replays word audio and briefly re-flashes word
- **Show Word toggle**: Parent-facing setting for audio-only vs audio+flash (default on)
- **Streak counter**: Shows current streak (0-3+)
- **Building counter**: Current building number
- **Ground line**: Visual base, physics boundary

---

## Art Direction

### Style
- **Look**: "Calm construction" — bold toy-blocks in flat vector shapes
- **Depth**: Subtle 2-tone fills (top lighter, bottom darker) + a single soft shadow direction
- **Texture**: Light grain/noise overlay at low opacity to reduce flatness
- **Spacing**: 8px grid for UI alignment and consistent object spacing
- **Type**: Rounded friendly sans (e.g., Fredoka, Nunito, Baloo 2)

### Palette (Calm Construction)
- **Background**: Pale sky `#EAF4FF`
- **Primary**: Navy `#2B3A67`
- **Secondary**: Mint `#64C4B8`
- **Support**: Clay `#D8836C`
- **Neutral**: Slate `#556070`

### Usage Notes
- Keep saturation medium; avoid neon and full rainbow mixes
- Limit active hues on screen to 3 at a time (plus neutrals)
- Letters: high contrast (navy on light, or white on navy) with a thin outline

---

## Audio

### Web Speech API Usage
```javascript
function speakWord(word) {
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.85;  // slightly slow for clarity
  utterance.pitch = 1.0;
  // Optionally select a specific voice
  speechSynthesis.speak(utterance);
}
```

### Sound Effects (Placeholder)
Define these as named effects, play placeholder sounds initially:
- `type_letter` - soft click on each keystroke
- `word_launch` - whoosh
- `impact_small` - thud for normal hits
- `impact_big` - boom for power-up hits
- `block_break` - crumble/crack
- `building_collapse` - rumble for major collapses
- `victory` - level complete jingle
- `error` - gentle "try again" for incorrect submission

### Custom Audio System (Future)
```javascript
// Structure for parent/kid recorded sounds
const customSounds = {
  word_launch: [AudioBuffer, AudioBuffer, ...],  // multiple variations
  impact_small: [AudioBuffer, ...],
  // etc.
};

function playEffect(name) {
  const variations = customSounds[name] || defaultSounds[name];
  const sound = Phaser.Utils.Array.GetRandom(variations);
  // play sound
}
```

---

## Mobile/Touch Considerations

### Input
- Show on-screen keyboard for typing (browser default)
- Large "FIRE" button positioned for thumb access
- "Hear Again" button easily tappable
- Optional "Show Word" toggle in a parent/settings drawer (off by default for kids)

### Orientation
- Primary: Landscape
- On portrait mobile: Show "Please rotate your device" message with icon
- Use Phaser's orientation detection

### Touch-Specific Adjustments
- Larger UI elements
- No hover states required
- Ensure input field focuses properly to trigger keyboard

---

## Development Phases

### Phase 1: Core Loop (MVP)
1. Phaser project setup with Matter.js physics
2. Basic scene structure (Boot, Menu, Game)
3. Ground plane and physics world
4. Single hardcoded building (stack of blocks)
5. Word display and input system (no audio yet)
6. Word projectile creation and launch
7. Collision detection, word shattering on impact
8. Building height check, "level complete" state
9. Transition to next building (hardcoded sequence)

**Exit criteria**: Can type words, launch them, knock down buildings, progress

### Phase 2: Content & Polish
1. Web Speech API integration
2. Word list implementation with difficulty tiers
3. Building generator with multiple patterns
4. Difficulty progression curve
5. Basic UI (streak counter, building number)
6. Hear Again + brief re-flash behavior
7. Optional first-letter hint after wrong submit
8. Rubble accumulation on left side
9. Screen transitions and slide-over effect

**Exit criteria**: Full gameplay loop with variety and progression

### Phase 3: Power-Ups & Feedback
1. Accuracy bonus (fire effect)
2. Streak system with visual feedback
3. Placeholder sound effects
4. Screen shake on big impacts
5. Particle effects (dust, debris)
6. Victory celebration per building

**Exit criteria**: Game feels satisfying and rewarding

### Phase 4: Platform Polish
1. Responsive scaling (Phaser Scale Manager)
2. Mobile touch controls and Fire button
3. Orientation handling
4. Performance optimization
5. Touch input field focus handling

**Exit criteria**: Playable on phone, tablet, and desktop

### Phase 5: Future Features (Not in Initial Scope)
- Custom audio recording booth
- Level select / building select
- Progress saving (localStorage)
- Power-up words (bomb, multi-shot)
- Block material types
- Themed building sets
- Parent dashboard / word list customization

---

## Asset Requirements

### Graphics (MVP - Primitive Shapes)
- Rectangle blocks (various colors)
- Letter sprites (or system font rendering)
- Ground texture (simple)
- Background (gradient or solid)
- Fire/glow effect (particle or sprite)
- UI buttons

### Graphics (Future)
- Themed block textures (brick, wood, stone)
- Building decoration sprites
- Character/mascot (optional)
- Particle sprite sheets

### Audio (MVP)
- Use Web Speech API for words
- Source royalty-free SFX for placeholder effects
- Or generate simple synth sounds

---

## Technical Notes

### Phaser 3 + Matter.js Setup
```javascript
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      debug: true, // disable in production
    },
  },
  scene: [BootScene, MainMenuScene, GameScene],
};
```

### Word as Physics Body
```javascript
// Conceptual approach
function createWordProjectile(word, x, y) {
  const letters = word.split('');
  const bodies = letters.map((letter, i) => {
    const body = this.matter.add.rectangle(
      x + i * letterWidth, y,
      letterWidth, letterHeight,
      { label: 'letter', friction: 0.5 }
    );
    // Add text object linked to body
    return body;
  });
  
  // Connect letters with constraints
  for (let i = 0; i < bodies.length - 1; i++) {
    this.matter.add.constraint(bodies[i], bodies[i + 1], {
      stiffness: 0.9,
      length: letterWidth,
    });
  }
  
  return { bodies, constraints };
}

function shatterWord(wordProjectile) {
  // Remove all constraints, letters fly free
  wordProjectile.constraints.forEach(c => {
    this.matter.world.removeConstraint(c);
  });
}
```

### Height Threshold Check
```javascript
function checkBuildingDestroyed(blocks, threshold) {
  const highestPoint = Math.min(...blocks.map(b => b.position.y));
  const groundY = 650; // adjust based on layout
  const currentHeight = groundY - highestPoint;
  return currentHeight < threshold;
}
```

---

## Open Questions / Decisions for Implementation

1. **Flash duration**: Start with 2 seconds, may need tuning
2. **Launch velocity**: Needs playtesting to feel right
3. **Height threshold**: What percentage of original height = "destroyed"?
4. **Streak length**: 3 feels right, but test with actual first grader
5. **Error feedback**: How to indicate wrong word without being discouraging?
6. **Re-showing word**: Default to audio + brief re-flash; allow parent toggle for audio-only
7. **Hinting**: Is first-letter ghost hint on wrong submit enough, or should it be opt-in?

---

## Success Metrics (Qualitative)

- Kid wants to keep playing
- No frustration from difficulty spikes
- Spelling words correctly feels empowering
- Destruction physics are satisfying to watch
- Parent can leave kid to play independently

---

## Summary

Word Wreckers is a low-pressure spelling game where accuracy is rewarded but mistakes aren't punished. The physics-based destruction provides intrinsic satisfaction, and the gentle difficulty curve keeps first graders engaged without overwhelming them. Built on Phaser 3 for extensibility, with clear phases for incremental development.
