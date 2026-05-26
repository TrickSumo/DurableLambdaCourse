import { readFileSync } from 'fs';
import { join } from 'path';
import { getOrder } from '../lib/dynamo.js';
import { sendSuccess } from '../lib/callbacks.js';

const html = readFileSync(join(process.cwd(), 'views', 'payment.html'), 'utf-8');

export function handlePayment(event) {
    const orderId = event.queryStringParameters?.orderId ?? '';
    const body = html.replace(/\{\{ORDER_ID\}\}/g, orderId);
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body };
}

export async function handlePay(event) {
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
    const { orderId } = JSON.parse(raw);

    const order = await getOrder(orderId);
    await sendSuccess(order.paymentCallbackId, { paid: true, paymentId: `PAY-${Date.now()}` });

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
    };
}
