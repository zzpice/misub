import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { handleSingleSubscriptionMode } from '../../functions/modules/subscription/single-subscription.js';
import { handleProfileMode } from '../../functions/modules/subscription/profile-handler.js';
import { fetchPreviewSourceNodes } from '../../functions/modules/subscription/preview-source.js';

const createAdapter = vi.fn();
vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: vi.fn(async () => 'd1'),
    },
}));

const url = 'https://upstream.test/private';
const SOURCE = {
    id: 'source-1',
    name: 'Airport',
    url,
    enabled: true,
    autoUpdateEnabled: false,
    nodeCount: 89,
    lastSuccessAt: '2026-10-11T01:42:34Z',
};
const RAW = [
    'trojan://pass@server.example:443#HongKong-1',
    'vless://11111111-1111-4111-8111-111111111111@server2.example:443#HongKong-2',
];
const snapshotKey = 'misub_source_snapshot_v1_source-1';

function fixture(override = {}) {
    const records = new Map([
        ['worker_settings_v1', { defaultOperators: [] }],
        ...Object.entries(override),
    ]);
    const adapter = {
        get: vi.fn(async (key) => records.get(key) ?? null),
        put: vi.fn(async (key, value) => { records.set(key, value); }),
        getSubscriptionById: vi.fn(async () => SOURCE),
        getProfileById: vi.fn(async () => ({
            id: 'profile-1', enabled: true, subscriptions: ['source-1'], manualNodes: [],
        })),
        getSubscriptionsByIds: vi.fn(async () => [SOURCE]),
    };
    createAdapter.mockReturnValue(adapter);
    return adapter;
}

describe('personal previews use durable saved snapshots', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it('shows cached nodes with no upstream requests even when auto-update is disabled', async () => {
        const adapter = fixture({
            [snapshotKey]: {
                sourceUrl: url, nodes: RAW, nodeCount: RAW.length,
                updatedAt: '2026-10-10T00:00:00.000Z',
            },
        });
        const upstream = vi.fn(async () => { throw Error('Upstream is expired'); });
        vi.stubGlobal('fetch', upstream);
        const env = { MISUB_PERSONAL_MODE: 'true' };

        const single = await handleSingleSubscriptionMode(
            new Request('https://misub.test/api/subscription_nodes'),
            env,
            SOURCE.id,
            'MiSub-Node-Preview/1.0'
        );
        const profile = await handleProfileMode(
            new Request('https://misub.test/api/subscription_nodes'),
            env,
            'profile-1',
            'MiSub-Node-Preview/1.0'
        );

        expect(single.success).toBe(true);
        expect(profile.success).toBe(true);
        expect(single.totalCount).toBe(2);
        expect(profile.totalCount).toBe(2);
        expect(single.nodes.map((node) => node.name)).toEqual(['HongKong-1', 'HongKong-2']);
        expect(upstream).not.toHaveBeenCalled();
        expect(adapter.get).toHaveBeenCalledWith(snapshotKey);
    });

    it('makes missing snapshots explicit rather than pretending historical node counts are cached data', async () => {
        fixture();
        const upstream = vi.fn(async () => { throw Error('Do not fetch'); });
        vi.stubGlobal('fetch', upstream);
        const env = { MISUB_PERSONAL_MODE: 'true' };

        const single = await handleSingleSubscriptionMode(
            new Request('https://misub.test/api/subscription_nodes'), env, SOURCE.id, 'Preview'
        );
        const profile = await handleProfileMode(
            new Request('https://misub.test/api/subscription_nodes'), env, 'profile-1', 'Preview'
        );

        expect(single.success).toBe(false);
        expect(profile.success).toBe(false);
        expect(single.error).toContain('尚未保存');
        expect(profile.error).toContain('尚未保存');
        expect(single.nodes).toEqual([]);
        expect(profile.nodes).toEqual([]);
        expect(upstream).not.toHaveBeenCalled();
    });

    it('preserves legacy on-demand previews for non-personal installations', async () => {
        const upstream = vi.fn(async () => new Response(RAW.join('\n')));
        vi.stubGlobal('fetch', upstream);
        const result = await fetchPreviewSourceNodes(
            {}, {}, SOURCE, 'ClashMeta'
        );
        expect(result.success).toBe(true);
        expect(result.nodes).toHaveLength(2);
        expect(upstream).toHaveBeenCalled();
    });

    it('does not leak a snapshot saved under a different source URL', async () => {
        fixture({
            [snapshotKey]: {
                sourceUrl: 'https://old.example/secret', nodes: RAW, nodeCount: 2,
                updatedAt: '2026-10-10T00:00:00.000Z',
            },
        });
        const result = await handleSingleSubscriptionMode(
            new Request('https://misub.test/api/subscription_nodes'),
            { MISUB_PERSONAL_MODE: 'true' },
            SOURCE.id,
            'Preview'
        );
        expect(result.success).toBe(false);
        expect(result.nodes).toEqual([]);
    });
});
