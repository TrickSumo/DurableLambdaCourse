import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(process.cwd(), 'views', 'home.html'), 'utf-8');

export function handleHome() {
    const body = html.replace('{{ORDER_LAMBDA_URL}}', process.env.ORDER_LAMBDA_URL ?? '/');
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body };
}
