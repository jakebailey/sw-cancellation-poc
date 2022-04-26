import type * as rpc from 'vscode-jsonrpc/browser';

const cancellationPathMarker = '/@cancellation@/';

export function isCancellationPath(path: string): boolean {
    return path.includes(cancellationPathMarker);
}

// Returns relative paths to ensure a subpath doesn't break.
export function cancellationPath(requestId: rpc.CancellationId): string {
    return `.${cancellationPathMarker}${requestId}`;
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

const rpcPathMarker = '/@rpc@/';

export function isRpcPath(path: string): boolean {
    return path.includes(rpcPathMarker);
}

// Returns relative paths to ensure a subpath doesn't break.
export function rpcPath(): string {
    return `.${rpcPathMarker}`;
}

export interface RpcRequest {
    method: string;
    params: any;
}

export interface RpcResponse {
    result: any;
}

export interface RpcError {
    error: {
        code: number;
        message: string;
    };
}

export interface SwLogMessage {
    type: 'log';
    message: string;
}

export interface SwRpcMessage {
    type: 'rpc';
    request: RpcRequest;
    port: MessagePort;
}

export type SwMessage = SwLogMessage | SwRpcMessage;
