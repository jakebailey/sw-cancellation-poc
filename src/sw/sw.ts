/// <reference lib="webworker" />

import { debug } from '../debug';
import { cancellationPath, isCancellationPath } from './cancellationPath';

declare const self: ServiceWorkerGlobalScope;
export {};

const cacheName = 'v1';

async function setCanceled(pathname: string) {
    const cache = await self.caches.open(cacheName);
    cache.put(pathname, new Response('', { status: 200 }));
}

async function setCanceledResponse(pathname: string): Promise<Response> {
    await setCanceled(pathname);
    return new Response('', { status: 200 });
}

async function getCanceledResponse(pathname: string): Promise<Response> {
    debug && console.log(`sw getCanceledResponse ${pathname}`);
    const cache = await self.caches.open(cacheName);
    const canceled = await cache.match(pathname);
    return canceled ?? new Response('', { status: 299 });
}

self.addEventListener('install', (e) => {
    debug && console.log('SW installed');
    // Immediately stops previous service workers and replaces them.
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(async () => {
        debug && console.log('SW activated');
        // Steal control from other clients.
        await self.clients.claim();
        // Delete the cache to prevent buildup (as the browser will not prune the cache);
        // at worst we can't cancel a few pending requests.
        await self.caches.delete(cacheName);
    });
});

function isClientSource(source: ExtendableMessageEvent['source']): source is Client {
    if (source && typeof (source as Client).id === 'string') {
        return true;
    }
    return false;
}

self.addEventListener('message', (e) => {
    if (e.data.type === 'setCanceled' && isClientSource(e.source)) {
        setCanceled(cancellationPath(e.data.id, e.source.id));
    }
});

self.addEventListener('fetch', (e) => {
    debug && console.log(`fetch ${e.request.method} ${e.request.url}`);
    const u = new URL(e.request.url);
    if (isCancellationPath(u.pathname)) {
        const pathWithClient = u.pathname + '/' + e.clientId;
        switch (e.request.method) {
            case 'GET':
                e.respondWith(getCanceledResponse(pathWithClient));
                break;
            case 'POST':
                e.respondWith(setCanceledResponse(pathWithClient));
                break;
        }
    }
});

debug && console.log('SW loaded');
