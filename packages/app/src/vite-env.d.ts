/// <reference types="vitest" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VOICE_DEV_TTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
