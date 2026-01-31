export class AudioManager {
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speakWord(word: string): Promise<void> {
    return new Promise((resolve) => {
      // Cancel any in-progress speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synth.speak(utterance);
    });
  }

  cancel(): void {
    this.synth.cancel();
  }
}
