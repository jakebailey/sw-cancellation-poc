/// <reference lib="webworker" />

import * as rpc from 'vscode-jsonrpc/browser';

import { runServer } from '../demo/worker';
import { SwCancellationReceiver } from './cancellation';

runServer(
    // Use SW cancellation tokens when receiving requests, but normal
    // RPC-based cancellation when sending requests.
    {
        receiver: new SwCancellationReceiver(),
        sender: rpc.CancellationSenderStrategy.Message,
    }
);
