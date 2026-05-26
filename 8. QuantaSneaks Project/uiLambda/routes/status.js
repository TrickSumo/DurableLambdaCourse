import { readFileSync } from 'fs';
import { join } from 'path';
import { getOrder } from '../lib/dynamo.js';

const html = readFileSync(join(process.cwd(), 'views', 'status.html'), 'utf-8');

export function handleStatus(event) {
    const orderId = event.queryStringParameters?.orderId ?? '';
    const body = html.replace(/\{\{ORDER_ID\}\}/g, orderId);
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body };
}

export async function handlePoll(event) {
    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing orderId' }) };

    const order = await getOrder(orderId);
    if (!order) return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    };
}
