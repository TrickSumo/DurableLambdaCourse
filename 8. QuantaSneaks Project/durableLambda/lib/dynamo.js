import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const TABLE = process.env.ORDERS_TABLE ?? 'quantasneaks';

export async function updateOrder(orderId, fields) {
    const entries = Object.entries(fields);
    const names = {};
    const values = {};
    const parts = entries.map(([key, val]) => {
        names[`#${key}`] = key;
        values[`:${key}`] = val;
        return `#${key} = :${key}`;
    });

    await client.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: { orderId: { S: orderId } },
        UpdateExpression: `SET ${parts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }));
}
