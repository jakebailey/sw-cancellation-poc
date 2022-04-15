/// <reference lib="webworker" />

import * as rpc from 'vscode-jsonrpc/browser';

import { SwCancellationReceiver } from './cancellation';
import { debug } from './debug';
import { addNumbersRequest, addNumbersSlowRequest } from './requests';

declare const self: DedicatedWorkerGlobalScope;
export {};

const connection = rpc.createMessageConnection(
    new rpc.BrowserMessageReader(self),
    new rpc.BrowserMessageWriter(self),
    /*logger*/ undefined,
    {
        // Use SW cancellation tokens when receiving requests, but normal
        // RPC-based cancellation when sending requests.
        cancellationStrategy: {
            receiver: new SwCancellationReceiver(),
            sender: rpc.CancellationSenderStrategy.Message,
        },
    }
);

function throwIfCancellationRequested(cancellationToken: rpc.CancellationToken) {
    if (cancellationToken.isCancellationRequested) {
        throw new rpc.ResponseError(-32800, 'request cancelled'); // From LSP
    }
}

connection.onRequest(addNumbersRequest, (a, b) => {
    return a + b;
});

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

connection.onRequest(addNumbersSlowRequest, async (a, b, cancellationToken) => {
    for (let i = 0; i < 20; i++) {
        await sleep(100);
        throwIfCancellationRequested(cancellationToken);
    }
    return a + b;
});

connection.listen();

debug && console.log('worker started');
