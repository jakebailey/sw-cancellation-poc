/// <reference lib="webworker" />

import * as rpc from 'vscode-jsonrpc/browser';

import { createReceiver } from '../demo/cancellation';
import { runServer } from '../demo/worker';
import { cancellationPath } from './common';

function isCancellationRequested(id: rpc.CancellationId): boolean {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('GET', path, /* async */ false);
    request.send();
    return request.status === 200;
}

runServer(
    // Use SW cancellation tokens when receiving requests, but normal
    // RPC-based cancellation when sending requests.
    {
        receiver: createReceiver(isCancellationRequested),
        sender: rpc.CancellationSenderStrategy.Message,
    }
);
