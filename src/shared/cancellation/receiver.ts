import * as rpc from 'vscode-jsonrpc/browser';

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

    constructor(private _isCancellationRequested: () => boolean) {}

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

        return (this._isCanceled = this._isCancellationRequested());
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

    constructor(private _isCancellationRequested: () => boolean) {}

    get token(): rpc.CancellationToken {
        return (this._token ??= new Token(this._isCancellationRequested));
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

export function createReceiver(
    isCancellationRequested: (id: rpc.CancellationId) => boolean
): rpc.CancellationReceiverStrategy {
    return {
        createCancellationTokenSource: (id) => new TokenSource(() => isCancellationRequested(id)),
    };
}
