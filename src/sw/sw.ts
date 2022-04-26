/// <reference lib="webworker" />

import { debug } from '../debug';
import {
    cancellationPath,
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

self.addEventListener('install', (e) => {
    debug && console.log('sw: installed');
    // Don't bother waiting for a previous service worker to exit.
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(async () => {
        debug && console.log('sw: activated');
        // TODO: figure out the right semantics here. For the cancellation case, it's OK to
        // always skip waiting and claim all clients, but when RPC is implemented, we don't
        // want to strand any pending requests that only the old service worker knows about.
        // To keep things working for demo, always claim and clear caches, but this is not
        // the right solution.

        // Steal clients from other service workers.
        await self.clients.claim();
        // Delete the cache to prevent buildup (as the browser will not prune the cache);
        // at worst we can't cancel a few pending requests.
        await self.caches.delete(cacheName);
    });
});

self.addEventListener('message', (e) => {
    if (SetCanceledEvent.is(e)) {
        setCanceled(cancellationPath(e.data.id), e.source.id);
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
