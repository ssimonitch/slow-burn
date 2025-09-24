/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute, RouteMatchCallbackOptions } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";

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

registerRoute(
  ({ request }: RouteMatchCallbackOptions) => request.destination === "audio",
  new CacheFirst({
    cacheName: "sb-audio",
  }),
);

registerRoute(
  ({ request }: RouteMatchCallbackOptions) =>
    request.destination === "style" || request.destination === "script",
  new StaleWhileRevalidate({
    cacheName: "sb-static-assets",
  }),
);

registerRoute(
  ({ request, url }: RouteMatchCallbackOptions) =>
    request.method === "GET" && url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: "sb-pages",
    networkTimeoutSeconds: 4,
  }),
);

export {};
