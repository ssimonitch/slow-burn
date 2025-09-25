import type { AudioPreloadCommand, AudioPreloadEvent } from './audio-preload.types';

export interface AudioPreloadWorkerHandle {
  readonly worker: Worker;
  postMessage:
    | ((message: AudioPreloadCommand) => void)
    | ((message: AudioPreloadCommand, transfer: Transferable[]) => void);
  addMessageListener(listener: (event: MessageEvent<AudioPreloadEvent>) => void): () => void;
  terminate(): void;
}

export function createAudioPreloadWorker(): AudioPreloadWorkerHandle {
  const worker = new Worker(new URL('./audio-preload.ts', import.meta.url), {
    type: 'module',
  });

  function postMessage(message: AudioPreloadCommand, transfer?: Transferable[]) {
    if (transfer && transfer.length > 0) {
      worker.postMessage(message, transfer);
    } else {
      worker.postMessage(message);
    }
  }

  function addMessageListener(listener: (event: MessageEvent<AudioPreloadEvent>) => void) {
    const wrapped = listener as EventListener;
    worker.addEventListener('message', wrapped);

    return () => worker.removeEventListener('message', wrapped);
  }

  return {
    worker,
    postMessage,
    addMessageListener,
    terminate() {
      worker.terminate();
    },
  };
}
