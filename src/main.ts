/// <reference lib="dom" />

import * as rpc from 'vscode-jsonrpc/browser';

import { SwCancellationSender } from './cancellation';
import { addNumbersRequest, addNumbersSlowRequest } from './requests';

function log(m = '') {
    document.getElementById('log')!.innerText += `${m}\n`;
}

function logThrow(m: string): never {
    log(m);
    throw new Error(m);
}

if (!navigator.serviceWorker) {
    logThrow('Service workers are not available');
}

log('registering service worker');
const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
if (reg.installing) {
    const sw = reg.installing || reg.waiting;
    sw.onstatechange = function () {
        if (sw.state === 'installed') {
            console.log('state change reload');
            window.location.reload();
        }
    };
    logThrow('waiting for service worker');
} else if (reg.active) {
    if (!navigator.serviceWorker.controller) {
        // Page was probably reloaded with Ctrl+Shift+R, force a page reload to bring the SW back.
        window.location.reload();
        logThrow('waiting for service worker');
    }
} else {
    logThrow('no service worker');
}

const worker = new Worker('./worker.js');

const connection = rpc.createMessageConnection(
    new rpc.BrowserMessageReader(worker),
    new rpc.BrowserMessageWriter(worker),
    /*logger*/ undefined,
    {
        // Use SW cancellation tokens when sending requests, but normal
        // RPC-based cancellation when receiving requests.
        cancellationStrategy: {
            receiver: rpc.CancellationReceiverStrategy.Message,
            sender: new SwCancellationSender(),
        },
    }
);

connection.listen();

async function timeit<T>(fn: () => T): Promise<T> {
    const before = performance.now();
    try {
        return await fn();
    } finally {
        log(`took ${Math.round(performance.now() - before)} ms`);
    }
}

log();

await timeit(async () => {
    log('calling addNumbers(1, 2)');
    log(`result = ${await connection.sendRequest(addNumbersRequest, 1, 2)}`);
});

log();

await timeit(async () => {
    log('addNumbersSlowRequest(1, 2)');
    log(`result = ${await connection.sendRequest(addNumbersSlowRequest, 1, 2)}`);
});

log();

const tokenSource = new rpc.CancellationTokenSource();
setTimeout(() => {
    log('triggering cancellation');
    tokenSource.cancel();
}, 1000);

await timeit(async () => {
    try {
        log('addNumbersSlowRequest(1, 2) with cancellation after 1 second');
        const result = await connection.sendRequest(addNumbersSlowRequest, 1, 2, tokenSource.token);
        log(`unexpected result = ${result}`);
    } catch (e) {
        log(`threw ${e}`);
    }
});
