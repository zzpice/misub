// Isolated browser checks: synthetic fixtures only, no production requests or credentials.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { DEFAULT_SETTINGS } from '../src/constants/default-settings.js';

const port = 4179;
const baseUrl = `http://127.0.0.1:${port}/`;
const screenshotDir = process.env.SUB_SCREENSHOTS;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const server = spawn(
    process.execPath,
    [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
);
let serverOutput = '';
for (const stream of [server.stdout, server.stderr])
    stream.on('data', (chunk) => {
        serverOutput = (serverOutput + chunk).slice(-4000);
    });
let browser;
let activePage;
const GiB = 1024 ** 3;
function fixture() {
    return {
        misubs: [
            {
                id: 'source-1',
                name: 'North Network',
                url: 'https://north.example.test/sub',
                enabled: true,
                nodeCount: 24,
                lastUpdated: Date.now(),
                userInfo: {
                    upload: 2 * GiB,
                    download: 34 * GiB,
                    total: 200 * GiB,
                    expire: Math.floor(Date.now() / 1000) + 90 * 86400,
                },
            },
            {
                id: 'source-2',
                name: 'South Network',
                url: 'https://south.example.test/sub',
                enabled: true,
                nodeCount: 18,
                lastUpdated: Date.now(),
                userInfo: { upload: GiB, download: 14 * GiB, total: 100 * GiB },
            },
            ...Array.from({ length: 60 }, (_, i) => ({
                id: `node-${i}`,
                name: `Tokyo ${String(i + 1).padStart(2, '0')}`,
                url: `trojan://synthetic-password@node-${i}.example.test:443#Tokyo%20${i + 1}`,
                enabled: true,
                nodeCount: 1,
                group: i < 30 ? '日常' : '备用',
            })),
        ],
        profiles: [
            {
                id: 'daily',
                name: '日常使用',
                enabled: true,
                subscriptions: ['source-1', 'source-2'],
                manualNodes: ['node-0'],
                customId: 'daily',
                description: 'Mihomo · sing-box · Loon',
            },
        ],
        ruleTemplates: [],
        config: {
            ...structuredClone(DEFAULT_SETTINGS),
            storageType: 'd1',
            personalMode: true,
            mytoken: 'synthetic-main-token',
            profileToken: 'synthetic-profile-token',
            managedSecrets: { adminPassword: true, mytoken: true, profileToken: true },
            security: {
                adminPasswordManaged: true,
                subscriptionTokenManaged: true,
                profileTokenManaged: true,
            },
        },
    };
}
async function waitForPreview() {
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error(`Preview exited: ${serverOutput}`);
        try {
            if ((await fetch(baseUrl)).ok) return;
        } catch {
            /* starting */
        }
        await delay(100);
    }
    throw new Error(`Preview failed: ${serverOutput}`);
}
try {
    await waitForPreview();
    browser = await chromium.launch({ headless: true });
    for (const viewport of [
        { width: 1280, height: 900 },
        { width: 820, height: 1000 },
        { width: 390, height: 844 },
        { width: 320, height: 740 },
    ]) {
        const context = await browser.newContext({
            viewport,
            locale: 'zh-CN',
            reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        activePage = page;
        page.setDefaultTimeout(10000);
        const failures = [];
        const requests = [];
        let authenticated = false;
        let data = fixture();
        let settingsReads = 0;
        page.on('pageerror', (error) => failures.push(error.message));
        page.on('request', (request) => {
            const url = new URL(request.url());
            if (url.origin !== new URL(baseUrl).origin)
                failures.push(`Unexpected external request: ${url.origin}`);
            requests.push(url.pathname);
        });
        await page.route('**/*', (route) =>
            new URL(route.request().url()).origin === new URL(baseUrl).origin
                ? route.fallback()
                : route.abort()
        );
        await page.route('**/api/**', async (route) => {
            const path = new URL(route.request().url()).pathname;
            let body;
            if (path === '/api/login') {
                authenticated = true;
                body = { success: true };
            } else if (path === '/api/logout') {
                authenticated = false;
                body = { success: true };
            } else if (path === '/api/data') body = authenticated ? data : { authenticated: false };
            else if (path === '/api/settings' && route.request().method() === 'GET') {
                settingsReads++;
                body = data.config;
            } else if (path === '/api/settings') {
                data.config = { ...data.config, ...route.request().postDataJSON() };
                body = { success: true };
            } else if (path === '/api/misubs') {
                const payload = route.request().postDataJSON();
                data = { ...data, ...payload };
                body = { success: true, data: payload };
            } else if (path === '/api/logs') body = { logs: [], success: true };
            else if (path === '/api/rule_templates') body = { success: true, data: [] };
            else body = { success: true, data: [] };
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.locator('form input[type="password"]').waitFor();
        assert.match(await page.title(), /Zzp Sub/);
        assert.equal(requests.filter((p) => p === '/api/data').length, 1);
        assert.ok(!requests.includes('/api/login_config'));
        if (screenshotDir && viewport.width >= 390)
            await page.screenshot({
                path: `${screenshotDir}/login-${viewport.width}.png`,
                fullPage: true,
                animations: 'disabled',
            });
        await page.locator('form input[type="password"]').fill('local-synthetic-password');
        await page.locator('form button[type="submit"]').click();
        await page.getByTestId('stat-card-nodes').waitFor();
        const nav =
            viewport.width >= 1024
                ? page.locator('.nav-tab-shell')
                : page.locator('.mobile-nav-glass');
        async function go(path) {
            await nav.locator(`a[href="${path}"]`).click();
            await page.locator('main h1').first().waitFor();
            assert.equal(new URL(page.url()).pathname, '/');
            assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
        }
        async function checkPage(name) {
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                `${name} overflows at ${viewport.width}px`
            );
            if (screenshotDir && [1280, 390].includes(viewport.width))
                await page.screenshot({
                    path: `${screenshotDir}/${name}-${viewport.width}.png`,
                    fullPage: true,
                    animations: 'disabled',
                });
        }
        await checkPage('dashboard');
        assert.ok(!requests.some((p) => p.includes('legacy')));
        // Opening modules must not repeat the authenticated data request.
        await go('/dashboard/groups');
        await page.getByTestId('subscription-search').waitFor();
        await checkPage('sources');
        await page.getByTestId('subscription-search').fill('North');
        await page.getByText('North Network', { exact: true }).first().waitFor();
        await page.getByTestId('subscription-search').fill('');
        await go('/dashboard/nodes');
        await page.getByTestId('manual-node-search').locator('input').waitFor();
        await checkPage('nodes');
        // Lazily mounted editors must initialize, trap keyboard focus and save correctly.
        await page
            .getByTestId('manual-node-toolbar-actions')
            .getByRole('button', { name: '新增', exact: true })
            .click();
        const nodeDialog = page.getByRole('dialog');
        await nodeDialog.locator('textarea').waitFor();
        await nodeDialog
            .locator('textarea')
            .fill('trojan://synthetic@added.example.test:443#Added-node');
        await nodeDialog.getByRole('button', { name: '确认', exact: true }).click();
        await nodeDialog.waitFor({ state: 'hidden' });
        await page.locator('.save-prompt').waitFor();
        await page
            .locator('.save-prompt')
            .getByRole('button', { name: '立即保存', exact: true })
            .click();
        await page.waitForFunction(() =>
            [...document.querySelectorAll('.save-prompt button')].some((button) =>
                button.textContent.includes('已保存')
            )
        );
        assert.ok(
            data.misubs.some((item) => item.url.includes('added.example.test')),
            'New node was not persisted'
        );
        await go('/dashboard/subscriptions');
        await page.getByTestId('profile-search').waitFor();
        await checkPage('profiles');
        await page.getByTestId('profile-search').fill('no-match');
        assert.equal(await page.locator('[data-testid=profile-search]').inputValue(), 'no-match');
        await page.getByTestId('profile-search').fill('');
        await go('/dashboard/settings');
        await page.locator('.settings-tabs').waitFor();
        await page.locator('.settings-sections input').first().waitFor();
        await checkPage('settings');
        assert.equal(settingsReads, 1, 'Settings requested twice on mount');
        for (const index of [1, 2, 3, 0]) {
            await page.locator('.settings-tab').nth(index).click();
            await page.locator('.settings-sections > div > div').first().waitFor();
            assert.equal(await page.locator('.settings-tab[aria-current="page"]').count(), 1);
        }
        const filename = page.locator('.settings-sections input[type="text"]').first();
        await filename.fill('Saved-fixture');
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().endsWith('/api/settings') &&
                    response.request().method() === 'POST'
            ),
            page.locator('.settings-save button').click(),
        ]);
        assert.equal(data.config.FileName, 'Saved-fixture');
        assert.equal(
            requests.filter((p) => p === '/api/data').length,
            2,
            'Navigation or settings save reloaded /api/data'
        );
        assert.ok(
            !requests.some((p) => /SettingsPanel|Dashboard-/.test(p)),
            'Obsolete layout loaded'
        );
        if (viewport.width === 1280 || viewport.width === 390) {
            await page
                .locator('header:visible button[aria-label]')
                .filter({ has: page.locator('svg path[d^="M20.354"]') })
                .click();
            await go('/dashboard');
            await page.getByTestId('stat-card-nodes').waitFor();
            await checkPage('dashboard-dark');
        }
        assert.deepEqual(failures, [], `Browser errors at ${viewport.width}px`);
        console.log(
            `browser smoke: ${viewport.width}px login + all five modules, search, tabs, no overflow or external requests`
        );
        await page.locator('header:visible button[aria-label="退出登录"]').click();
        await page.locator('form input[type="password"]').waitFor();
        assert.equal(authenticated, false);
        await context.close();
    }
} catch (error) {
    console.error('Page state at failure:', await activePage?.locator('body').innerText());
    if (screenshotDir)
        await activePage?.screenshot({ path: `${screenshotDir}/failure.png`, fullPage: true });
    throw error;
} finally {
    await browser?.close();
    server.kill('SIGTERM');
}
