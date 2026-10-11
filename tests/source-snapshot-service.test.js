import { describe, it, expect, vi } from 'vitest';
import {
    getSourceUpdateInterval,
    readSourceSnapshot,
    refreshSourceSnapshot,
    resolveSourceSnapshot,
} from '../functions/services/source-snapshot-service.js';

const source = {
    id: 'source-a',
    url: 'https://example.com/subscription',
    enabled: true,
    autoUpdateEnabled: true,
    autoUpdateIntervalMinutes: 60,
};
const nodes = [
    'vless://11111111-1111-4111-8111-111111111111@host-a.example:443#A',
    'trojan://password@host-b.example:443#B',
];
function makeStorage() {
    const records = new Map();
    return {
        records,
        async get(key) { return structuredClone(records.get(key) ?? null); },
        async put(key, value) { records.set(key, structuredClone(value)); },
    };
}
function fetched() {
    return { nodes: [...nodes], userInfo: { upload: 4, download: 7, total: 100 }, detectedName: 'Test source' };
}

describe('durable upstream subscription snapshots', () => {
    it('saves complete raw nodes independently of output format or downstream device', async () => {
        const storage = makeStorage();
        const fetcher = vi.fn(async () => fetched());
        const one = await refreshSourceSnapshot({ storage, source, fetcher });
        const two = await resolveSourceSnapshot({
            storage,
            source,
            context: { waitUntil: () => { throw Error('Fresh snapshot should not refresh'); } },
            fetcher,
        });
        expect(one.success).toBe(true);
        expect(two.nodes).toEqual(nodes);
        expect(two.userInfo.total).toBe(100);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(storage.records.size).toBe(2); // Manifest + attempt status; no duplicate client copies
    });

    it('retains the successful snapshot on errors, empty responses and expired upstream links', async () => {
        const storage = makeStorage();
        await refreshSourceSnapshot({ storage, source, fetcher: async () => fetched() });
        for (const fetcher of [
            async () => { throw new Error('HTTP 403'); },
            async () => ({ nodes: [] }),
        ]) {
            const response = await refreshSourceSnapshot({ storage, source, fetcher });
            expect(response.success).toBe(false);
            expect(response.snapshot.nodes).toEqual(nodes);
        }
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual(nodes);
    });

    it('does not expire a D1-style snapshot after twelve hours or even a year', async () => {
        const storage = makeStorage();
        await storage.put('misub_source_snapshot_v1_source-a', {
            nodes,
            nodeCount: nodes.length,
            updatedAt: '2024-01-01T00:00:00.000Z',
        });
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual(nodes);
    });

    it('never fetches automatically when disabled, including a missing snapshot', async () => {
        const storage = makeStorage();
        const disabled = { ...source, autoUpdateEnabled: false };
        const fetcher = vi.fn(async () => fetched());
        expect(await resolveSourceSnapshot({ storage, source: disabled, fetcher })).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
        const manual = await refreshSourceSnapshot({ storage, source: disabled, fetcher });
        expect(manual.success).toBe(true);
        expect((await resolveSourceSnapshot({ storage, source: disabled, fetcher })).nodes).toEqual(nodes);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns saved nodes immediately and refreshes stale data with waitUntil', async () => {
        const storage = makeStorage();
        await storage.put('misub_source_snapshot_v1_source-a', {
            nodes: [nodes[0]],
            nodeCount: 1,
            updatedAt: '2020-01-01T00:00:00.000Z',
        });
        const waits = [];
        const fetcher = vi.fn(async () => fetched());
        const old = await resolveSourceSnapshot({
            storage,
            source,
            fetcher,
            context: { waitUntil(promise) { waits.push(promise); } },
        });
        expect(old.nodes).toEqual([nodes[0]]);
        expect(waits).toHaveLength(1);
        await Promise.all(waits);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect((await readSourceSnapshot(storage, source)).nodes).toEqual(nodes);
    });

    it('does not refresh stale cache when waitUntil is unavailable', async () => {
        const storage = makeStorage();
        await storage.put('misub_source_snapshot_v1_source-a', {
            nodes, nodeCount: nodes.length, updatedAt: '2020-01-01T00:00:00.000Z',
        });
        const fetcher = vi.fn(async () => fetched());
        expect((await resolveSourceSnapshot({ storage, source, fetcher })).nodes).toEqual(nodes);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('coalesces simultaneous requests for one source across client configurations', async () => {
        const storage = makeStorage();
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const fetcher = vi.fn(async () => { await gate; return fetched(); });
        const promises = Array.from({ length: 8 }, () =>
            refreshSourceSnapshot({ storage, source, fetcher })
        );
        release();
        const results = await Promise.all(promises);
        expect(results.every((result) => result.success)).toBe(true);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(storage.records.size).toBe(2);
    });

    it('keeps snapshots isolated between different sources', async () => {
        const storage = makeStorage();
        const second = { ...source, id: 'source-b' };
        await refreshSourceSnapshot({ storage, source, fetcher: async () => fetched() });
        await refreshSourceSnapshot({
            storage, source: second,
            fetcher: async () => ({ nodes: ['ss://YWVzLTEyOC1nY206cA@example.com:443#C'] }),
        });
        expect((await readSourceSnapshot(storage, source)).nodeCount).toBe(2);
        expect((await readSourceSnapshot(storage, second)).nodeCount).toBe(1);
    });

    it('rejects a suspicious partial result rather than destroying a healthy snapshot', async () => {
        const storage = makeStorage();
        const many = Array.from({ length: 20 }, (_, i) => `vless://id@host.example:443#${i}`);
        await refreshSourceSnapshot({
            storage, source,
            fetcher: async () => ({ nodes: many }),
        });
        const result = await refreshSourceSnapshot({
            storage, source,
            fetcher: async () => ({ nodes: nodes.slice(0, 1) }),
        });
        expect(result.success).toBe(false);
        expect((await readSourceSnapshot(storage, source)).nodeCount).toBe(20);
    });

    it('clamps legacy and invalid update intervals', () => {
        expect(getSourceUpdateInterval({})).toBe(60);
        expect(getSourceUpdateInterval({ autoUpdateIntervalMinutes: 1 })).toBe(60);
        expect(getSourceUpdateInterval({ autoUpdateIntervalMinutes: 15 })).toBe(15);
    });
});
