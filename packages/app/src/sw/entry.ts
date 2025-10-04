/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import type { RouteMatchCallbackOptions } from 'workbox-core/types';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Audio files use CacheFirst for runtime caching (after precache)
registerRoute(
  ({ request }: RouteMatchCallbackOptions) => request.destination === 'audio',
  new CacheFirst({
    cacheName: 'sb-audio',
  }),
);

export {};
