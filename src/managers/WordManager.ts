import Phaser from 'phaser';

const WORD_LIST: string[] = [
  'cat',
  'dog',
  'sun',
  'map',
  'big',
  'hat',
  'run',
  'red',
  'top',
  'cup',
];

export class WordManager {
  private usedIndices: Set<number> = new Set();

  getNextWord(): string {
    if (this.usedIndices.size >= WORD_LIST.length) {
      this.usedIndices.clear();
    }

    let index: number;
    do {
      index = Phaser.Math.Between(0, WORD_LIST.length - 1);
    } while (this.usedIndices.has(index));

    this.usedIndices.add(index);
    return WORD_LIST[index];
  }

  reset(): void {
    this.usedIndices.clear();
  }
}
