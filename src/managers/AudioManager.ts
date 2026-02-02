export class AudioManager {
  private synth: SpeechSynthesis;
  private available = true;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speakWord(word: string): Promise<void> {
    if (!this.available) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
          // If iOS blocks speech (no gesture / policy), disable gracefully
          if (e.error === 'not-allowed') {
            this.available = false;
          }
          resolve();
        };
        this.synth.speak(utterance);
      } catch {
        this.available = false;
        resolve();
      }
    });
  }

  cancel(): void {
    try { this.synth.cancel(); } catch { /* ignore */ }
  }
}
