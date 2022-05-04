/// <reference lib="webworker" />

import * as rpc from 'vscode-jsonrpc/browser';

import { createReceiver } from '../shared/cancellation/receiver';
import { helloRequest } from '../shared/requests';
import { runServer } from '../shared/worker';
import { cancellationPath, rpcPath, RpcResponse } from './common';

function isCancellationRequested(id: rpc.CancellationId): boolean {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('GET', path, /* async */ false);
    request.send();
    return request.status === 200;
}

function helloHandler(name: string): string {
    const request = new XMLHttpRequest();
    request.open('POST', rpcPath(), /* async */ false);
    request.send(
        JSON.stringify({
            method: 'hello',
            params: name,
        })
    );

    const response: RpcResponse = JSON.parse(request.responseText);
    return response.result;
}

runServer(
    // Use SW cancellation tokens when receiving requests, but normal
    // RPC-based cancellation when sending requests.
    {
        receiver: createReceiver(isCancellationRequested),
        sender: rpc.CancellationSenderStrategy.Message,
    },
    (conn) => {
        conn.onRequest(helloRequest, helloHandler);
    }
);
