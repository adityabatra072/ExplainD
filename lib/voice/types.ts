/**
 * Voice transport abstraction. v1 ships WebSpeechTransport (browser STT,
 * push-to-talk). A realtime adapter (OpenAI Realtime, Gemini Live) can
 * implement the same interface later without touching the agent loop.
 */
export interface VoiceTransport {
  readonly available: boolean;
  startListening(onInterim: (text: string) => void): void;
  /** Resolves with the final transcript ("" if nothing was heard). */
  stopListening(): Promise<string>;
  cancel(): void;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/**
 * Chrome/Edge Web Speech API. Notes for users (documented in README):
 * audio is processed by the browser vendor's speech service; Firefox and
 * Safari don't support it — the UI falls back to text chat.
 */
export class WebSpeechTransport implements VoiceTransport {
  readonly available: boolean;
  private recognition: SpeechRecognitionLike | null = null;
  private finalText = "";
  private endResolve: ((text: string) => void) | null = null;

  constructor(lang = "en-US") {
    const Ctor =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;
    this.available = Boolean(Ctor);
    if (Ctor) {
      this.recognition = new Ctor();
      this.recognition.lang = lang;
      this.recognition.interimResults = true;
      this.recognition.continuous = true;
    }
  }

  startListening(onInterim: (text: string) => void): void {
    if (!this.recognition) return;
    this.finalText = "";
    this.recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) this.finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onInterim(this.finalText + interim);
    };
    this.recognition.onend = () => {
      this.endResolve?.(this.finalText.trim());
      this.endResolve = null;
    };
    this.recognition.onerror = () => {
      this.endResolve?.(this.finalText.trim());
      this.endResolve = null;
    };
    this.recognition.start();
  }

  stopListening(): Promise<string> {
    if (!this.recognition) return Promise.resolve("");
    return new Promise((resolve) => {
      this.endResolve = resolve;
      this.recognition!.stop();
      // Safety: some engines never fire onend.
      setTimeout(() => {
        this.endResolve?.(this.finalText.trim());
        this.endResolve = null;
      }, 3000);
    });
  }

  cancel(): void {
    this.recognition?.abort();
    this.endResolve = null;
  }
}
