/// <reference lib="webworker" />

import { debug } from '../debug';
import {
    cancellationPath,
    DeleteCanceledEvent,
    isCancellationPath,
    isRpcPath,
    RpcRequest,
    RpcResponse,
    SetCanceledEvent,
    SwLogMessage,
    SwRpcMessage,
} from './common';

declare const self: ServiceWorkerGlobalScope;
export {};

const cacheName = 'v1';

// Since caches are shared, create a unique path for the specific client.
function getCachePath(pathname: string, clientId: string): string {
    return pathname + '/' + clientId;
}

async function setCanceled(pathname: string, clientId: string) {
    const cachePath = getCachePath(pathname, clientId);
    const cache = await self.caches.open(cacheName);
    cache.put(cachePath, new Response('', { status: 200 }));
}

async function setCanceledResponse(pathname: string, clientId: string): Promise<Response> {
    setCanceled(pathname, clientId);
    return new Response('', { status: 200 });
}

async function getCanceledResponse(pathname: string, clientId: string): Promise<Response> {
    debug && console.log(`sw: getCanceledResponse ${pathname}`);
    const cachePath = getCachePath(pathname, clientId);
    const cache = await self.caches.open(cacheName);
    const canceled = await cache.match(cachePath);
    return canceled ?? new Response('', { status: 299 });
}

async function deleteCanceled(pathname: string, clientId: string) {
    const cachePath = getCachePath(pathname, clientId);
    const cache = await self.caches.open(cacheName);
    cache.delete(cachePath);
}

async function deleteCanceledResponse(pathname: string, clientId: string) {
    deleteCanceled(pathname, clientId);
    return new Response('', { status: 200 });
}

self.addEventListener('install', (e) => {
    debug && console.log('sw: installed');
    // Don't bother waiting for a previous service worker to exit.
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(async () => {
        debug && console.log('sw: activated');
        // TODO: figure out the right semantics here. Service workers are "sticky",
        // in that an old service worker will just stick around until all of its pages
        // are closed, before the new worker is even able to touch those pages.
        // The general reasoning is that a service worker with a specific version
        // should not be able to affect pages which did not request a service worker
        // of that version. Maybe this is okay; the main thing is that we want to ensure
        // that the frontend page code (even after a reload) can assume that it's paired
        // with the correct version of the service worker.
        // See also: https://web.dev/service-worker-lifecycle/
        //           https://github.com/w3c/ServiceWorker/issues/1296

        // Grab control of any uncontrolled pages. Normally, a service worker would
        // only grab control of pages after a reload, but we want control the moment
        // the page loads, including the page that first started the service worker.
        await self.clients.claim();

        // Delete the cache to prevent buildup (as the browser will not prune the cache);
        // at worst we can't cancel a few pending requests.
        // TODO: do we need to do this so much now that token deletion has been
        // implemented? What about using a local variable instead?
        await self.caches.delete(cacheName);
    });
});

self.addEventListener('message', (e) => {
    if (SetCanceledEvent.is(e)) {
        setCanceled(cancellationPath(e.data.id), e.source.id);
    } else if (DeleteCanceledEvent.is(e)) {
        deleteCanceled(cancellationPath(e.data.id), e.source.id);
    }
});

async function clientLog(clientId: string, m: string) {
    const client = await self.clients.get(clientId);
    const message: SwLogMessage = { type: 'log', message: m };
    client?.postMessage(message);
}

self.addEventListener('fetch', (e) => {
    const request = e.request;
    debug && clientLog(e.clientId, `fetch ${request.method} ${request.url}`);

    const u = new URL(request.url);

    if (u.host !== self.location.host) {
        return;
    }

    if (isCancellationPath(u.pathname)) {
        switch (request.method) {
            case 'GET':
                e.respondWith(getCanceledResponse(u.pathname, e.clientId));
                break;
            // Alternative cancellation triggering method; see page.ts
            case 'POST':
                e.respondWith(setCanceledResponse(u.pathname, e.clientId));
                break;
            case 'DELETE':
                e.respondWith(deleteCanceledResponse(u.pathname, e.clientId));
                break;
        }
    } else if (isRpcPath(u.pathname)) {
        e.respondWith(rpcResponse(request, e.clientId));
    }
});

function clientRpcCall(client: Client, request: RpcRequest): Promise<RpcResponse> {
    return new Promise((resolve) => {
        const { port1: receiver, port2: sender } = new MessageChannel();
        receiver.onmessage = (e) => resolve(e.data);
        const message: SwRpcMessage = { type: 'rpc', request, port: sender };
        client.postMessage(message, [sender]);
    });
}

async function rpcResponse(request: Request, clientId: string): Promise<Response> {
    const client = await self.clients.get(clientId);
    if (!client) {
        return new Response('no client', { status: 500 });
    }

    const body: RpcRequest = await request.json();
    const response = await clientRpcCall(client, body);
    return new Response(JSON.stringify(response), { status: 200 });
}

debug && console.log('sw: loaded');
