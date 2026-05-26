import { readFileSync } from 'fs';
import { join } from 'path';
import { getOrder, getPendingApprovals } from '../lib/dynamo.js';
import { sendSuccess, sendFailure } from '../lib/callbacks.js';

const html = readFileSync(join(process.cwd(), 'views', 'admin.html'), 'utf-8');

export async function handleAdmin() {
    const orders = await getPendingApprovals();
    const rows = orders.map(o => `
        <tr>
            <td class="mono">${o.orderId.substring(0, 8)}…</td>
            <td>${o.size}</td>
            <td><span class="risk risk-${o.riskLevel}">${o.riskLevel}</span></td>
            <td>${o.riskReason}</td>
            <td>${new Date(o.createdAt).toLocaleString()}</td>
            <td>
                <button onclick="decide('${o.orderId}', 'approve')" class="btn-approve">Approve</button>
                <button onclick="decide('${o.orderId}', 'reject')" class="btn-reject">Reject</button>
            </td>
        </tr>
    `).join('');

    const body = html.replace('{{ROWS}}', rows || '<tr><td colspan="6" class="empty">No pending approvals</td></tr>');
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body };
}

export async function handleApprove(event) {
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
    const { orderId } = JSON.parse(raw);
    const order = await getOrder(orderId);
    await sendSuccess(order.approvalCallbackId, { approved: true });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

export async function handleReject(event) {
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
    const { orderId } = JSON.parse(raw);
    const order = await getOrder(orderId);
    await sendFailure(order.approvalCallbackId, 'Rejected', 'Order rejected by admin');
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
}
