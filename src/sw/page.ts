/// <reference lib="dom" />

import * as rpc from 'vscode-jsonrpc/browser';

import { createSender } from '../demo/cancellation';
import { log, logThrow, runClient } from '../demo/page';
import { cancellationPath, SetCanceledEventData } from './common';

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

    log('starting web worker');
    const worker = new Worker('./sw-worker.js');

    runClient(
        worker,
        // Use SW cancellation tokens when sending requests, but normal
        // RPC-based cancellation when receiving requests.
        {
            receiver: rpc.CancellationReceiverStrategy.Message,
            sender: createSender(sendCancellationMessage),
            // sender: createSender(sendCancellationRequest),
        }
    );
}

function sendCancellationMessage(id: rpc.CancellationId): void {
    const message: SetCanceledEventData = { type: 'setCanceled', id };
    // Note: this only works outside of a worker; for a version that works inside workers,
    // see cancelWithHttp.
    globalThis.navigator.serviceWorker.controller?.postMessage(message);
}

// Alternative method for triggering cancellation via a POST request to the service worker.
function sendCancellationRequest(id: rpc.CancellationId): void {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('POST', path); // OK to be async
    request.send();
}
