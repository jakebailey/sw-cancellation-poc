/// <reference lib="dom" />

import * as rpc from 'vscode-jsonrpc/browser';

import { log, logThrow, runClient } from '../demo/page';
import { SwCancellationSender } from './cancellation';

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
            sender: new SwCancellationSender(),
        }
    );
}
