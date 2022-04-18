import type * as rpc from 'vscode-jsonrpc/browser';

export function createSender(
    sendCancellation: (id: rpc.CancellationId) => void,
    cleanup?: (id: rpc.CancellationId) => void,
    dispose?: () => void
): rpc.CancellationSenderStrategy {
    return {
        sendCancellation: (_conn, id) => sendCancellation(id),
        cleanup: cleanup ?? (() => {}),
        dispose,
    };
}
