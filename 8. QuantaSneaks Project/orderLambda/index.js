import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';

const dynamo = new DynamoDBClient({});
const lambda = new LambdaClient({});

const TABLE = process.env.ORDERS_TABLE ?? 'quantasneaks';
const DURABLE_LAMBDA_ARN = process.env.DURABLE_LAMBDA_ARN;
const UI_LAMBDA_URL = process.env.UI_LAMBDA_URL;

function parseBody(event) {
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body ?? '';
    const contentType = event.headers?.['content-type'] ?? '';
    if (contentType.includes('application/json')) return JSON.parse(raw);
    return Object.fromEntries(new URLSearchParams(raw));
}

export const handler = async (event) => {
    const body = parseBody(event);
    const orderId = randomUUID();
    const size = body.size ?? 'unknown';

    await dynamo.send(new PutItemCommand({
        TableName: TABLE,
        Item: {
            orderId: { S: orderId },
            status: { S: 'processing' },
            size: { S: size },
            createdAt: { S: new Date().toISOString() }
        }
    }));

    await lambda.send(new InvokeCommand({
        FunctionName: DURABLE_LAMBDA_ARN,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({ orderId, size }))
    }));

    return {
        statusCode: 302,
        headers: { Location: `${UI_LAMBDA_URL}?view=status&orderId=${orderId}` }
    };
};
