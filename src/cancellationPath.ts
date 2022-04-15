import type * as rpc from 'vscode-jsonrpc/browser';

const pathPrefix = '/@cancellation@/';

export const cancellationScope = `.${pathPrefix}`;

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
