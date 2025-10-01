export type DevVoiceCue = { type: 'say_number'; value: number } | { type: 'milestone'; value: number };

export interface VoiceDriver {
  prime(): Promise<void>;
  handle(cue: DevVoiceCue): void;
  mute(): void;
  unmute(): void;
  setVolume(v: number): void;
  setRate(r: number): void;
  stopAll(): void;
  dispose(): void;
  isSpeaking(): boolean;
  isPrimed(): boolean;
  isBlocked(): boolean;
  getLastSpoken(): string | null;
}

export class DevSpeechSynthesisVoiceDriver implements VoiceDriver {
  private synth: SpeechSynthesis | null;
  private speaking = false;
  private primed = false;
  private blocked = false;
  private muted = false;
  private volume = 1;
  private rate = 1;
  private lastSpoken: string | null = null;

  constructor() {
    this.synth =
      typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis ? globalThis.speechSynthesis : null;
    if (!this.synth) {
      this.blocked = true;
    }
  }

  /**
   * Prime the speech synthesis engine.
   *
   * IMPORTANT: Safari and iOS require this to be called from a user gesture
   * (e.g., button click) to unlock audio playback. Call this early in the
   * user flow, ideally on first interaction with the app.
   */
  async prime(): Promise<void> {
    if (!this.synth) {
      this.blocked = true;
      return;
    }

    try {
      // Force voice list population on some browsers
      void this.synth.getVoices();

      // Play a near-silent utterance to unlock on Safari/iOS after user gesture
      const u = new SpeechSynthesisUtterance('.');
      u.volume = 0; // silent prime
      u.rate = 1.0;
      u.pitch = 1.0;

      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (!this.primed) this.primed = true;
          resolve();
        }, 1000);

        u.onend = () => {
          this.primed = true;
          clearTimeout(timeoutId);
          resolve();
        };

        try {
          this.synth?.cancel();
          this.synth?.speak(u);
        } catch {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    } catch {
      this.blocked = true;
    }
  }

  handle(cue: DevVoiceCue): void {
    if (!this.synth) {
      this.blocked = true;
      return;
    }

    // Drop-latest policy for numbers if already speaking
    if (cue.type === 'say_number' && this.speaking) {
      return;
    }

    // Milestones may preempt current number
    if (cue.type === 'milestone' && this.speaking) {
      this.stopAll();
    }

    const text = this.resolveText(cue);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = this.rate;
    u.pitch = 1.0;
    u.volume = this.muted ? 0 : this.volume;
    u.voice = pickEnVoice(this.synth);
    u.onstart = () => {
      this.speaking = true;
    };
    u.onend = () => {
      this.speaking = false;
      this.lastSpoken = text;
    };
    try {
      this.synth.speak(u);
    } catch {
      // swallow
    }
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setRate(r: number): void {
    this.rate = Math.max(0.1, Math.min(10, r));
  }

  stopAll(): void {
    try {
      if (this.synth) this.synth.cancel();
      this.speaking = false;
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.stopAll();
    this.synth = null;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isPrimed(): boolean {
    return this.primed;
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  getLastSpoken(): string | null {
    return this.lastSpoken;
  }

  private resolveText(cue: DevVoiceCue): string {
    switch (cue.type) {
      case 'say_number':
        return String(cue.value);
      case 'milestone':
        return String(cue.value);
      default:
        return '';
    }
  }
}

function pickEnVoice(synth: SpeechSynthesis | null): SpeechSynthesisVoice | null {
  if (!synth) return null;
  const voices = synth.getVoices?.() ?? [];
  const enPref = voices.find((v) => /en[-_]?US/i.test(v.lang));
  return enPref ?? voices[0] ?? null;
}

export default DevSpeechSynthesisVoiceDriver;
