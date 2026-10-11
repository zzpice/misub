// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from './helpers/d1-sqlite.js';
import { StorageFactory, SettingsCache } from '../functions/storage-adapter.js';
import { refreshSourceSnapshot, readSourceSnapshot } from '../functions/services/source-snapshot-service.js';
import { fingerprintNode, updateRegionPreferences, readRegionPreferences } from '../functions/services/region-preferences.js';
import { incrementProfileDownload } from '../functions/services/profile-download-counter.js';
import yaml from 'js-yaml';
import { handleMisubRequest, extractProxySectionFromBuiltin } from '../functions/modules/subscription/main-handler.js';
import { ProcessorService } from '../functions/services/processor-service.js';
import { handleSubscriptionNodesRequest } from '../functions/modules/subscription/preview-handler.js';
import { handleDebugSubscriptionRequest } from '../functions/modules/handlers/debug-handler.js';
import { handleCleanNodesRequest, handleNodeCountRequest, handleBatchUpdateNodesRequest } from '../functions/modules/handlers/node-handler.js';
import { handleSourceSnapshotRefresh } from '../functions/modules/handlers/source-refresh-handler.js';
import { maybeRunScheduledTasks } from '../functions/modules/scheduled-task-runner.js';
import { buildBackupPayload, restoreBackupPayload, performWebdavBackup, handleBackupRestore } from '../functions/modules/webdav-backup-handler.js';
import { setCache } from '../functions/services/node-cache-service.js';
import { handleExportDataRequest } from '../functions/modules/handlers/debug-handler.js';
import { handleMisubsSave, handleDataRequest } from '../functions/modules/api-handler.js';

const source = { id: 's', url: 'https://source.example/sub', enabled: true };
const node = i => `trojan://synthetic-${i}@node${i}.example:443#JP-${i}`;
const databases = [];
async function fixture() {
    const db = createSqliteD1(); databases.push(db);
    const env = { MISUB_DB: db, MISUB_PERSONAL_MODE: 'true', ADMIN_PASSWORD: 'A'.repeat(32),
        COOKIE_SECRET: 'C'.repeat(32), SUBSCRIPTION_TOKEN: 'S'.repeat(32), PROFILE_TOKEN: 'P'.repeat(32) };
    const storage = StorageFactory.createAdapter(env, 'd1');
    await storage.putSubscription(source);
    return { db, storage, env };
}

describe('audit: actual D1 SQLite statements and concurrency', () => {
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); SettingsCache.clear(); databases.splice(0).forEach(db => db.close()); });
    it('merges a refresh metadata patch into a simultaneous administrator edit', async () => {
        const { db, storage } = await fixture();
        let injected = false;
        db.beforeRun = async sql => {
            if (!injected && sql.startsWith('UPDATE subscriptions SET data = ?')) {
                injected = true;
                await storage.putSubscription({ ...source, name: 'Admin edit', defaultRegion: '美国' });
            }
        };
        await storage.updateSubscriptionById(source.id, current => ({ ...current, nodeCount: 7 }));
        expect(await storage.getSubscriptionById(source.id)).toMatchObject({ name: 'Admin edit', defaultRegion: '美国', nodeCount: 7 });
    });
    it('does not resurrect a source deleted after a metadata read', async () => {
        const { db, storage } = await fixture();
        db.beforeRun = async sql => {
            if (sql.startsWith('UPDATE subscriptions SET data = ?')) await storage.deleteSubscriptionById(source.id);
        };
        expect(await storage.updateSubscriptionById(source.id, s => ({ ...s, nodeCount: 2 }))).toBeNull();
        expect(await storage.getSubscriptionById(source.id)).toBeNull();
    });
    it('merges simultaneous region edits and resets without losing other identities', async () => {
        const { storage } = await fixture();
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1), node(2)] }) });
        const [one, two] = await Promise.all([fingerprintNode(node(1)), fingerprintNode(node(2))]);
        await Promise.all([
            updateRegionPreferences(storage, source, [{ fingerprint: one, region: '美国' }]),
            updateRegionPreferences(storage, source, [{ fingerprint: two, region: '香港' }]),
        ]);
        expect((await readRegionPreferences(storage, source.id)).overrides).toEqual({ [one]: '美国', [two]: '香港' });
        await Promise.all([
            updateRegionPreferences(storage, source, [{ fingerprint: one, region: null }]),
            updateRegionPreferences(storage, source, [{ fingerprint: two, region: '新加坡' }]),
        ]);
        expect((await readRegionPreferences(storage, source.id)).overrides).toEqual({ [two]: '新加坡' });
    });
    it('fences a stalled writer when its D1 lease was replaced', async () => {
        const { db, storage } = await fixture();
        const result = await refreshSourceSnapshot({ storage, source, fetcher: async () => {
            const newer = { sourceUrl: source.url, nodes: [node(2)], nodeCount: 1, updatedAt: new Date().toISOString() };
            await storage.put('misub_source_snapshot_v1_s', newer);
            await db.prepare('UPDATE settings SET value = ? WHERE key = ?')
                .bind(`${Date.now() + 90000}:other-owner`, 'misub_source_lock_v1_s').run();
            return { nodes: [node(1)] };
        } });
        expect(result.success).toBe(false);
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual([node(2)]);
        expect(await storage.get('misub_source_attempt_v1_s')).toBeNull();
        expect(db.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('misub_source_lock_v1_s').value).toContain('other-owner');
    });
    it.each(['edit', 'delete'])('does not publish a snapshot after its source is %s during fetch', async action => {
        const { storage } = await fixture();
        const result = await refreshSourceSnapshot({ storage, source, fetcher: async () => {
            if (action === 'edit') await storage.putSubscription({ ...source, url: 'https://new.example/sub' });
            else await storage.deleteSubscriptionById(source.id);
            return { nodes: [node(1)] };
        } });
        expect(result.success).toBe(false);
        expect(await storage.get('misub_source_snapshot_v1_s')).toBeNull();
    });
    it('isolates pending fetches for identical source IDs in different databases', async () => {
        const first = await fixture(); const second = await fixture();
        const results = await Promise.all([first, second].map(({ storage }, i) =>
            refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(i)] }) })));
        expect(results.every(r => r.success)).toBe(true);
        expect((await readSourceSnapshot(first.storage, source)).nodes).toEqual([node(0)]);
        expect((await readSourceSnapshot(second.storage, source)).nodes).toEqual([node(1)]);
    });
    it('counts 100 concurrent successful downloads with the atomic SQL UPSERT', async () => {
        const { storage } = await fixture();
        await Promise.all(Array.from({ length: 100 }, () => incrementProfileDownload(storage, { id: 'p' })));
        expect(await storage.get('misub_profile_download_count_p')).toBe(100);
    });
    it('does not write legacy profile main blobs when saving only subscription changes', async () => {
        const { db, env, storage } = await fixture();
        await storage.putProfile({ id: 'p', enabled: true });
        const response = await handleMisubsSave(new Request('https://local.example/api/misubs', {
            method: 'POST', body: JSON.stringify({ diff: { subscriptions: { updated: [{ ...source, name: 'new' }] } } }),
        }), env);
        expect(response.status).toBe(200);
        expect(db.sqlite.prepare('SELECT data FROM profiles WHERE id = ?').get('main')).toBeUndefined();
        await storage.deleteProfileById('p');
        expect(await storage.getAllProfiles()).toEqual([]);
    });
    it('preserves a concurrently published snapshot during legacy cache migration', async () => {
        const { db, storage } = await fixture();
        await storage.put('node_cache_subscription_s', { nodes: [node(1)], updatedAt: new Date(0).toISOString() });
        let injected = false;
        db.beforeRun = async sql => {
            if (!injected && sql.includes('INSERT OR IGNORE INTO settings')) {
                injected = true;
                await storage.put('misub_source_snapshot_v1_s', { sourceUrl: source.url, nodes: [node(2)] });
            }
        };
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual([node(2)]);
    });
    it('does not let a failed expired writer replace a newer successful attempt', async () => {
        const { db, storage } = await fixture();
        await refreshSourceSnapshot({ storage, source, fetcher: async () => {
            await storage.put('misub_source_attempt_v1_s', { success: true, lastAttemptAt: 'newer' });
            await db.prepare('UPDATE settings SET value = ? WHERE key = ?')
                .bind(`${Date.now() + 90000}:new-owner`, 'misub_source_lock_v1_s').run();
            throw Error('Synthetic failure');
        } });
        expect((await storage.get('misub_source_attempt_v1_s')).success).toBe(true);
    });
    it.each(['clash', 'singbox', 'surge&ver=4', 'loon', 'quanx', 'egern'])(
        'retains a region correction in %s with emoji disabled, renaming and cache hits', async target => {
            const { storage, env } = await fixture();
            await storage.putSubscription({ ...source, autoUpdateEnabled: false });
            await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
            await updateRegionPreferences(storage, source, [{ fingerprint: await fingerprintNode(node(1)), region: '美国' }]);
            await storage.put('worker_settings_v1', { enableFlagEmoji: false, enableTrafficNode: false,
                defaultOperators: [{ type: 'rename', params: { regex: { enabled: true, rules: [{ pattern: '^.*$', replacement: 'Renamed' }] } } }] });
            const upstream = vi.fn(() => { throw Error('No external request allowed'); }); vi.stubGlobal('fetch', upstream);
            for (let i = 0; i < 2; i++) {
                const response = await handleMisubRequest({ env, request: new Request(
                    `https://local.example/${env.SUBSCRIPTION_TOKEN}?target=${target}&engine=external`,
                    { headers: { 'User-Agent': 'SyntheticClient' } }), waitUntil: vi.fn() });
                expect(response.status).toBe(200);
                const output = await response.text();
                expect(output).toContain('美国节点');
                expect(output).not.toContain('日本节点');
                expect(output).toContain('Renamed');
                if (target === 'clash') expect(yaml.load(output).proxies[0].name).not.toMatch(/🇺🇸/);
                if (target === 'singbox') expect(JSON.parse(output).outbounds.filter(p => p.server)[0].tag).not.toMatch(/🇺🇸/);
            }
            expect(upstream).not.toHaveBeenCalled();
        }
    );
    it('uses authoritative snapshot traffic for raw output and virtual nodes after metadata drift', async () => {
        const { storage, env } = await fixture();
        await storage.putSubscription({ ...source, autoUpdateEnabled: false, userInfo: { total: 1 } });
        await storage.put('worker_settings_v1', { enableTrafficNode: true });
        await storage.put('misub_source_snapshot_v1_s', { sourceUrl: source.url, nodes: [node(1)],
            updatedAt: new Date().toISOString(), userInfo: { total: 10737418240, download: 1073741824 } });
        const response = await handleMisubRequest({ env, request: new Request(
            `https://local.example/${env.SUBSCRIPTION_TOKEN}?target=nodes`, { headers: { 'User-Agent': 'SyntheticClient' } }) });
        expect(response.status).toBe(200);
        expect(response.headers.get('Subscription-Userinfo')).toContain('total=10737418240');
        expect(decodeURIComponent(await response.text())).toContain('9 GB');
    });
    it('returns 502 without counting a download when structured conversion fails', async () => {
        const { storage, env } = await fixture();
        await storage.putSubscription({ ...source, autoUpdateEnabled: false });
        await storage.putProfile({ id: 'p', enabled: true, subscriptions: ['s'], manualNodes: [] });
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
        vi.spyOn(ProcessorService, 'renderOutput').mockRejectedValue(new Error('Synthetic conversion failure'));
        const response = await handleMisubRequest({ env, request: new Request(
            `https://local.example/${env.PROFILE_TOKEN}/p?target=clash`, { headers: { 'User-Agent': 'SyntheticClient' } }) });
        expect(response.status).toBe(502);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(await storage.get('misub_profile_download_count_p')).toBeNull();
    });
    it('lists only sing-box connection outbounds, excluding policy groups', () => {
        const content = JSON.stringify({ outbounds: [{ type: 'trojan', tag: 'n', server: 'example.com' },
            { type: 'selector', tag: 's', outbounds: ['n'] }, { type: 'urltest', tag: 't', outbounds: ['n'] },
            { type: 'direct', tag: 'direct' }] });
        expect(JSON.parse(extractProxySectionFromBuiltin(content, 'singbox'))).toEqual([
            { type: 'trojan', tag: 'n', server: 'example.com' },
        ]);
    });
    it('preserves preview 404, and decodes Response bodies for debug and profile cleanup', async () => {
        const { storage, env } = await fixture();
        const request = body => new Request('https://local.example/api/subscription_nodes', { method: 'POST', body: JSON.stringify(body) });
        expect((await handleSubscriptionNodesRequest(request({ profileId: 'missing' }), env)).status).toBe(404);
        await storage.putProfile({ id: 'p', enabled: true, subscriptions: ['s'], manualNodes: [] });
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1), node(1)] }) });
        const debug = await handleDebugSubscriptionRequest(request({ profileId: 'p' }), env);
        expect((await debug.json()).success).toBe(true);
        const cleaned = await handleCleanNodesRequest(request({ profileId: 'p' }), env);
        expect((await cleaned.json()).success).toBe(true);
    });
    it('rejects oversized manual refresh bodies without a Content-Length header', async () => {
        const response = await handleSourceSnapshotRefresh(new Request('https://local.example/api/source_refresh', {
            method: 'POST', body: JSON.stringify({ subscriptionId: 's', padding: 'x'.repeat(5000) }),
        }), {});
        expect(response.status).toBe(413);
    });
    it('prunes only expired aggregate variants, retaining durable and legacy source snapshots', async () => {
        const { storage } = await fixture();
        const expired = { nodes: node(1), timestamp: Date.now() - 13 * 3600000 };
        for (const key of ['node_cache_profile_p_v_old', 'node_cache_token_t_v_old', 'node_cache_subscription_s',
            'misub_source_snapshot_v1_s', 'misub_region_preferences_v1_s']) await storage.put(key, expired);
        await storage.put('node_cache_profile_p_v_legacy', { ...expired, nodes: [node(2)] });
        expect(await setCache(storage, 'node_cache_profile_p_v_current', node(2))).toBe(true);
        expect(await storage.get('node_cache_profile_p_v_old')).toBeNull();
        expect(await storage.get('node_cache_token_t_v_old')).toBeNull();
        for (const key of ['node_cache_subscription_s', 'misub_source_snapshot_v1_s', 'misub_region_preferences_v1_s',
            'node_cache_profile_p_v_legacy', 'node_cache_profile_p_v_current']) expect(await storage.get(key)).not.toBeNull();
    });
    it('allows only one concurrent scheduled D1 backup and preserves settings edited during upload', async () => {
        const { storage, env } = await fixture();
        await storage.put('worker_settings_v1', { FileName: 'Old', webdavBackup: { enabled: true, autoBackup: true,
            endpoint: 'https://dav.example/', username: 'synthetic', password: 'synthetic' } });
        const uploads = vi.fn(async (url, init) => {
            if (init.method === 'PUT') {
                await storage.updateSettingsByKey('worker_settings_v1', value => ({ ...value, FileName: 'Admin edit' }));
            }
            return new Response(null, { status: 201 });
        }); vi.stubGlobal('fetch', uploads);
        const tasks = [];
        const results = await Promise.all(Array.from({ length: 5 }, () => maybeRunScheduledTasks({ env,
            waitUntil: promise => tasks.push(promise) }, { forceRun: true, forceCheck: true })));
        await Promise.all(tasks);
        expect(results.filter(r => r.scheduled)).toHaveLength(1);
        expect(uploads.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(1);
        expect((await storage.get('worker_settings_v1')).FileName).toBe('Admin edit');
        expect(await storage.get('misub_webdav_backup_lock')).toBeNull();
    });
    it('does not replay a WebDAV backup body to a cross-origin redirect', async () => {
        const { storage, env } = await fixture();
        await storage.put('worker_settings_v1', { webdavBackup: { endpoint: 'https://dav.example/',
            username: 'synthetic', password: 'synthetic' } });
        const uploads = vi.fn(async (url, init) => new Response(null, init.method === 'MKCOL'
            ? { status: 201 } : { status: 307, headers: { Location: 'https://other.example/collect' } }));
        vi.stubGlobal('fetch', uploads);
        await expect(performWebdavBackup(env)).rejects.toThrow('WebDAV redirect rejected');
        expect(uploads.mock.calls.every(([url]) => new URL(url).hostname === 'dav.example')).toBe(true);
    });

    it('applies corrected regions to source filters in downloads and transformed profile previews', async () => {
        const { storage, env } = await fixture();
        await storage.putSubscription({ ...source, autoUpdateEnabled: false, operators: [{ type: 'filter',
            params: { regions: { enabled: true, values: ['美国'] } } }] });
        await storage.put('worker_settings_v1', { enableFlagEmoji: false });
        await storage.putProfile({ id: 'p', enabled: true, subscriptions: ['s'], manualNodes: [] });
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1), node(2)] }) });
        await updateRegionPreferences(storage, source, [{ fingerprint: await fingerprintNode(node(1)), region: '美国' }]);
        const request = new Request('https://local.example/api/subscription_nodes', { method: 'POST',
            body: JSON.stringify({ profileId: 'p', applyTransform: true }) });
        const preview = await (await handleSubscriptionNodesRequest(request, env)).json();
        expect(preview.nodes).toHaveLength(1);
        expect(preview.nodes[0].region).toBe('美国');
        const response = await handleMisubRequest({ env, request: new Request(
            `https://local.example/${env.PROFILE_TOKEN}/p?target=nodes`, { headers: { 'User-Agent': 'Synthetic' } }) });
        expect(await response.text()).toContain('node1.example');
        expect(await storage.get('misub_profile_download_count_p')).toBe(1);
    });
    it('exports current row-level data with the correct version and actual settings key', async () => {
        const { env, storage } = await fixture();
        await storage.putProfile({ id: 'p', name: 'Synthetic' });
        await storage.put('worker_settings_v1', { FileName: 'Synthetic', webdavBackup: { password: 'synthetic-password' } });
        const request = new Request('https://local.example/api/export_data', { method: 'POST', body: JSON.stringify({ includeSettings: true }) });
        const exported = await (await handleExportDataRequest(request, env)).json();
        expect(exported.exportData.exportInfo.version).toBe('1.0.0');
        expect(exported.metadata.subscriptionsCount).toBe(1);
        expect(exported.metadata.profilesCount).toBe(1);
        expect(exported.exportData.data.settings.FileName).toBe('Synthetic');
        expect(JSON.stringify(exported)).not.toContain('synthetic-password');
    });

    it('reads current D1 rows for node-count metadata and batch diagnostics', async () => {
        const { storage, env } = await fixture();
        vi.stubGlobal('fetch', vi.fn(async () => new Response(node(1), {
            headers: { 'Subscription-Userinfo': 'total=100; download=1' },
        })));
        const request = body => new Request('https://local.example/api/node_count', { method: 'POST', body: JSON.stringify(body) });
        expect((await (await handleNodeCountRequest(request({ url: source.url }), env)).json()).success).toBe(true);
        expect((await storage.getSubscriptionById(source.id)).nodeCount).toBe(1);
        const batch = await (await handleBatchUpdateNodesRequest(request({ subscriptionIds: ['s'] }), env)).json();
        expect(batch.summary.successfulUpdates).toBe(1);
    });
    it('counts successful GETs independently of logs, excluding HEAD and unauthorized requests', async () => {
        const { db, storage, env } = await fixture();
        await storage.putSubscription({ ...source, autoUpdateEnabled: false });
        await storage.putProfile({ id: 'p', enabled: true, subscriptions: ['s'], manualNodes: [] });
        await storage.put('worker_settings_v1', { enableAccessLog: false });
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
        const tasks = [];
        const run = (method, token) => handleMisubRequest({ env, waitUntil: task => tasks.push(task),
            request: new Request(`https://local.example/${token}/p?target=nodes`, { method,
                headers: { 'User-Agent': 'SyntheticClient' } }) });
        expect((await run('GET', env.PROFILE_TOKEN)).status).toBe(200);
        expect((await run('GET', env.PROFILE_TOKEN)).status).toBe(200);
        await run('HEAD', env.PROFILE_TOKEN);
        await run('GET', 'invalid-token');
        await Promise.all(tasks);
        expect(await storage.get('misub_profile_download_count_p')).toBe(2);
        expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings WHERE key LIKE 'misub_system_logs%'").get().count).toBe(0);
    });
    it('does not send the WebDAV password to the dashboard data cache', async () => {
        const { env, storage } = await fixture();
        await storage.put('worker_settings_v1', { webdavBackup: { password: 'synthetic-private-password' } });
        const tasks = [];
        const response = await handleDataRequest(env, { env, waitUntil: task => tasks.push(task) });
        expect((await response.json()).config.webdavBackup.password).toBe('');
        await Promise.all(tasks);
        expect((await storage.get('worker_settings_v1')).webdavBackup.password).toBe('synthetic-private-password');
    });

    it('keeps atomic counts through alias edits and preserves the legacy counter', async () => {
        const { storage, env } = await fixture();
        const profile = { id: 'p', customId: 'old', subscriptions: ['s'] };
        await storage.putProfile(profile);
        await storage.put('misub_profile_download_count_old', 7);
        const save = await handleMisubsSave(new Request('https://local.example/api/misubs', {
            method: 'POST', body: JSON.stringify({ diff: { profiles: { updated: [{ ...profile, customId: 'new', downloadCount: 0 }] } } }),
        }), env);
        expect(save.status).toBe(200);
        const renamed = await storage.getProfileById('p');
        expect(renamed.downloadCount).toBe(7);
        await Promise.all(Array.from({ length: 20 }, () => incrementProfileDownload(storage, renamed)));
        expect(await storage.get('misub_profile_download_count_p')).toBe(27);
        expect(await storage.get('misub_profile_download_count_old')).toBe(7);
    });
    it('round trips durable snapshots, corrections and counts without an upstream request', async () => {
        const { storage, env } = await fixture();
        await storage.putSubscription({ ...source, autoUpdateEnabled: false });
        await storage.putProfile({ id: 'p', enabled: true, subscriptions: ['s'] });
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
        const fingerprint = await fingerprintNode(node(1));
        await updateRegionPreferences(storage, source, [{ fingerprint, region: '美国' }]);
        await incrementProfileDownload(storage, { id: 'p' });
        const payload = await buildBackupPayload(env);
        const target = await fixture();
        await restoreBackupPayload(target.env, payload, { createSnapshot: false });
        vi.stubGlobal('fetch', vi.fn(() => { throw Error('offline'); }));
        expect((await readSourceSnapshot(target.storage, source)).nodes).toEqual([node(1)]);
        expect((await readRegionPreferences(target.storage, 's')).overrides[fingerprint]).toBe('美国');
        expect(await target.storage.get('misub_profile_download_count_p')).toBe(1);
        const response = await handleMisubRequest({ env: target.env, waitUntil() {}, request: new Request(
            `https://local.example/${target.env.PROFILE_TOKEN}/p?target=clash&emoji=false`) });
        expect(response.status).toBe(200);
        expect(yaml.load(await response.text())['proxy-groups'].some(g => g.name.includes('美国'))).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });
    it('accepts old backups without deleting snapshots and rejects malformed additions before writing', async () => {
        const { storage, env } = await fixture();
        await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
        const legacy = { subscriptions: [source], profiles: [] };
        await restoreBackupPayload(env, legacy, { createSnapshot: false });
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual([node(1)]);
        const bad = { type: 'misub-backup', data: { subscriptions: [], profiles: [], sourceSnapshots: { s: { nodes: [node(2)] } } } };
        await expect(restoreBackupPayload(env, bad)).rejects.toThrow('备份');
        expect(await storage.getSubscriptionById('s')).toMatchObject(source);
        expect(await storage.get('misub_restore_snapshot_latest')).toBeNull();
        await expect(restoreBackupPayload(env, { type: 'misub-backup', data: {} })).rejects.toThrow('集合');
    });

    it('bounds streamed JSON restore bodies even without Content-Length', async () => {
        const { storage, env } = await fixture();
        let cancelled = false;
        const body = new ReadableStream({
            pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
            cancel() { cancelled = true; },
        });
        const response = await handleBackupRestore(new Request('https://local.example/api/backup/restore', {
            method: 'POST', body, duplex: 'half',
        }), env);
        expect(response.status).toBe(413);
        expect(cancelled).toBe(true);
        expect(await storage.getSubscriptionById('s')).toMatchObject(source);
    });

    it('keeps legacy-only source refresh working and does not resurrect explicitly deleted legacy items', async () => {
        const { db, storage } = await fixture();
        await storage.deleteSubscriptionById('s');
        await storage.put('misub_subscriptions_v1', [source, { id: 'other', url: 'https://other.example/sub' }]);
        await storage.put('misub_profiles_v1', [{ id: 'p', name: 'old' }, { id: 'q' }]);
        expect((await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) })).success).toBe(true);
        await storage.putProfile({ id: 'p', name: 'new' });
        expect((await storage.getAllProfiles()).find(p => p.id === 'p').name).toBe('new');
        await storage.deleteSubscriptionById('s');
        await storage.deleteProfileById('p');
        expect(await storage.getSubscriptionById('s')).toBeNull();
        expect(await storage.getSubscriptionsByIds(['s'])).toEqual([]);
        expect((await storage.getAllSubscriptions()).map(s => s.id)).toEqual(['other']);
        expect(await storage.getProfileById('p')).toBeNull();
        expect((await storage.getAllProfiles()).map(p => p.id)).toEqual(['q']);
        expect(db.sqlite.prepare('SELECT data FROM profiles WHERE id = ?').get('main')).toBeDefined();
    });
    it('rolls back legacy cleanup if its row deletion fails', async () => {
        const { db, storage } = await fixture();
        await storage.put('misub_subscriptions_v1', [source]);
        db.beforeRun = sql => { if (sql.startsWith('DELETE FROM subscriptions')) throw Error('synthetic deletion failure'); };
        await expect(storage.deleteSubscriptionById('s')).rejects.toThrow('synthetic deletion failure');
        db.beforeRun = null;
        expect(await storage.get('misub_subscriptions_v1')).toEqual([source]);
        expect(await storage.getSubscriptionById('s')).toMatchObject(source);
    });

    it('never lets a stale legacy URL bypass a current row-level source edit', async () => {
        const { storage } = await fixture();
        await storage.put('misub_subscriptions_v1', [source]);
        await storage.putSubscription({ ...source, url: 'https://new.example/sub' });
        const result = await refreshSourceSnapshot({ storage, source, fetcher: async () => ({ nodes: [node(1)] }) });
        expect(result.success).toBe(false);
        expect(await storage.get('misub_source_snapshot_v1_s')).toBeNull();
    });

});
