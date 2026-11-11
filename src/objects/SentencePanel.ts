import Phaser from 'phaser';
import { DPR, FONT_FAMILY, COLOR_STRINGS, COLORS } from '../config';
import { BLANK, SentenceWord } from '../words/types';

const WIDTH = 540;
const HEIGHT = 150;
const GAP = '______';

/**
 * Card above the input box that shows the sentence with a blank, the rule
 * being practiced, and a hint after a wrong try.
 */
export class SentencePanel {
  private scene: Phaser.Scene;
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private sentence: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private entry: SentenceWord | null = null;
  private listTitle = '';
  private peekTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, cx: number, cy: number) {
    this.scene = scene;
    const x = cx - WIDTH / 2;
    const y = cy - HEIGHT / 2;

    this.shadow = scene.add.graphics().setDepth(7);
    this.shadow.fillStyle(0x000000, 0.1);
    this.shadow.fillRoundedRect(x + 3, y + 5, WIDTH, HEIGHT, 18);

    // Plain card: a beveled panel this big looks heavy and eats text room
    this.bg = scene.add.graphics().setDepth(8);
    this.bg.fillStyle(0xffffff, 0.92);
    this.bg.fillRoundedRect(x, y, WIDTH, HEIGHT, 18);
    this.bg.lineStyle(2, COLORS.neutral, 0.25);
    this.bg.strokeRoundedRect(x + 1, y + 1, WIDTH - 2, HEIGHT - 2, 18);

    this.title = scene.add
      .text(cx, y + 22, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: COLOR_STRINGS.secondary,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.sentence = scene.add
      .text(cx, cy - 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        color: COLOR_STRINGS.primary,
        align: 'center',
        lineSpacing: 2,
        wordWrap: { width: WIDTH - 50 },
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.hint = scene.add
      .text(cx, y + HEIGHT - 24, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: COLOR_STRINGS.support,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.setVisible(false);
  }

  show(entry: SentenceWord, listTitle: string): void {
    this.cancelPeek();
    this.entry = entry;
    this.listTitle = listTitle;
    this.title.setText(listTitle).setColor(COLOR_STRINGS.secondary);
    this.hint.setText('');
    this.sentence.setText(entry.sentence.replace(BLANK, GAP));
    this.setVisible(true);

    this.sentence.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({
      targets: this.sentence,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /** After a wrong try: show how the word is built, plus the rule. */
  showHint(tip?: string): void {
    if (!this.entry) return;
    if (tip) this.title.setText(tip).setColor(COLOR_STRINGS.support);
    this.hint.setText(this.entry.parts ?? `starts with "${this.entry.word[0]}"`);
  }

  /** Briefly show the answer in the blank, then hide it again. */
  peek(durationMs: number): void {
    if (!this.entry) return;
    this.cancelPeek();
    this.sentence.setText(this.entry.sentence.replace(BLANK, this.entry.word));
    this.peekTimer = this.scene.time.delayedCall(durationMs, () => {
      this.peekTimer = null;
      if (this.entry) this.sentence.setText(this.entry.sentence.replace(BLANK, GAP));
    });
  }

  /** Correct answer: fill in the blank and clear the hint. */
  reveal(): void {
    if (!this.entry) return;
    this.cancelPeek();
    this.sentence.setText(this.entry.sentence.replace(BLANK, this.entry.word));
    this.title.setText(this.listTitle).setColor(COLOR_STRINGS.secondary);
    this.hint.setText('');
  }

  setVisible(visible: boolean): void {
    for (const obj of this.getHudObjects()) {
      (obj as Phaser.GameObjects.Graphics).setVisible(visible);
    }
  }

  getHudObjects(): Phaser.GameObjects.GameObject[] {
    return [this.shadow, this.bg, this.title, this.sentence, this.hint];
  }

  private cancelPeek(): void {
    this.peekTimer?.remove();
    this.peekTimer = null;
  }
}
