/// <reference lib="dom" />

import * as rpc from 'vscode-jsonrpc/browser';

import { addNumbersRequest, addNumbersSlowRequest } from './requests';

export function log(m = '') {
    document.getElementById('log')!.innerText += `${m}\n`;
}

export function logThrow(m: string): never {
    log(m);
    throw new Error(m);
}

export async function runClient(worker: Worker, cancellationStrategy: rpc.CancellationStrategy) {
    const connection = rpc.createMessageConnection(
        new rpc.BrowserMessageReader(worker),
        new rpc.BrowserMessageWriter(worker),
        /*logger*/ undefined,
        {
            cancellationStrategy,
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
}
