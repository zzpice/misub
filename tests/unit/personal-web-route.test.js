// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyPersonalRequest } from '../../functions/modules/personal-web-route.js';
import { onRequest } from '../../functions/[[path]].js';

const secrets = {
    MISUB_PERSONAL_MODE: 'true',
    ADMIN_PASSWORD: 'test-admin-'.padEnd(48, 'a'),
    COOKIE_SECRET: 'test-cookie-'.padEnd(64, 'b'),
    SUBSCRIPTION_TOKEN: 'test-subscription-'.padEnd(48, 'c'),
    PROFILE_TOKEN: 'test-profile-'.padEnd(48, 'd'),
};

function createContext(path, headers = {}) {
    const env = {
        ...secrets,
        MISUB_DB: {
            prepare() {
                return {
                    bind() {
                        return this;
                    },
                    async first() {
                        return null;
                    },
                };
            },
        },
        ASSETS: {
            fetch(request) {
                const name = new URL(request.url).pathname;
                return Promise.resolve(
                    new Response(name === '/' ? '<html>app</html>' : 'asset', {
                        headers: { 'Content-Type': name === '/' ? 'text/html' : 'text/plain' },
                    })
                );
            },
        },
    };
    return {
        request: new Request('https://misub.example' + path, { headers }),
        env,
        next: async () => new Response('asset'),
    };
}

describe('single web entry in personal mode', () => {
    it('separates the root document from protected APIs, subscriptions and static files', () => {
        const config = { mytoken: secrets.SUBSCRIPTION_TOKEN, profileToken: secrets.PROFILE_TOKEN };
        for (const path of [
            '/login',
            '/dashboard',
            '/dashboard/settings',
            '/explore',
            '/settings',
            '/unknown',
            '/index.html',
        ]) {
            expect(classifyPersonalRequest(path, config)).toBe('forbidden');
        }
        for (const path of [
            '/api/data',
            '/api/login',
            '/sub/test',
            '/cron',
            `/${config.mytoken}/clash`,
            `/${config.profileToken}/profile`,
        ]) {
            expect(classifyPersonalRequest(path, config)).toBe('business');
        }
        for (const path of [
            '/assets/main.js',
            '/favicon.ico',
            '/logo.png',
            '/fonts/site.woff2',
            '/app.webmanifest',
        ]) {
            expect(classifyPersonalRequest(path, config)).toBe('asset');
        }
        expect(classifyPersonalRequest('/', config)).toBe('root');
    });

    it('returns empty HTTP 403 without redirect for non-root web paths', async () => {
        for (const path of [
            '/login',
            '/dashboard',
            '/explore',
            '/settings',
            '/dashboard/nodes',
            '/index.html',
        ]) {
            const response = await onRequest(
                createContext(path, {
                    Accept: 'text/html',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Dest': 'document',
                })
            );
            expect(response.status).toBe(403);
            expect(response.headers.get('Location')).toBeNull();
            expect(await response.text()).toBe('');
        }
    });

    it('serves / and static resources without exposing protected API data', async () => {
        const root = await onRequest(createContext('/'));
        expect(root.status).toBe(200);
        expect(await root.text()).toContain('app');
        expect(root.headers.get('Cache-Control')).toContain('no-store');

        const asset = await onRequest(createContext('/assets/main.js'));
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe('asset');

        const unauthenticated = await onRequest(createContext('/api/data'));
        expect(unauthenticated.status).toBe(200);
        expect(await unauthenticated.json()).toEqual({
            authenticated: false,
            message: 'Not logged in',
        });
        const protectedSettings = await onRequest(createContext('/api/settings'));
        expect(protectedSettings.status).toBe(401);
    });
});
