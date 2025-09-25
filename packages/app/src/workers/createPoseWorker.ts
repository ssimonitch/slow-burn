import type { PoseWorkerCommand, PoseWorkerEvent } from './pose.types';

export interface PoseWorkerHandle {
  readonly worker: Worker;
  postMessage:
    | ((message: PoseWorkerCommand) => void)
    | ((message: PoseWorkerCommand, transfer: Transferable[]) => void);
  addMessageListener(listener: (event: MessageEvent<PoseWorkerEvent>) => void): () => void;
  terminate(): void;
}

export function createPoseWorker(): PoseWorkerHandle {
  const worker = new Worker(new URL('./pose.ts', import.meta.url), {
    type: 'module',
  });

  function postMessage(message: PoseWorkerCommand, transfer?: Transferable[]) {
    if (transfer && transfer.length > 0) {
      worker.postMessage(message, transfer);
    } else {
      worker.postMessage(message);
    }
  }

  function addMessageListener(listener: (event: MessageEvent<PoseWorkerEvent>) => void) {
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
