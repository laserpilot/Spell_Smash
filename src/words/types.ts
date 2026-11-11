/**
 * A word to spell, given as a sentence with a blank.
 *
 * - `sentence` marks the missing word with `___`.
 * - `parts` is the hint shown after a wrong try: how the word is built
 *   ("hop + p + ing", "make − e + ing") or its syllables ("prob · a · bly").
 */
export interface SentenceWord {
  word: string;
  sentence: string;
  parts?: string;
}

export interface WordList {
  /** Short heading shown above the sentence, e.g. "Double the last letter". */
  title: string;
  /** One-line rule reminder shown with the hint after a wrong try. */
  tip?: string;
  words: SentenceWord[];
}

export const BLANK = '___';
