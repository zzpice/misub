// Run only against a locally built Vite preview with fake, unauthenticated API replies.
// Never connect to the production domain or use production credentials.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4179;
const baseUrl = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
        serverOutput = (serverOutput + chunk.toString()).slice(-4000);
    });
}

let browser;
async function waitForPreview() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (server.exitCode !== null) throw new Error(`Preview exited: ${serverOutput}`);
        try {
            const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
            if (response.ok) return;
        } catch { /* server is starting */ }
        await delay(150);
    }
    throw new Error(`Preview failed to start: ${serverOutput}`);
}

try {
    await waitForPreview();
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport });
        const failures = [];
        page.on('pageerror', (error) => failures.push(`JavaScript: ${error.message}`));
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === new URL(baseUrl).origin &&
                /^\/assets\/.*\.(?:js|css)$/.test(url.pathname) &&
                response.status() >= 400) {
                failures.push(`Asset HTTP ${response.status()}: ${url.pathname}`);
            }
        });
        await page.route('**/api/**', (route) => {
            const path = new URL(route.request().url()).pathname;
            const body = path === '/api/data'
                ? { authenticated: false }
                : path === '/api/login_config'
                    ? { isLoginPath: false }
                    : { error: 'Unauthenticated' };
            return route.fulfill({
                status: path === '/api/data' || path === '/api/login_config' ? 200 : 401,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });
        const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        assert.equal(response?.status(), 200, 'Built page did not serve HTTP 200');
        await page.locator('form input[type="password"]').waitFor({
            state: 'visible', timeout: 20000,
        });
        await page.locator('form button[type="submit"]').waitFor({
            state: 'visible', timeout: 10000,
        });
        assert.ok(await page.locator('#app').isVisible(), 'Vue app did not render');
        assert.deepEqual(failures, [], `Browser errors at ${viewport.width}px`);
        console.log(`browser smoke: ${viewport.width}px login rendered; no fatal JS or JS/CSS errors`);
        await page.close();
    }
} finally {
    await browser?.close();
    server.kill('SIGTERM');
}
