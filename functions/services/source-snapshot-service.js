/**
 * Durable per-upstream snapshots. The D1 settings table is authoritative in personal mode.
 * Never use the expiring node_cache_ namespace for these records.
 */
import { isSuspiciousNodeCountDrop } from './node-cache-service.js';

const SNAPSHOT_PREFIX = 'misub_source_snapshot_v1_';
const ATTEMPT_PREFIX = 'misub_source_attempt_v1_';
const LOCK_PREFIX = 'misub_source_lock_v1_';
const MIN_INTERVAL_MINUTES = 5;
const DEFAULT_INTERVAL_MINUTES = 60;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const LOCK_LIFETIME_MS = 90 * 1000;
const pending = new Map();

function sourceKey(source) {
    const id = String(source?.id || '').trim();
    if (!id) throw new Error('Subscription ID is required');
    return encodeURIComponent(id);
}
function snapshotKey(source) {
    return SNAPSHOT_PREFIX + sourceKey(source);
}
function attemptKey(source) {
    return ATTEMPT_PREFIX + sourceKey(source);
}
function lockKey(source) {
    return LOCK_PREFIX + sourceKey(source);
}

export function getSourceUpdateInterval(source) {
    const value = Number(source?.autoUpdateIntervalMinutes);
    return Number.isFinite(value) && value >= MIN_INTERVAL_MINUTES
        ? Math.floor(value)
        : DEFAULT_INTERVAL_MINUTES;
}

export async function readSourceSnapshot(storage, source) {
    const value = await storage.get(snapshotKey(source));
    const currentUrl = String(source.url || '').trim();
    if (Array.isArray(value?.nodes) && value.nodes.length > 0) {
        // A saved ID may be edited to point to a different upstream. Never
        // serve the previous upstream's credentials as the new source.
        if (value.sourceUrl && currentUrl && value.sourceUrl !== currentUrl) return null;
        const nodes = value.nodes.filter((n) => typeof n === 'string' && n.trim());
        return nodes.length ? { ...value, nodes } : null;
    }

    // One-way migration for legacy personal D1 caches, with their original
    // update timestamp. Unlike those caches this new copy is never TTL bounded.
    // Old node caches were already processed with source-level rules, so we
    // tag their migration to avoid processing them a second time on read.
    const oldKey = 'node_cache_subscription_' + sourceKey(source);
    const legacy = await storage.get(oldKey);
    if (!Array.isArray(legacy?.nodes) || !legacy.nodes.length) return null;
    if (legacy.sourceUrl && currentUrl && legacy.sourceUrl !== currentUrl) return null;
    const nodes = legacy.nodes.filter((n) => typeof n === 'string' && n.trim());
    if (!nodes.length) return null;
    const migrated = {
        sourceId: source.id,
        sourceUrl: currentUrl,
        nodes,
        nodeCount: nodes.length,
        updatedAt: Number.isFinite(Date.parse(legacy.updatedAt))
            ? legacy.updatedAt
            : new Date(0).toISOString(),
        userInfo: source.userInfo || null,
        detectedName: source.detectedName || '',
        migratedLegacy: true,
    };
    await storage.put(snapshotKey(source), migrated);
    return migrated;
}

async function acquireLock(storage, source) {
    if (!storage?.db) return true; // Non-personal KV remains best-effort; D1 uses an atomic lease.
    const key = lockKey(source);
    const now = Date.now();
    const expires = String(now + LOCK_LIFETIME_MS);
    const inserted = await storage.db
        .prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
        .bind(key, expires)
        .run();
    if (inserted?.meta?.changes === 1) return expires;
    const changed = await storage.db
        .prepare("UPDATE settings SET value = ? WHERE key = ? AND CAST(value AS INTEGER) <= ?")
        .bind(expires, key, now)
        .run();
    return changed?.meta?.changes === 1 ? expires : null;
}

async function releaseLock(storage, source, lease) {
    if (!storage?.db || !lease) return;
    await storage.db
        .prepare('DELETE FROM settings WHERE key = ? AND value = ?')
        .bind(lockKey(source), lease)
        .run();
}

function safeMessage(error) {
    const message = String(error?.message || '');
    const status = message.match(/HTTP\s+(\d{3})/i);
    return status ? `Upstream HTTP ${status[1]}` : 'Upstream fetch or node validation failed';
}

export async function refreshSourceSnapshot({ storage, source, fetcher }) {
    const key = snapshotKey(source);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const task = (async () => {
        const existing = await readSourceSnapshot(storage, source);
        let lease = null;
        try {
            lease = await acquireLock(storage, source);
            if (!lease) return { success: false, busy: true, snapshot: existing };
            const fetched = await fetcher(source);
            const nodes = Array.isArray(fetched?.nodes)
                ? fetched.nodes.filter((n) => typeof n === 'string' && n.trim())
                : [];
            if (!nodes.length) throw new Error('Invalid or empty upstream subscription');
            const historicalCount = Math.max(
                Number(existing?.nodeCount || existing?.nodes?.length || 0),
                Number(source?.lastGoodNodeCount || 0), Number(source?.nodeCount || 0)
            );
            if (isSuspiciousNodeCountDrop(historicalCount, nodes.length)) {
                throw new Error('Suspicious reduction in upstream nodes');
            }
            const updatedAt = new Date().toISOString();
            const snapshot = {
                sourceId: source.id,
                sourceUrl: String(source.url || '').trim(),
                nodes,
                nodeCount: nodes.length,
                updatedAt,
                userInfo: fetched.userInfo || null,
                detectedName: fetched.detectedName || '',
            };
            // Only publish the new snapshot after the full result has been fetched and validated.
            await storage.put(key, snapshot);
            // Publish human-readable metadata only after the snapshot write is
            // durable. The snapshot itself remains authoritative if this update
            // fails or the source is concurrently edited by an administrator.
            if (typeof storage.updateSubscriptionById === 'function') {
                try {
                    await storage.updateSubscriptionById(source.id, (current) => {
                        if (!current || current.url !== source.url) return current;
                        return {
                            ...current,
                            lastSuccessAt: updatedAt,
                            lastUpdate: updatedAt,
                            nodeCount: nodes.length,
                            userInfo: fetched.userInfo || null,
                            ...(fetched.detectedName ? { detectedName: fetched.detectedName } : {}),
                            ...(nodes.length >= 10 ? { lastGoodNodeCount: nodes.length } : {}),
                            lastError: null,
                        };
                    });
                } catch (error) {
                    console.warn('[SourceSnapshot] Subscription metadata update failed');
                }
            }
            try {
                await storage.put(attemptKey(source), { lastAttemptAt: updatedAt, success: true });
            } catch (error) {
                console.warn('[SourceSnapshot] Unable to record successful attempt:', error);
            }
            return { success: true, snapshot };
        } catch (error) {
            const message = safeMessage(error);
            console.warn('[SourceSnapshot] Preserving last successful snapshot:', message);
            if (lease) {
                try {
                    await storage.put(attemptKey(source), {
                        lastAttemptAt: new Date().toISOString(),
                        success: false,
                        error: message,
                    });
                } catch (statusError) {
                    console.warn('[SourceSnapshot] Unable to record failed attempt:', statusError);
                }
            }
            return { success: false, snapshot: existing, error: message };
        } finally {
            try {
                await releaseLock(storage, source, lease);
            } catch (error) {
                console.warn('[SourceSnapshot] Lease cleanup failed:', error);
            }
        }
    })();
    pending.set(key, task);
    try {
        return await task;
    } finally {
        if (pending.get(key) === task) pending.delete(key);
    }
}

/**
 * Downstream requests share raw per-source data. If a snapshot exists, refresh
 * only when due and only with Cloudflare waitUntil; never block a client.
 * Sources with auto-update disabled never contact the upstream here.
 */
export async function isSourceRefreshDue(storage, source, snapshot = null) {
    if (source.autoUpdateEnabled === false) return false;
    const current = snapshot || await readSourceSnapshot(storage, source);
    const now = Date.now();
    const lastSuccess = Date.parse(current?.updatedAt || '');
    if (current && Number.isFinite(lastSuccess) &&
        now - lastSuccess < getSourceUpdateInterval(source) * 60 * 1000) {
        return false;
    }
    const attempt = await storage.get(attemptKey(source));
    const lastAttempt = Date.parse(attempt?.lastAttemptAt || '');
    return !Number.isFinite(lastAttempt) || now - lastAttempt >= RETRY_BACKOFF_MS;
}

export async function resolveSourceSnapshot({ storage, source, context, fetcher }) {
    let snapshot = await readSourceSnapshot(storage, source);
    if (!(await isSourceRefreshDue(storage, source, snapshot))) return snapshot;
    if (snapshot) {
        if (typeof context?.waitUntil === 'function') {
            context.waitUntil(
                refreshSourceSnapshot({ storage, source, fetcher }).catch((error) => {
                    console.warn('[SourceSnapshot] Background refresh error:', safeMessage(error));
                })
            );
        }
        return snapshot;
    }
    // First-use bootstrap is the only synchronous upstream request.
    const result = await refreshSourceSnapshot({ storage, source, fetcher });
    return result.snapshot || null;
}
