/**
 * Source-scoped, D1-backed region corrections. Raw node snapshots are immutable.
 * A SHA-256 fingerprint excludes display name but includes connection credentials.
 */
import { parseNodeInfo, REGION_KEYWORDS, resolveNodeRegion, getRegionEmoji } from '../modules/utils/geo-utils.js';
import { parseNodeList } from '../modules/utils/node-parser.js';
import { readSourceSnapshot } from './source-snapshot-service.js';
const PREFIX = 'misub_region_preferences_v1_';
export function regionPreferencesKey(id) { return PREFIX + encodeURIComponent(String(id)); }
export function nodeRegionIdentity(url) {
    const base = String(url || '').trim().split('#')[0];
    if (/^vmess:\/\//i.test(base)) {
        try {
            const b64 = base.slice(8).replace(/-/g, '+').replace(/_/g, '/');
            const bytes = Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (v) => v.charCodeAt(0));
            const config = JSON.parse(new TextDecoder().decode(bytes));
            delete config.ps;
            return 'vmess://' + JSON.stringify(Object.fromEntries(Object.entries(config).sort(([a], [b]) => a.localeCompare(b))));
        } catch { /* identity falls back to original encoded payload */ }
    }
    if (/^ssr:\/\//i.test(base)) {
        try {
            const b64 = base.slice(6).replace(/-/g, '+').replace(/_/g, '/');
            const decoded = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
            return 'ssr://' + decoded.replace(/([?&])remarks=[^&]*/i, '$1');
        } catch { /* safe fallback */ }
    }
    return base;
}
export async function fingerprintNode(url) {
    const bytes = new TextEncoder().encode(nodeRegionIdentity(url));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function readRegionPreferences(storage, id) {
    if (!id) return { overrides: {}, version: '' };
    const data = await storage.get(regionPreferencesKey(id));
    return {
        version: typeof data?.version === 'string' ? data.version : '',
        overrides: data?.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides)
            ? data.overrides : {},
    };
}
export async function applySourceRegions(nodes, source, data, rules = []) {
    return Promise.all(nodes.map(async (node) => {
        const fingerprint = await fingerprintNode(node.url);
        const manual = data.overrides[fingerprint] || '';
        const region = resolveNodeRegion(node.name, {
            manualRegion: manual, regionOverrides: rules, defaultRegion: source.defaultRegion,
        });
        return {
            ...node, sourceId: source.id, fingerprint, region,
            regionSource: manual ? 'manual' : 'automatic',
            metadata: { ...(node.metadata || {}), region, flag: getRegionEmoji(region) },
        };
    }));
}
export async function updateRegionPreferences(storage, source, updates) {
    if (!source?.id || !/^https?:\/\//i.test(String(source.url || ''))) throw Error('仅支持已保存的 HTTP 订阅源');
    if (!Array.isArray(updates) || updates.length < 1 || updates.length > 200) throw Error('一次请选择 1–200 个节点');
    const snapshot = await readSourceSnapshot(storage, source);
    if (!snapshot?.nodes?.length) throw Error('没有可用的节点快照');
    const parsed = parseNodeList(snapshot.nodes.join('\n'), { plusAsSpace: Boolean(source.plusAsSpace) });
    const valid = new Set(await Promise.all(parsed.map((node) => fingerprintNode(node.url))));
    for (const item of updates) {
        if (!item || typeof item.fingerprint !== 'string' ||
            !/^[0-9a-f]{64}$/.test(item.fingerprint) || !valid.has(item.fingerprint)) {
            throw Error('节点已变化，请刷新预览后重试');
        }
        if (item.region != null && item.region !== '' &&
            !Object.prototype.hasOwnProperty.call(REGION_KEYWORDS, item.region)) throw Error('无效地区');
    }
    const key = regionPreferencesKey(source.id);
    for (let attempt = 0; attempt < 5; attempt++) {
        const row = storage.db
            ? await storage.db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first()
            : null;
        const saved = storage.db ? (row ? JSON.parse(row.value) : {})
            : await readRegionPreferences(storage, source.id);
        const overrides = { ...(saved.overrides || {}) };
        for (const item of updates) {
            if (item.region) overrides[item.fingerprint] = item.region;
            else delete overrides[item.fingerprint];
        }
        if (Object.keys(overrides).length > 3000) throw Error('人工覆盖数量超过上限');
        const version = new Date().toISOString() + '-' + crypto.randomUUID();
        const value = { version, overrides };
        if (!storage.db) {
            await storage.put(key, value);
            return { version, updated: updates.length };
        }
        const result = row
            ? await storage.db.prepare(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND value = ?'
            ).bind(JSON.stringify(value), key, row.value).run()
            : await storage.db.prepare(
                'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
            ).bind(key, JSON.stringify(value)).run();
        if (result?.meta?.changes === 1) return { version, updated: updates.length };
    }
    throw Error('地区设置已被同时修改，请重试');
}

export function correctedName(url, region) {
    if (!region || region === '其他') return null;
    const name = parseNodeInfo(url).name;
    if (!name) return null;
    return getRegionEmoji(region) + ' ' + name.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '');
}
