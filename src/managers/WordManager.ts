import Phaser from 'phaser';
import { runtimeConfig } from '../RuntimeConfig';

const WORD_TIERS: Record<number, string[]> = {
  // Tier 1: 3-letter CVC words
  1: [
    'cat', 'dog', 'sun', 'map', 'big', 'hat', 'run', 'red', 'top', 'cup',
    'bus', 'bat', 'bed', 'box', 'bug', 'can', 'car', 'dig', 'dot', 'fan',
    'fin', 'fox', 'fun', 'got', 'gum', 'hen', 'hid', 'him', 'hip', 'hit',
    'hop', 'hot', 'hug', 'jam', 'jet', 'job', 'jug', 'kit', 'leg', 'let',
    'lid', 'lip', 'log', 'lot', 'mad', 'man', 'mat', 'men', 'mix', 'mom',
    'mop', 'mud', 'mug', 'net', 'nod', 'not', 'nut', 'pad', 'pan', 'pat',
    'peg', 'pen', 'pet', 'pig', 'pin', 'pit', 'pod', 'pop', 'pot', 'pup',
    'rag', 'ram', 'ran', 'rat', 'rib', 'rid', 'rim', 'rip', 'rob', 'rod',
    'rug', 'sad', 'sat', 'set', 'sit', 'six', 'sob', 'tag', 'tan', 'tap',
    'ten', 'tin', 'tip', 'tub', 'tug', 'van', 'vet', 'web', 'wet', 'win',
  ],
  // Tier 2: 3-4 letter sight words (Dolch Pre-Primer/Primer)
  2: [
    'the', 'and', 'was', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'had', 'her', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did',
    'oil', 'she', 'two', 'use', 'boy', 'eat', 'say', 'too', 'any', 'ask',
    'own', 'put', 'ran', 'let', 'end', 'far', 'got', 'hot', 'man', 'ran',
    'sit', 'try', 'why', 'big', 'did', 'get', 'has', 'him', 'his', 'how',
    'came', 'come', 'does', 'done', 'down', 'find', 'from', 'give', 'goes',
    'good', 'have', 'help', 'here', 'into', 'just', 'know', 'like', 'live',
    'look', 'made', 'make', 'many', 'much', 'must', 'name', 'only', 'over',
    'play', 'said', 'some', 'stop', 'take', 'tell', 'than', 'that', 'them',
  ],
  // Tier 3: 4-letter phonetic words
  3: [
    'ship', 'jump', 'frog', 'clap', 'drum', 'flag', 'glad', 'grab', 'grip',
    'plan', 'plum', 'skip', 'slam', 'slip', 'snap', 'snip', 'spin', 'spot',
    'stem', 'step', 'stop', 'strap', 'swim', 'trap', 'trim', 'trip', 'trot',
    'band', 'bend', 'best', 'bump', 'camp', 'cast', 'chip', 'chop', 'clam',
    'clip', 'club', 'coat', 'cold', 'cost', 'crop', 'desk', 'dish', 'dock',
    'drop', 'dump', 'dust', 'fact', 'fast', 'felt', 'fill', 'film', 'fish',
    'fist', 'flat', 'flip', 'glow', 'gold', 'golf', 'gust', 'hand', 'hang',
    'held', 'help', 'hill', 'hint', 'hold', 'hunt', 'kept', 'kick', 'kind',
    'king', 'knot', 'lamp', 'land', 'last', 'left', 'lend', 'lift', 'limp',
    'list', 'lock', 'long', 'lost', 'luck', 'lump', 'mask', 'melt', 'milk',
  ],
  // Tier 4: 4-5 letter sight words (Dolch First Grade)
  4: [
    'after', 'again', 'could', 'every', 'first', 'found', 'going', 'house',
    'large', 'learn', 'never', 'other', 'place', 'plant', 'point', 'right',
    'round', 'shall', 'show', 'small', 'sound', 'still', 'story', 'study',
    'their', 'there', 'these', 'thing', 'think', 'those', 'three', 'under',
    'until', 'water', 'where', 'which', 'while', 'world', 'would', 'write',
    'about', 'above', 'along', 'began', 'begin', 'being', 'below', 'black',
    'bring', 'brown', 'build', 'carry', 'clean', 'close', 'color', 'cover',
    'cross', 'early', 'earth', 'eight', 'enjoy', 'equal', 'front', 'green',
    'happy', 'heard', 'heavy', 'horse', 'human', 'known', 'later', 'laugh',
    'light', 'money', 'month', 'mouth', 'music', 'night', 'north', 'often',
  ],
  // Tier 5: 5-letter words, mixed
  5: [
    'plant', 'drink', 'these', 'whale', 'brave', 'chase', 'climb', 'cloud',
    'crane', 'dream', 'feast', 'flame', 'float', 'floor', 'force', 'frame',
    'fresh', 'globe', 'grace', 'grain', 'grand', 'grape', 'grass', 'great',
    'heart', 'horse', 'house', 'judge', 'knife', 'lemon', 'light', 'lucky',
    'magic', 'maple', 'march', 'match', 'mouse', 'ocean', 'paint', 'paper',
    'peach', 'pilot', 'pizza', 'plane', 'price', 'pride', 'prize', 'proud',
    'queen', 'quick', 'quiet', 'quote', 'river', 'royal', 'scale', 'scene',
    'shape', 'share', 'shine', 'shirt', 'shore', 'skate', 'sleep', 'slide',
    'smile', 'smoke', 'snake', 'space', 'spice', 'spoke', 'stamp', 'stand',
    'steam', 'stone', 'store', 'storm', 'stove', 'sugar', 'table', 'teeth',
  ],
};

export class WordManager {
  private usedWords: Set<string> = new Set();

  getNextWord(difficulty: number): string {
    const pool = this.getPoolForDifficulty(difficulty);

    // Filter out recently used
    let available = pool.filter((w) => !this.usedWords.has(w));
    if (available.length === 0) {
      this.usedWords.clear();
      available = pool;
    }

    const word = available[Phaser.Math.Between(0, available.length - 1)];
    this.usedWords.add(word);
    return word;
  }

  private getPoolForDifficulty(difficulty: number): string[] {
    // Combine tiers based on difficulty level
    const pool: string[] = [];
    for (let tier = 1; tier <= 5; tier++) {
      if (tier <= difficulty) {
        pool.push(...WORD_TIERS[tier]);
      }
    }
    return pool.length > 0 ? pool : WORD_TIERS[1];
  }

  getDifficultyForBuilding(buildingIndex: number): number {
    const { difficultyMin, difficultyMax, sessionLength } = runtimeConfig;
    if (sessionLength <= 1) return difficultyMin;
    const progress = Math.min(1, buildingIndex / (sessionLength - 1));
    return Math.round(difficultyMin + (difficultyMax - difficultyMin) * progress);
  }

  reset(): void {
    this.usedWords.clear();
  }
}
