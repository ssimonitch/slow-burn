import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Suppress expected test warnings/errors globally
beforeAll(() => {
  const originalWarn = console.warn;
  const originalError = console.error;

  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');

    // Suppress WebAudioVoiceDriver background loading warnings
    // These occur because async Stage 2/3 loading happens after test assertions complete
    // and Node.js fetch can't handle relative URLs in test environment
    if (message.includes('[WebAudioVoiceDriver] Failed to decode')) {
      return;
    }

    // Allow all other warnings through
    originalWarn.apply(console, args);
  });

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');

    // Suppress intentional prime failure test error
    // This occurs in the "reports blocked if AudioContext fails" test
    // which deliberately causes AudioContext.resume() to throw
    if (message.includes('[WebAudioVoiceDriver] Prime failed:')) {
      return;
    }

    // Allow all other errors through
    originalError.apply(console, args);
  });
});

afterEach(() => {
  cleanup();
});
