// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';
import { SettingsCache } from '../../functions/storage-adapter.js';

function createKv(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
    };
}

describe('API route access boundaries', () => {
    beforeEach(() => {
        SettingsCache.clear();
    });

    it('returns 404 for removed APIs with or without authentication in either mode', async () => {
        for (const personal of [false, true]) {
            const env = {
                MISUB_KV: createKv(),
                MISUB_PERSONAL_MODE: String(personal),
                ADMIN_PASSWORD: 'fixture-admin-00000000000000000000000000',
                COOKIE_SECRET: 'fixture-cookie-00000000000000000000000000',
                SUBSCRIPTION_TOKEN: 'fixture-sub-00000000000000000000000000',
                PROFILE_TOKEN: 'fixture-profile-00000000000000000000000000',
            };
            const login = await handleApiRequest(
                new Request('https://example.com/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
                }),
                env
            );
            expect(login.status).toBe(200);
            const cookie = login.headers.get('Set-Cookie').split(';')[0];
            for (const path of [
                '/public/profiles',
                '/public/preview',
                '/public/guestbook',
                '/guestbook/manage',
                '/telegram/webhook',
                '/test_notification',
                '/system/error_report',
                '/public_config',
                '/config',
            ]) {
                for (const method of ['GET', 'POST']) {
                    for (const headers of [{}, { Cookie: cookie }]) {
                        const response = await handleApiRequest(
                            new Request('https://example.com/api' + path, { method, headers }),
                            env
                        );
                        expect(response.status, path + ' ' + method).toBe(404);
                    }
                }
            }
        }
    });

    it('keeps login configuration and client catalog reachable without an admin session', async () => {
        const env = { MISUB_KV: createKv() };

        const loginConfig = await handleApiRequest(
            new Request('https://example.com/api/login_config'),
            env
        );
        const publicClients = await handleApiRequest(
            new Request('https://example.com/api/clients'),
            env
        );

        expect(loginConfig.status).toBe(200);

        expect(publicClients.status).toBe(200);
    });

    it('does not expose the custom login path through public configuration', async () => {
        const env = {
            MISUB_KV: createKv({
                worker_settings_v1: JSON.stringify({ customLoginPath: 'admin-login' }),
            }),
        };

        const response = await handleApiRequest(
            new Request('https://example.com/api/login_config'),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).not.toHaveProperty('customLoginPath');
        expect(body.isLoginPath).toBe(false);
    });

    it('marks the current configured login path without returning the path', async () => {
        const env = {
            MISUB_KV: createKv({
                worker_settings_v1: JSON.stringify({ customLoginPath: 'admin-login' }),
            }),
        };

        SettingsCache.clear();
        const response = await handleApiRequest(
            new Request('https://example.com/api/login_config', {
                headers: { 'X-MiSub-Path': '/admin-login' },
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.isLoginPath).toBe(true);
        expect(body).not.toHaveProperty('customLoginPath');
    });

    it('returns unauthenticated metadata for /api/data without exposing management data', async () => {
        const env = {
            MISUB_KV: createKv({
                misub_subscriptions_v1: JSON.stringify([
                    { id: 'secret-sub', name: 'Private Sub', url: 'https://airport.example/sub' },
                ]),
                misub_profiles_v1: JSON.stringify([
                    { id: 'secret-profile', name: 'Private Profile' },
                ]),
            }),
            COOKIE_SECRET: 'stable-cookie-secret',
            ADMIN_PASSWORD: 'secret-password',
        };

        const response = await handleApiRequest(new Request('https://example.com/api/data'), env);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ authenticated: false, message: 'Not logged in' });
        expect(JSON.stringify(body)).not.toContain('secret-sub');
        expect(JSON.stringify(body)).not.toContain('Private Profile');
        expect(JSON.stringify(body)).not.toContain('airport.example');
    });

    it('requires an admin session for management routes before dispatching handlers', async () => {
        const env = {
            MISUB_KV: createKv(),
            COOKIE_SECRET: 'stable-cookie-secret',
            ADMIN_PASSWORD: 'secret-password',
        };

        const protectedRequests = [
            new Request('https://example.com/api/settings'),
            new Request('https://example.com/api/misubs', {
                method: 'POST',
                body: JSON.stringify({ misubs: [], profiles: [] }),
            }),
            new Request('https://example.com/api/system/export', {
                method: 'POST',
                body: JSON.stringify({}),
            }),
        ];

        for (const request of protectedRequests) {
            const response = await handleApiRequest(request, env);
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body).toEqual({ error: 'Unauthorized' });
        }
    });
});
