/// <reference lib="dom" />

import * as rpc from 'vscode-jsonrpc/browser';

import { createSender } from '../shared/cancellation/sender';
import { log, logThrow, runClient } from '../shared/page';
import {
    cancellationPath,
    DeleteCanceledEventData,
    RpcError,
    RpcRequest,
    RpcResponse,
    SetCanceledEventData,
    SwMessage,
} from './common';

if (!navigator.serviceWorker) {
    logThrow('Service workers are not available');
}

run();

async function run() {
    log('registering service worker');
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.installing) {
        const sw = reg.installing || reg.waiting;
        sw.onstatechange = () => {
            if (sw.state === 'installed') {
                console.log('state change reload');
                window.location.reload();
            }
        };
        logThrow('waiting for service worker');
    } else if (reg.active) {
        if (!navigator.serviceWorker.controller) {
            logThrow("The service worker can't be contacted, likely due to a Ctrl+Shift+R. Try reloading.");
        }
    } else {
        logThrow('no service worker');
    }

    navigator.serviceWorker.addEventListener('message', (e) => {
        const message = e.data as SwMessage;

        if (message.type === 'log') {
            log(`sw: ${message.message}`);
        } else if (message.type === 'rpc') {
            const { request, port } = message;

            function send(m: RpcResponse | RpcError) {
                port.postMessage(m);
            }

            handleRpcCall(request)
                .then(send)
                .catch((e) => send({ error: { code: -32000, message: e.toString() } }));
        }
    });

    log('starting web worker');
    const worker = new Worker('./sw-worker.js');

    runClient(
        worker,
        // Use SW cancellation tokens when sending requests, but normal
        // RPC-based cancellation when receiving requests.
        {
            receiver: rpc.CancellationReceiverStrategy.Message,
            sender: createSender(sendCancellationMessage, deleteCancellationMessage),
            // sender: createSender(sendCancellationRequest),
        }
    );
}

function sendCancellationMessage(id: rpc.CancellationId): void {
    const message: SetCanceledEventData = { type: 'setCanceled', id };
    // Note: this only works outside of a worker; for a version that works inside workers,
    // see sendCancellationRequest.
    globalThis.navigator.serviceWorker.controller?.postMessage(message);
}

function deleteCancellationMessage(id: rpc.CancellationId): void {
    const message: DeleteCanceledEventData = { type: 'deleteCanceled', id };
    // Note: this only works outside of a worker; for a version that works inside workers,
    // see deleteCancellationRequest.
    globalThis.navigator.serviceWorker.controller?.postMessage(message);
}

// Alternative method for triggering cancellation via a POST request to the service worker.
function sendCancellationRequest(id: rpc.CancellationId): void {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('POST', path); // OK to be async
    request.send();
}

function deleteCancellationRequest(id: rpc.CancellationId): void {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('DELETE', path); // OK to be async
    request.send();
}

async function handleRpcCall(request: RpcRequest): Promise<RpcResponse> {
    if (request.method === 'hello') {
        return {
            result: `Hello from the page, ${request.params}!`,
        };
    }
    throw new Error(`unsupported method ${request.method}`);
}
