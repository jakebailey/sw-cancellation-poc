import * as rpc from 'vscode-jsonrpc/browser';

export const addNumbersRequest = new rpc.RequestType2<number, number, number, any>('addNumbers');

export const addNumbersSlowRequest = new rpc.RequestType2<number, number, number, any>('addNumbersSlow');
