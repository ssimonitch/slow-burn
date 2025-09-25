import type {
  AudioPreloadAbortCommand,
  AudioPreloadCommand,
  AudioPreloadEvent,
  AudioPreloadFailure,
  AudioPreloadRequestCommand,
} from './audio-preload.types';

const inflightControllers = new Map<string, Map<string, AbortController>>();
const abortedIds = new Set<string>();

self.addEventListener('message', (event) => {
  const message = event.data as AudioPreloadCommand;

  switch (message.type) {
    case 'AUDIO_PRELOAD':
      void handlePreload(message);
      break;
    case 'AUDIO_PRELOAD_ABORT':
      handleAbort(message);
      break;
    default:
      break;
  }
});

async function handlePreload(command: AudioPreloadRequestCommand) {
  const uniqueUrls = Array.from(new Set(command.urls));

  if (uniqueUrls.length === 0) {
    postMessageToClient({
      type: 'AUDIO_PRELOAD_COMPLETE',
      id: command.id,
      loaded: [],
      failed: [],
    });
    return;
  }

  if (inflightControllers.has(command.id)) {
    abortPreload(command.id);
  }

  const controllers = new Map<string, AbortController>();
  inflightControllers.set(command.id, controllers);
  abortedIds.delete(command.id);

  const loaded: string[] = [];
  const failed: AudioPreloadFailure[] = [];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const controller = new AbortController();
      controllers.set(url, controller);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: command.cache,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        await response.arrayBuffer();

        loaded.push(url);
        postMessageToClient({
          type: 'AUDIO_PRELOAD_PROGRESS',
          id: command.id,
          url,
          status: 'loaded',
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);

        failed.push({
          url,
          error: message,
        });

        postMessageToClient({
          type: 'AUDIO_PRELOAD_PROGRESS',
          id: command.id,
          url,
          status: 'error',
          error: message,
        });
      } finally {
        controllers.delete(url);
      }
    }),
  );

  inflightControllers.delete(command.id);

  if (abortedIds.has(command.id)) {
    abortedIds.delete(command.id);
    postMessageToClient({
      type: 'AUDIO_PRELOAD_ABORTED',
      id: command.id,
    });
    return;
  }

  postMessageToClient({
    type: 'AUDIO_PRELOAD_COMPLETE',
    id: command.id,
    loaded,
    failed,
  });
}

function handleAbort(command: AudioPreloadAbortCommand) {
  if (command.id) {
    abortPreload(command.id);
    return;
  }

  Array.from(inflightControllers.keys()).forEach(abortPreload);
}

function abortPreload(id: string) {
  const controllers = inflightControllers.get(id);
  if (!controllers) {
    return;
  }

  abortedIds.add(id);

  controllers.forEach((controller) => {
    controller.abort();
  });

  inflightControllers.delete(id);
}

function postMessageToClient(event: AudioPreloadEvent) {
  self.postMessage(event);
}

export {};
