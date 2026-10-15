import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getStorageType: vi.fn(),
    createAdapter: vi.fn(),
    fetchRemoteSourceSnapshot: vi.fn(),
}));

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        getStorageType: (...args) => mocks.getStorageType(...args),
        createAdapter: (...args) => mocks.createAdapter(...args),
    },
}));
vi.mock('../../functions/services/subscription-service.js', () => ({
    fetchRemoteSourceSnapshot: (...args) => mocks.fetchRemoteSourceSnapshot(...args),
}));

const nodeA = 'vless://11111111-1111-4111-8111-111111111111@host.example:443#US';
const nodeB = 'trojan://password@other.example:443#JP';

function createStorage(sources) {
    const records = new Map();
    const subscriptions = structuredClone(sources);
    const storage = {
        getAllSubscriptions: vi.fn(async () => subscriptions),
        get: vi.fn(async (key) => structuredClone(records.get(key) ?? null)),
        put: vi.fn(async (key, value) => {
            records.set(key, structuredClone(value));
        }),
        updateSubscriptionById: vi.fn(async (id, updater) => {
            const index = subscriptions.findIndex((item) => item.id === id);
            if (index !== -1) subscriptions[index] = updater(subscriptions[index]);
        }),
        putAllSubscriptions: vi.fn(),
        records,
        subscriptions,
    };
    mocks.createAdapter.mockReturnValue(storage);
    return storage;
}

describe('unified cron snapshot refresh', () => {
    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.createAdapter.mockReset();
        mocks.getStorageType.mockReset().mockResolvedValue('d1');
        mocks.fetchRemoteSourceSnapshot.mockReset().mockResolvedValue({
            nodes: [nodeA, nodeB],
            userInfo: { upload: 1, download: 2, total: 10 },
        });
    });

    it('uses row-level D1 helpers, stores full snapshots and updates metadata without bulk writes', async () => {
        const storage = createStorage([
            { id: 's1', name: 'Active', url: 'https://example.com/sub', enabled: true },
            { id: 's2', name: 'Disabled', url: 'https://example.com/other', enabled: false },
        ]);
        const { handleCronTrigger } =
            await import('../../functions/modules/subscription-refresh.js');
        const payload = await (await handleCronTrigger({})).json();

        expect(payload.summary).toMatchObject({
            total: 1,
            updated: 1,
            failed: 0,
            skipped: 0,
            changes: true,
        });
        expect(storage.getAllSubscriptions).toHaveBeenCalledTimes(1);
        expect(storage.records.get('misub_source_snapshot_v1_s1')).toMatchObject({
            sourceUrl: 'https://example.com/sub',
            nodes: [nodeA, nodeB],
            nodeCount: 2,
        });
        expect(storage.subscriptions[0]).toMatchObject({
            nodeCount: 2,
            userInfo: { upload: 1, download: 2, total: 10 },
        });
        expect(storage.putAllSubscriptions).not.toHaveBeenCalled();
        expect(mocks.fetchRemoteSourceSnapshot).toHaveBeenCalledTimes(1);
    });

    it('preserves the old snapshot when the upstream fails', async () => {
        const storage = createStorage([
            { id: 's1', name: 'Failing', url: 'https://example.com/sub', enabled: true },
        ]);
        storage.records.set('misub_source_snapshot_v1_s1', {
            sourceId: 's1',
            sourceUrl: 'https://example.com/sub',
            nodes: [nodeA],
            nodeCount: 1,
            updatedAt: '2020-01-01T00:00:00.000Z',
        });
        mocks.fetchRemoteSourceSnapshot.mockRejectedValue(new Error('HTTP 403'));

        const { handleCronTrigger } =
            await import('../../functions/modules/subscription-refresh.js');
        const payload = await (await handleCronTrigger({})).json();

        expect(payload.summary).toMatchObject({
            total: 1,
            updated: 0,
            failed: 1,
            preserved: 1,
            changes: false,
        });
        expect(storage.records.get('misub_source_snapshot_v1_s1').nodes).toEqual([nodeA]);
        expect(storage.putAllSubscriptions).not.toHaveBeenCalled();
    });

    it('respects disabled auto-update, fresh snapshots and retry backoff', async () => {
        const storage = createStorage([
            {
                id: 'off',
                name: 'Off',
                url: 'https://example.com/off',
                enabled: true,
                autoUpdateEnabled: false,
            },
            {
                id: 'fresh',
                name: 'Fresh',
                url: 'https://example.com/fresh',
                enabled: true,
                autoUpdateIntervalMinutes: 60,
            },
            { id: 'retry', name: 'Retry', url: 'https://example.com/retry', enabled: true },
        ]);
        storage.records.set('misub_source_snapshot_v1_fresh', {
            sourceUrl: 'https://example.com/fresh',
            nodes: [nodeA],
            nodeCount: 1,
            updatedAt: new Date().toISOString(),
        });
        storage.records.set('misub_source_attempt_v1_retry', {
            lastAttemptAt: new Date().toISOString(),
            success: false,
        });
        const { handleCronTrigger } =
            await import('../../functions/modules/subscription-refresh.js');
        const payload = await (await handleCronTrigger({})).json();
        expect(payload.summary).toMatchObject({
            total: 3,
            updated: 0,
            skipped: 3,
            failed: 0,
        });
        expect(mocks.fetchRemoteSourceSnapshot).not.toHaveBeenCalled();
    });
});
