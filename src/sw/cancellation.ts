import * as rpc from 'vscode-jsonrpc/browser';

import { cancellationPath, SetCanceledEventData } from './common';

function isCancellationRequested(id: rpc.CancellationId): boolean {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('GET', path, /* async */ false);
    request.send();
    return request.status === 200;
}

function cancelWithMessage(id: rpc.CancellationId): void {
    const message: SetCanceledEventData = { type: 'setCanceled', id };
    globalThis?.navigator?.serviceWorker.controller?.postMessage(message);
}

// Alternative method for triggering cancellation via a POST request to the service worker.
function cancelWithHttp(id: rpc.CancellationId): void {
    const path = cancellationPath(id);
    const request = new XMLHttpRequest();
    request.open('POST', path); // OK to be async
    request.send();
}

// For the below, see: https://github.com/microsoft/vscode-languageserver-node/blob/dca3c1a04797aaaa7d48060cca38b16efdf4392f/jsonrpc/src/common/cancellation.ts

const shortcutEvent: rpc.Event<any> = Object.freeze(function (callback: Function, context?: any): any {
    const handle = setTimeout(callback.bind(context), 0);
    return {
        dispose() {
            clearTimeout(handle);
        },
    };
});

class Token implements rpc.CancellationToken {
    private _isCanceled = false;
    private _emitter?: rpc.Emitter<any>;

    constructor(private _id: rpc.CancellationId) {}

    public cancel() {
        if (!this._isCanceled) {
            this._isCanceled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this.dispose();
            }
        }
    }

    get isCancellationRequested(): boolean {
        if (this._isCanceled) {
            return true;
        }

        return (this._isCanceled = isCancellationRequested(this._id));
    }

    get onCancellationRequested(): rpc.Event<any> {
        if (this._isCanceled) {
            return shortcutEvent;
        }
        if (!this._emitter) {
            this._emitter = new rpc.Emitter<any>();
        }
        return this._emitter.event;
    }

    public dispose(): void {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = undefined;
        }
    }
}

class TokenSource implements rpc.AbstractCancellationTokenSource {
    private _token?: rpc.CancellationToken;

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
        cancelWithMessage(id);
        // cancel(id);
    }

    cleanup(_: rpc.CancellationId): void {}
}
