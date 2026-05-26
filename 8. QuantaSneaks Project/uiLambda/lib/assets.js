import { readFileSync } from 'fs';
import { join, extname } from 'path';

const TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

export function serveAsset(filename) {
    const ext = extname(filename).toLowerCase();
    if (!TYPES[ext]) return { statusCode: 403, body: 'Forbidden' };

    try {
        const data = readFileSync(join(process.cwd(), 'views', 'assets', filename));
        return {
            statusCode: 200,
            headers: { 'Content-Type': TYPES[ext] },
            body: data.toString('base64'),
            isBase64Encoded: true
        };
    } catch {
        return { statusCode: 404, body: 'Asset not found' };
    }
}
