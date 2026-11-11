import Phaser from 'phaser';
import { SentenceWord, WordList } from './types';
import { SUFFIX_LISTS } from './suffixes';
import { THIS_WEEK } from './weekly';

export type SentenceMode = 'suffixes' | 'weekly';

/** A missed word is dealt again on the third word after it (two in between). */
const REVIEW_GAP = 3;

/**
 * Deals sentence words for the current building. Words are shuffled, and a
 * word that took more than one try is shown again a couple of words later.
 */
export class SentenceDeck {
  private mode: SentenceMode;
  private list: WordList | null = null;
  private queue: SentenceWord[] = [];
  private review: { entry: SentenceWord; wait: number }[] = [];
  private last: SentenceWord | null = null;
  /** Words that needed more than one try this game, for the end screen. */
  readonly missed = new Set<string>();

  constructor(mode: SentenceMode) {
    this.mode = mode;
  }

  /** The list used for a building. Suffixes go one rule per building, then mix. */
  listFor(buildingIndex: number): WordList {
    if (this.mode === 'weekly') return THIS_WEEK;
    if (buildingIndex < SUFFIX_LISTS.length) return SUFFIX_LISTS[buildingIndex];
    return {
      title: 'All the endings',
      words: SUFFIX_LISTS.flatMap((l) => l.words),
    };
  }

  /** Tip for a word, looked up from whichever suffix list it came from. */
  tipFor(entry: SentenceWord): string | undefined {
    if (this.list?.tip) return this.list.tip;
    return SUFFIX_LISTS.find((l) => l.words.includes(entry))?.tip;
  }

  next(buildingIndex: number): { entry: SentenceWord; list: WordList } {
    const list = this.listFor(buildingIndex);
    if (list.title !== this.list?.title) {
      this.list = list;
      this.queue = [];
    }

    for (const r of this.review) r.wait--;
    const dueIndex = this.review.findIndex((r) => r.wait <= 0 && r.entry !== this.last);

    let entry: SentenceWord;
    if (dueIndex >= 0) {
      entry = this.review.splice(dueIndex, 1)[0].entry;
    } else {
      if (this.queue.length === 0) this.refill(list);
      entry = this.queue.shift()!;
    }
    this.last = entry;
    return { entry, list };
  }

  /** Call when a word is finished, with how many wrong tries it took. */
  recordResult(entry: SentenceWord, wrongTries: number): void {
    if (wrongTries === 0) return;
    this.missed.add(entry.word);
    if (!this.review.some((r) => r.entry === entry)) {
      this.review.push({ entry, wait: REVIEW_GAP });
    }
  }

  private refill(list: WordList): void {
    const words = Phaser.Utils.Array.Shuffle([...list.words]);
    // Avoid the same word twice in a row across a reshuffle
    if (words.length > 1 && words[0] === this.last) words.push(words.shift()!);
    this.queue = words;
  }
}
