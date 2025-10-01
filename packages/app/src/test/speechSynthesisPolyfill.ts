/**
 * Test utility for polyfilling the Web Speech API (SpeechSynthesis) in tests.
 *
 * This provides fake implementations that allow tests to control timing and verify behavior
 * without depending on browser speech synthesis.
 *
 * Usage:
 * ```typescript
 * beforeEach(() => {
 *   installSpeechSynthesisPolyfill({ autoComplete: true });
 * });
 *
 * afterEach(() => {
 *   restoreSpeechSynthesis();
 * });
 * ```
 */

interface SpeechSynthesisGlobal {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

export class FakeSpeechSynthesisUtterance implements SpeechSynthesisUtterance {
  public text: string;
  public volume = 1;
  public rate = 1;
  public pitch = 1;
  public lang = 'en-US';
  public voice: SpeechSynthesisVoice | null = null;
  public onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
  public onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
  public onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => unknown) | null = null;
  public onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
  public onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
  public onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
  public onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;

  constructor(text: string) {
    this.text = text;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

export interface FakeSpeechSynthesisOptions {
  /**
   * If true, automatically call onend after a brief timeout when speak() is called.
   * If false, tests must manually control completion timing.
   * Default: false
   */
  autoComplete?: boolean;
  /**
   * Delay in milliseconds before auto-completing (only used when autoComplete is true).
   * Default: 10
   */
  autoCompleteDelay?: number;
}

export class FakeSpeechSynthesis implements SpeechSynthesis {
  public speaking = false;
  public paused = false;
  public pending = false;
  public onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => unknown) | null = null;

  private current: FakeSpeechSynthesisUtterance | null = null;
  private autoComplete: boolean;
  private autoCompleteDelay: number;

  constructor(options: FakeSpeechSynthesisOptions = {}) {
    this.autoComplete = options.autoComplete ?? false;
    this.autoCompleteDelay = options.autoCompleteDelay ?? 10;
  }

  speak(utterance: SpeechSynthesisUtterance): void {
    this.speaking = true;
    this.current = utterance as FakeSpeechSynthesisUtterance;

    // Call onstart synchronously
    if (this.current.onstart) {
      this.current.onstart.call(this.current, {} as SpeechSynthesisEvent);
    }

    // Auto-complete if configured
    if (this.autoComplete) {
      setTimeout(() => {
        this.speaking = false;
        if (this.current?.onend) {
          this.current.onend.call(this.current, {} as SpeechSynthesisEvent);
        }
        this.current = null;
      }, this.autoCompleteDelay);
    }
  }

  cancel(): void {
    const utterance = this.current;
    this.current = null;
    this.speaking = false;

    if (utterance?.onend) {
      utterance.onend.call(utterance, {} as SpeechSynthesisEvent);
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return [
      {
        default: true,
        lang: 'en-US',
        localService: true,
        name: 'en-US',
        voiceURI: 'en-US',
      } as SpeechSynthesisVoice,
    ];
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }

  /**
   * Test helper: manually complete the current utterance
   * (useful when autoComplete is false)
   */
  completeCurrentUtterance(): void {
    const utterance = this.current;
    if (utterance && this.speaking) {
      this.speaking = false;
      this.current = null;
      if (utterance.onend) {
        utterance.onend.call(utterance, {} as SpeechSynthesisEvent);
      }
    }
  }
}

let originalSpeechSynthesis: SpeechSynthesis | undefined;
let originalSpeechSynthesisUtterance: typeof SpeechSynthesisUtterance | undefined;

/**
 * Install fake speech synthesis polyfill for testing.
 * Call this in beforeEach, and call restoreSpeechSynthesis() in afterEach.
 */
export function installSpeechSynthesisPolyfill(options: FakeSpeechSynthesisOptions = {}): FakeSpeechSynthesis {
  const global = globalThis as unknown as SpeechSynthesisGlobal;

  // Save originals if they exist
  originalSpeechSynthesis = global.speechSynthesis;
  originalSpeechSynthesisUtterance = global.SpeechSynthesisUtterance;

  // Install fakes
  const fakeSynthesis = new FakeSpeechSynthesis(options);
  global.speechSynthesis = fakeSynthesis as SpeechSynthesis;
  global.SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance as unknown as typeof SpeechSynthesisUtterance;

  return fakeSynthesis;
}

/**
 * Restore original speech synthesis (or remove if not present).
 * Call this in afterEach after calling installSpeechSynthesisPolyfill.
 */
export function restoreSpeechSynthesis(): void {
  const global = globalThis as unknown as SpeechSynthesisGlobal;

  if (originalSpeechSynthesis !== undefined) {
    global.speechSynthesis = originalSpeechSynthesis;
  } else {
    delete global.speechSynthesis;
  }

  if (originalSpeechSynthesisUtterance !== undefined) {
    global.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
  } else {
    delete global.SpeechSynthesisUtterance;
  }

  originalSpeechSynthesis = undefined;
  originalSpeechSynthesisUtterance = undefined;
}
