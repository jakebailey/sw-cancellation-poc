import type * as rpc from 'vscode-jsonrpc/browser';

const pathPrefix = '/@cancellation@/';

export function isCancellationPath(path: string): boolean {
    return path.includes(pathPrefix);
}

// Returns relative paths to ensure a subpath doesn't break.
export function cancellationPath(requestId: rpc.CancellationId, clientId?: string): string {
    if (clientId) {
        return `.${pathPrefix}${requestId}/${clientId}`;
    }
    return `.${pathPrefix}${requestId}`;
}

function isClientSource(source: ExtendableMessageEvent['source']): source is Client {
    if (source && typeof (source as Client).id === 'string') {
        return true;
    }
    return false;
}

export interface SetCanceledEventData {
    readonly type: 'setCanceled';
    readonly id: rpc.CancellationId;
}

export interface SetCanceledEvent extends ExtendableMessageEvent {
    readonly data: SetCanceledEventData;
    readonly source: Client;
}

export namespace SetCanceledEvent {
    export function is(e: ExtendableMessageEvent): e is SetCanceledEvent {
        return (
            e.data.type === 'setCanceled' &&
            isClientSource(e.source) &&
            (typeof e.data.id === 'number' || typeof e.data.id === 'string')
        );
    }
}