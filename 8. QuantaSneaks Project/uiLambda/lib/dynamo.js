import { DynamoDBClient, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const TABLE = process.env.ORDERS_TABLE ?? 'quantasneaks';

export async function getOrder(orderId) {
    const { Item } = await client.send(new GetItemCommand({
        TableName: TABLE,
        Key: { orderId: { S: orderId } }
    }));
    if (!Item) return null;
    return {
        orderId: Item.orderId?.S,
        status: Item.status?.S,
        riskLevel: Item.riskLevel?.S,
        riskReason: Item.riskReason?.S,
        paymentCallbackId: Item.paymentCallbackId?.S,
        approvalCallbackId: Item.approvalCallbackId?.S,
        size: Item.size?.S,
        createdAt: Item.createdAt?.S
    };
}

export async function getPendingApprovals() {
    const { Items } = await client.send(new ScanCommand({
        TableName: TABLE,
        FilterExpression: '#s = :s',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': { S: 'awaiting_approval' } }
    }));
    return (Items ?? []).map(i => ({
        orderId: i.orderId.S,
        riskLevel: i.riskLevel?.S ?? '-',
        riskReason: i.riskReason?.S ?? '-',
        approvalCallbackId: i.approvalCallbackId?.S,
        size: i.size?.S ?? '-',
        createdAt: i.createdAt?.S
    }));
}
