import { describe, it, expect, vi } from 'vitest';
import { extractNodeRegion, resolveNodeRegion, getRegionOptions } from '../../functions/modules/utils/geo-utils.js';
import { fingerprintNode, updateRegionPreferences, readRegionPreferences, applySourceRegions } from '../../functions/services/region-preferences.js';
import { calculateRegionStats } from '../../functions/modules/utils/node-parser.js';
import { groupNodeLinesByRegion } from '../../functions/modules/subscription/region-groups.js';

const u = (name, password = 'secret', server = 'example.net') =>
    'trojan://' + password + '@' + server + ':443#' + encodeURIComponent(name);
const source = { id: 'airline-a', name: 'Airport A', url: 'https://airport.test/sub', defaultRegion: '新加坡' };
const sourceKey = 'misub_source_snapshot_v1_airline-a';

function fixture(urls) {
    const state = new Map([[sourceKey, {
        sourceUrl: source.url, nodes: urls, nodeCount: urls.length,
        updatedAt: '2026-10-11T01:00:00.000Z',
    }]]);
    return {
        get: vi.fn(async (key) => state.get(key) || null),
        put: vi.fn(async (key, value) => { state.set(key, value); }),
        state,
    };
}

describe('unified region engine', () => {
    it.each([
        ['LA-vless-reality', '美国'], ['LA-tuic', '美国'],
        ['LAO', '老挝'], ['Laos-01', '老挝'],
        ['洛杉矶 reality', '美国'], ['LAX-1', '美国'],
        ['USA-01', '美国'], ['🇺🇸 edge', '美国'],
        ['🇱🇦 edge', '老挝'], ['Tokyo-01', '日本'],
        ['NRT-01', '日本'], ['巴黎-01', '法国'],
        ['Singapore-01', '新加坡'], ['SG-01', '新加坡'],
        ['HongKong 01', '香港'],
        ['LA', '其他'], ['CA', '其他'], ['IN', '其他'], ['FRA', '其他'],
        ['unknown', '其他'], ['business', '其他'], ['user', '其他'],
        ['Singaporean', '其他'], ['XUS-01', '其他'],
    ])('detects %s as %s', (name, region) => {
        expect(extractNodeRegion(name)).toBe(region);
    });

    it('resolves ambiguous names without forcing country guesses', () => {
        expect(resolveNodeRegion('LA', { defaultRegion: '美国' })).toBe('美国');
        expect(resolveNodeRegion('LAO', { defaultRegion: '美国' })).toBe('老挝');
        expect(resolveNodeRegion('Tokyo', { defaultRegion: '美国' })).toBe('日本');
        expect(resolveNodeRegion('Tokyo', { regionOverrides: [{ pattern: 'Tokyo', region: '德国' }] })).toBe('德国');
        expect(resolveNodeRegion('Tokyo', {
            manualRegion: '加拿大', regionOverrides: [{ pattern: 'Tokyo', region: '德国' }],
        })).toBe('加拿大');
        expect(resolveNodeRegion('Tokyo', { regionOverrides: [{ pattern: '[', region: '美国' }] })).toBe('日本');
        expect(resolveNodeRegion('Japan-London')).toBe('其他');
    });

    it('returns searchable country and flag options', () => {
        const us = getRegionOptions().find((x) => x.name === '美国');
        expect(us).toMatchObject({ code: 'US', flag: '🇺🇸' });
        expect(getRegionOptions().some((x) => x.name === '老挝')).toBe(true);
    });
});

describe('source-scoped D1 region preferences', () => {
    it('identity survives a rename but rejects changed credentials or server', async () => {
        expect(await fingerprintNode(u('original'))).toBe(await fingerprintNode(u('new-name')));
        expect(await fingerprintNode(u('original'))).not.toBe(await fingerprintNode(u('original', 'new-pass')));
        expect(await fingerprintNode(u('original'))).not.toBe(await fingerprintNode(u('original', 'secret', 'different.net')));
    });
    it('saves and resets explicit preferences outside raw snapshots', async () => {
        const url = u('LA');
        const db = fixture([url]);
        const hash = await fingerprintNode(url);
        await updateRegionPreferences(db, source, [{ fingerprint: hash, region: '美国' }]);
        const data = await readRegionPreferences(db, source.id);
        expect(data.overrides[hash]).toBe('美国');
        const modified = await applySourceRegions([{ name: 'LA', url }], source, data);
        expect(modified[0]).toMatchObject({ region: '美国', regionSource: 'manual', sourceId: source.id });
        expect(calculateRegionStats(modified)['美国'].count).toBe(1);
        expect(groupNodeLinesByRegion([{ tag: 'LA', metadata: { manualRegion: '美国' } }])[0].name).toContain('美国节点');
        expect(db.state.get(sourceKey).nodes).toEqual([url]);
        await updateRegionPreferences(db, source, [{ fingerprint: hash, region: null }]);
        const reset = await readRegionPreferences(db, source.id);
        expect(reset.overrides[hash]).toBeUndefined();
        expect((await applySourceRegions([{ name: 'LA', url }], source, reset))[0].region).toBe('新加坡');
    });
    it('refuses stale or unrelated identities and unsupported regions', async () => {
        const url = u('test');
        const db = fixture([url]);
        const other = await fingerprintNode(u('test', 'different'));
        await expect(updateRegionPreferences(db, source, [{ fingerprint: other, region: '美国' }])).rejects.toThrow();
        await expect(updateRegionPreferences(db, source, [{ fingerprint: await fingerprintNode(url), region: 'Atlantis' }])).rejects.toThrow();
        expect(db.put).not.toHaveBeenCalled();
    });
    it('same names in another source have no shared preferences', async () => {
        const url = u('LA');
        const db = fixture([url]);
        const hash = await fingerprintNode(url);
        await updateRegionPreferences(db, source, [{ fingerprint: hash, region: '美国' }]);
        const other = await readRegionPreferences(db, 'airline-b');
        expect(other.overrides[hash]).toBeUndefined();
    });
});
