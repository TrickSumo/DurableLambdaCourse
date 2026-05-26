import { handleHome } from './routes/home.js';
import { handleStatus, handlePoll } from './routes/status.js';
import { handlePayment, handlePay } from './routes/payment.js';
import { handleAdmin, handleApprove, handleReject } from './routes/admin.js';
import { serveAsset } from './lib/assets.js';

export const handler = async (event) => {
    const { view, action, asset } = event.queryStringParameters ?? {};
    const method = event.requestContext.http.method;

    if (asset)                          return serveAsset(asset);

    if (method === 'GET') {
        if (action === 'poll')          return await handlePoll(event);
        if (!view)                      return handleHome();
        if (view === 'status')          return handleStatus(event);
        if (view === 'payment')         return handlePayment(event);
        if (view === 'admin')           return await handleAdmin();
    }

    if (method === 'POST') {
        if (action === 'pay')           return await handlePay(event);
        if (action === 'approve')       return await handleApprove(event);
        if (action === 'reject')        return await handleReject(event);
    }

    return { statusCode: 404, body: 'Not found' };
};
