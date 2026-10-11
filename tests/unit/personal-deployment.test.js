// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { applyPersonalSettings } from '../../functions/modules/personal-mode.js';
import { getAdminPassword, getCookieSecret } from '../../functions/modules/utils.js';
import {
    handleLogin,
    authMiddleware,
    createSignedToken,
    getSessionSigningKey,
    getAuthSessionDiagnostic,
} from '../../functions/modules/auth-middleware.js';
import { StorageFactory, SettingsCache } from '../../functions/storage-adapter.js';
import {
    handleApiRequest,
    handleExternalFetchRequest,
} from '../../functions/modules/api-router.js';
import { handleSettingsReset, handleSettingsSave } from '../../functions/modules/api-handler.js';
import {
    createCacheHeaders,
    setCache,
    getCache,
} from '../../functions/services/node-cache-service.js';
import {
    generateCombinedNodeList,
    buildSubscriptionNodeCacheKey,
} from '../../functions/services/subscription-service.js';
import { resolveNodeListWithCache } from '../../functions/modules/subscription/cache-manager.js';
import { fetchWithRetry } from '../../functions/services/fetch-utils.js';
import { fetchSubscriptionNodes } from '../../functions/modules/subscription/node-fetcher.js';

function environment() {
    return {
        MISUB_PERSONAL_MODE: 'true',
        ADMIN_PASSWORD: 'test-admin-'.padEnd(48, 'a'),
        COOKIE_SECRET: 'test-cookie-'.padEnd(64, 'b'),
        SUBSCRIPTION_TOKEN: 'test-subscription-'.padEnd(48, 'c'),
        PROFILE_TOKEN: 'test-profile-'.padEnd(48, 'd'),
    };
}

describe('independent personal deployment', () => {
    it('migrates legacy D1 source caches to permanent snapshots regardless of original age', async () => {
        const sub = {
            id: 'fixture',
            url: 'https://example.com/sub',
            enabled: true,
            enableNodeCache: true,
            autoUpdateEnabled: false,
        };
        const legacyKey = buildSubscriptionNodeCacheKey(sub);
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('Upstream unavailable')
        );
        try {
            for (const age of [6 * 3600000, 13 * 3600000, null]) {
                const timestamp = age === null ? null : Date.now() - age;
                const initial = {
                    nodes: ['trojan://fixture@192.0.2.2:443#Cached'],
                    updatedAt: timestamp === null ? '' : new Date(timestamp).toISOString(),
                };
                const records = new Map([[legacyKey, initial]]);
                const storage = {
                    get: async (key) => records.get(key) ?? null,
                    put: vi.fn(async (key, value) => { records.set(key, value); }),
                };
                const context = { env: environment(), storage };
                const result = await generateCombinedNodeList(
                    context,
                    { enableAccessLog: false },
                    'MiSub-test',
                    [sub],
                    '',
                    { enableSubscriptions: false }
                );
                expect(result).toContain('Cached');
                const durable = records.get('misub_source_snapshot_v1_fixture');
                expect(durable.nodes).toEqual(initial.nodes);
                expect(durable.updatedAt).toBe(
                    timestamp === null ? new Date(0).toISOString() : initial.updatedAt
                );
                expect(durable.migratedLegacy).toBe(true);
                expect(storage.put).toHaveBeenCalledOnce();
            }
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            fetchMock.mockRestore();
        }
    });

    it('does not reset old source age when caching a mixed result', async () => {
        const timestamp = Date.now() - 6 * 3600000;
        let cached = null;
        const storage = {
            get: async () => cached,
            put: async (_key, value) => {
                cached = value;
            },
        };
        const nodes = 'trojan://fixture@192.0.2.2:443#Cached';
        await setCache(storage, 'fixture-cache', nodes, [], {
            timestamp,
            sourceCacheFallback: true,
        });
        expect(cached.timestamp).toBe(timestamp);
        expect((await getCache(storage, 'fixture-cache')).status).toBe('stale');
        const context = {};
        const result = await resolveNodeListWithCache({
            storageAdapter: { get: async () => null },
            cacheKey: 'fixture-cache',
            forceRefresh: false,
            refreshNodes: async () => {
                context.cachedFallbackTimestamp = timestamp;
                return nodes;
            },
            context,
            targetMisubsCount: 1,
        });
        expect(result.cacheHeaders['X-Cache-Status']).toBe('REFRESHING');
        expect(result.cacheHeaders['X-Cache-Time']).toBe(new Date(timestamp).toISOString());
        expect(result.cacheHeaders.Warning).toContain('stale');
    });
    it('keeps external-fetch errors out of logs and API responses', async () => {
        const url = 'https://raw.githubusercontent.com/fixture/private-fixture-token';
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error(`upstream failed at ${url}`));
        const logMock = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const response = await handleExternalFetchRequest(
                new Request('https://example.com/api/fetch_external_url', {
                    method: 'POST',
                    body: JSON.stringify({ url }),
                }),
                environment()
            );
            expect(response.status).toBe(500);
            expect(await response.text()).not.toContain('private-fixture-token');
            expect(JSON.stringify(logMock.mock.calls)).not.toContain('private-fixture-token');
        } finally {
            fetchMock.mockRestore();
            logMock.mockRestore();
        }
    });
    it('reads current D1 collections after a write by another isolate', async () => {
        const env = environment();
        let records = [{ id: 'before', enabled: true }];
        env.MISUB_DB = {
            prepare: () => ({
                all: async () => ({
                    results: records.map((record) => ({ data: JSON.stringify(record) })),
                }),
            }),
        };
        const adapter = StorageFactory.createAdapter(env);
        expect((await adapter.getAllSubscriptions())[0].id).toBe('before');
        expect((await adapter.getAllProfiles())[0].id).toBe('before');
        records = [{ id: 'after', enabled: true }];
        expect((await adapter.getAllSubscriptions())[0].id).toBe('after');
        expect((await adapter.getAllProfiles())[0].id).toBe('after');
    });
    it('returns a safe failure when a remote subscription fetch throws', async () => {
        const original = globalThis.fetch;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        globalThis.fetch = vi.fn(async () => {
            throw new Error('fixture network failure');
        });
        vi.useFakeTimers();
        try {
            const resultPromise = fetchSubscriptionNodes(
                'https://fixture.example/sub',
                'Fixture',
                'MiSub-test'
            );
            await vi.runAllTimersAsync();
            const result = await resultPromise;
            expect(result.success).toBe(false);
            expect(result.nodes).toEqual([]);
            expect(result.error).toContain('Subscription fetch failed');
        } finally {
            vi.useRealTimers();
            globalThis.fetch = original;
            warn.mockRestore();
        }
    });
    it('does not log or return subscription URL credentials after fetch failure', async () => {
        const url = 'https://fixture.example/sub/private-fixture-token';
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const original = globalThis.fetch;
        globalThis.fetch = vi.fn(async () => {
            throw new Error(`network failure: ${url}`);
        });
        try {
            await expect(fetchWithRetry(url, {}, { maxRetries: 1, baseDelay: 0 })).rejects.toThrow(
                'Subscription fetch failed'
            );
            expect(warn.mock.calls.flat().join(' ')).not.toContain('private-fixture-token');
        } finally {
            globalThis.fetch = original;
            warn.mockRestore();
        }
    });
    it('fails closed for missing or reused credentials', async () => {
        const env = environment();
        delete env.ADMIN_PASSWORD;
        await expect(getAdminPassword(env)).rejects.toThrow(/Secrets/);
        const reused = environment();
        reused.PROFILE_TOKEN = reused.SUBSCRIPTION_TOKEN;
        expect(() => applyPersonalSettings({}, reused)).toThrow(/Secrets/);
    });

    it('uses Secrets despite stale or unavailable auth KV', async () => {
        const env = environment();
        env.MISUB_KV = {
            get: vi.fn(() => {
                throw new Error('KV outage');
            }),
        };
        expect(await getAdminPassword(env)).toBe(env.ADMIN_PASSWORD);
        expect(await getCookieSecret(env)).toBe(env.COOKIE_SECRET);
        expect(env.MISUB_KV.get).not.toHaveBeenCalled();
    });

    it('rejects the default password and signs a secure valid session', async () => {
        const env = environment();
        const login = (password) =>
            handleLogin(
                new Request('https://example.com/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                }),
                env
            );
        expect((await login('admin')).status).toBe(401);
        const response = await login(env.ADMIN_PASSWORD);
        const cookie = response.headers.get('Set-Cookie');
        expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax;/);
        expect(cookie).not.toContain(env.ADMIN_PASSWORD);
        const request = new Request('https://example.com/api/data', {
            headers: { Cookie: cookie.split(';')[0] },
        });
        expect(await authMiddleware(request, env)).toBe(true);
        expect(
            await authMiddleware(request, {
                ...env,
                ADMIN_PASSWORD: 'changed-password-'.padEnd(48, 'x'),
            })
        ).toBe(false);
    });

    it('rejects future timestamps and malformed signed session timestamps', async () => {
        const env = environment();
        for (const value of [String(Date.now() + 60000), `${Date.now()}invalid`]) {
            const token = await createSignedToken(await getSessionSigningKey(env), value);
            const result = await getAuthSessionDiagnostic(
                new Request('https://example.com', {
                    headers: { Cookie: `auth_session=${token}` },
                }),
                env
            );
            expect(result.isAuthenticated).toBe(false);
        }
    });

    it('pins D1 and refuses fallback when the binding is missing', async () => {
        const env = environment();
        await expect(StorageFactory.getStorageType(env)).rejects.toThrow(/MISUB_DB/);
        expect(() => StorageFactory.createAdapter(env, 'kv')).toThrow(/MISUB_DB/);
        env.MISUB_DB = {};
        expect(await StorageFactory.getStorageType(env)).toBe('d1');
        expect(StorageFactory.createAdapter(env, 'kv').type).toBe('d1');
    });

    it('propagates D1 failures without reading a stale KV settings copy', async () => {
        const env = environment();
        env.MISUB_DB = {
            prepare: () => {
                throw new Error('database outage');
            },
        };
        env.MISUB_KV = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
        await expect(SettingsCache.get(env)).rejects.toThrow(/D1 read unavailable/);
        await expect(StorageFactory.createAdapter(env).getAllSubscriptions()).rejects.toThrow(
            /D1 read unavailable/
        );
        expect(env.MISUB_KV.get).not.toHaveBeenCalled();
    });

    it('protects defaults and restored settings with the deployment Secrets', () => {
        const env = environment();
        const config = applyPersonalSettings(
            {
                mytoken: 'auto',
                profileToken: 'profiles',
                enablePublicPage: true,
                storageType: 'kv',
            },
            env
        );
        expect(config.mytoken).toBe(env.SUBSCRIPTION_TOKEN);
        expect(config.profileToken).toBe(env.PROFILE_TOKEN);
        expect(config.storageType).toBe('d1');
        expect(config.externalApi.enabled).toBe(false);
        expect(config.subconverter.engineMode).toBe('builtin');
    });

    it('disables visitor, client, telemetry and KV migration endpoints', async () => {
        const env = environment();
        for (const path of [
            '/public/profiles',
            '/public/preview',
            '/public/guestbook',
            '/system/error_report',
            '/migrate',
            '/migrate_to_d1',
        ]) {
            expect(
                (await handleApiRequest(new Request(`https://example.com/api${path}`), env)).status
            ).toBe(404);
        }
        expect(
            (await handleApiRequest(new Request('https://example.com/api/clients'), env)).status
        ).toBe(404);
    });

    it('rejects settings reset and token changes that would desynchronize the vault', async () => {
        const env = environment();
        expect((await handleSettingsReset(env)).status).toBe(400);
        const response = await handleSettingsSave(
            new Request('https://example.com/api/settings', {
                method: 'POST',
                body: JSON.stringify({ profileToken: 'profiles' }),
            }),
            env
        );
        expect(response.status).toBe(400);
    });

    it('reports the original time and age of stale data', () => {
        const timestamp = Date.now() - 3600000;
        const headers = createCacheHeaders('REFRESHING', 3, timestamp);
        expect(headers['X-Cache-Time']).toBe(new Date(timestamp).toISOString());
        expect(Number(headers['X-Cache-Age'])).toBeGreaterThanOrEqual(3600);
        expect(headers.Warning).toContain('stale');
    });
});
