import { LambdaClient, SendDurableExecutionCallbackSuccessCommand, SendDurableExecutionCallbackFailureCommand } from '@aws-sdk/client-lambda';

const client = new LambdaClient({});

export async function sendSuccess(callbackId, result = {}) {
    await client.send(new SendDurableExecutionCallbackSuccessCommand({
        CallbackId: callbackId,
        Result: Buffer.from(JSON.stringify(result))
    }));
}

export async function sendFailure(callbackId, errorType, errorMessage) {
    await client.send(new SendDurableExecutionCallbackFailureCommand({
        CallbackId: callbackId,
        Error: { ErrorType: errorType, ErrorMessage: errorMessage }
    }));
}
