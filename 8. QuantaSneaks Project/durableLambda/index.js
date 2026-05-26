import { withDurableExecution } from '@aws/durable-execution-sdk-js';
import { updateOrder } from './lib/dynamo.js';

export const handler = withDurableExecution(async (event, context) => {
    const { orderId } = event;

    const compensations = [];

    const analysis = await context.step('llm-analysis', () => callLLM(orderId));

    try {

        // Optional inventory reservation step could go here, with compensation to release inventory if payment isn't completed

        const { paymentId } = await context.waitForCallback(
            'payment',
            async (callbackId) => {
                await updateOrder(orderId, {
                    status: { S: 'awaiting_payment' },
                    riskLevel: { S: analysis.riskLevel },
                    riskReason: { S: analysis.reason },
                    paymentCallbackId: { S: callbackId }
                });
            },
            { timeout: { hours: 1 } }
        );

        compensations.push({
            name: 'refund-payment',
            fn: () => refundPayment(paymentId)
        });

        await context.waitForCallback(
            'admin-approval',
            async (callbackId) => {
                await updateOrder(orderId, {
                    status: { S: 'awaiting_approval' },
                    approvalCallbackId: { S: callbackId }
                });
            },
            { timeout: { hours: 24 } }
        );

        await context.step('ship-order', () =>
            updateOrder(orderId, { status: { S: 'shipped' } })
        );

        await context.step('send-confirmation', () => sendConfirmationEmail(orderId));

        return { orderId, status: 'shipped' };

    } catch (error) {
        for (const comp of compensations.reverse()) {
            await context.step(comp.name, () => comp.fn());
        }

        await context.step('compensate', () =>
            updateOrder(orderId, { status: { S: 'compensated' } })
        );

        return { orderId, status: 'compensated' };
    }
});


async function refundPayment(paymentId) {
    console.log(`Refunding payment ${paymentId}`);
}

async function sendConfirmationEmail(orderId) {
    console.log(`Confirmation email sent for order ${orderId}`);
}

async function callLLM(orderId) {
    const levels = ['low', 'medium', 'high'];
    const riskLevel = levels[Math.floor(Math.random() * levels.length)];
    const reasons = {
        low: 'Account history looks legitimate',
        medium: 'New account with limited purchase history',
        high: 'Multiple claim attempts detected from same origin'
    };
    return { riskLevel, reason: reasons[riskLevel] };
}
