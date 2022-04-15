import * as rpc from 'vscode-jsonrpc/browser';

import { cancellationPath } from './cancellationPath';

function isCancellationRequested(id: rpc.CancellationId): boolean {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('GET', path, /* async */ false);
    request.send();
    return request.status === 200;
}

function cancel(id: rpc.CancellationId): void {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('POST', path); // OK to be async
    request.send();
}

class Token implements rpc.CancellationToken {
    private _isCanceled = false;
    private _emitter?: rpc.Emitter<any>;

    constructor(private _id: rpc.CancellationId) {}

    get isCancellationRequested(): boolean {
        if (this._isCanceled) {
            return true;
        }

        return (this._isCanceled = isCancellationRequested(this._id));
    }

    get onCancellationRequested(): rpc.Event<any> {
        if (!this._emitter) {
            this._emitter = new rpc.Emitter();
        }
        return this._emitter.event;
    }

    cancel() {
        if (!this._isCanceled) {
            this._isCanceled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this._disposeEmitter();
            }
        }
    }

    dispose(): void {
        this._disposeEmitter();
    }

    private _disposeEmitter() {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = undefined;
        }
    }
}

class TokenSource implements rpc.AbstractCancellationTokenSource {
    private _token: rpc.CancellationToken | undefined;

    constructor(private _id: rpc.CancellationId) {}

    get token(): rpc.CancellationToken {
        return (this._token ??= new Token(this._id));
    }

    cancel(): void {
        if (this._token instanceof Token) {
            this._token.cancel();
        } else if (!this.token) {
            this._token = rpc.CancellationToken.Cancelled;
        }
    }

    dispose(): void {
        if (this._token instanceof Token) {
            this._token.dispose();
        } else if (!this.token) {
            this._token = rpc.CancellationToken.None;
        }
    }
}

export class SwCancellationReceiver implements rpc.CancellationReceiverStrategy {
    createCancellationTokenSource(id: rpc.CancellationId): rpc.AbstractCancellationTokenSource {
        return new TokenSource(id);
    }
}

export class SwCancellationSender implements rpc.CancellationSenderStrategy {
    sendCancellation(_: rpc.MessageConnection, id: rpc.CancellationId): void {
        // cancel(id);
        globalThis?.navigator?.serviceWorker.controller?.postMessage({ type: 'setCanceled', id });
    }

    cleanup(_: rpc.CancellationId): void {}
}

