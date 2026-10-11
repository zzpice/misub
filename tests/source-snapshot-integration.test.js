import { afterEach, describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';
import { generateCombinedNodeList } from '../functions/services/subscription-service.js';
import { transformBuiltinSubscription } from '../functions/modules/subscription/transformer-factory.js';
import { readSourceSnapshot } from '../functions/services/source-snapshot-service.js';

function storageFixture() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.get(key) ?? null; },
        async put(key, value) { records.set(key, structuredClone(value)); return true; },
    };
}
const SOURCE = {
    id: 'shared-source',
    name: 'Source',
    enabled: true,
    url: 'https://upstream.example/subscription',
    autoUpdateEnabled: true,
    autoUpdateIntervalMinutes: 60,
};
const RAW = [
    'trojan://password@1.2.3.4:443?sni=example.com#HK-01',
    'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.5:8388#JP-01',
].join('\n');

describe('source snapshots shared across groups, devices and output formats', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('fetches one raw source once for concurrent downstream clients and renders independent formats', async () => {
        const storage = storageFixture();
        const upstream = vi.fn(async () => new Response(RAW, {
            status: 200,
            headers: { 'subscription-userinfo': 'upload=1; download=2; total=100' },
        }));
        vi.stubGlobal('fetch', upstream);

        const formats = ['clash', 'singbox', 'surge&ver=4', 'loon', 'quanx', 'egern'];
        const rendered = await Promise.all(formats.map(async (format, index) => {
            const groupNodes = await generateCombinedNodeList(
                { env: { MISUB_PERSONAL_MODE: 'true' }, storage },
                { enableAccessLog: false, enableFlagEmoji: false },
                'Desktop-' + format,
                [SOURCE],
                '',
                { enableSubscriptions: index % 2 === 0 }
            );
            const converted = transformBuiltinSubscription(groupNodes, format, {
                fileName: 'Shared source',
                ruleLevel: 'std',
                addFlagEmoji: false,
            });
            return { format, groupNodes, converted };
        }));

        expect(upstream).toHaveBeenCalledTimes(1);
        const snapshot = await readSourceSnapshot(storage, SOURCE);
        expect(snapshot.nodeCount).toBe(2);
        expect(snapshot.userInfo.total).toBe(100);
        expect(snapshot.nodes).toEqual(RAW.split('\n'));
        expect(storage.records.size).toBe(2);
        expect(rendered.every((item) => item.groupNodes.includes('HK-01'))).toBe(true);
        expect(rendered.every((item) => String(item.converted).length > 100)).toBe(true);
        expect(yaml.load(rendered[0].converted).proxies).toHaveLength(2);
        expect(JSON.parse(rendered[1].converted).outbounds.some((x) => x.type === 'trojan')).toBe(true);
        expect(rendered[2].converted).toContain('[Proxy]');
        expect(rendered[3].converted).toContain('[Proxy]');
        expect(rendered[4].converted).toContain('[server_local]');
        expect(yaml.load(rendered[5].converted).proxies).toHaveLength(2);
        expect(rendered[0].groupNodes).not.toBe(rendered[1].groupNodes);
        // Multiple generated outputs must never overwrite the stored source nodes.
        expect((await readSourceSnapshot(storage, SOURCE)).nodes).toEqual(RAW.split('\n'));
    });
});
