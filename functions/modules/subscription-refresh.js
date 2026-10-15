/**
 * The external /cron endpoint reuses the same durable per-source snapshot path
 * as downstream subscriptions and the manual refresh button.
 * No parallel cache format, no duplicate metadata fetch, no bulk overwrites.
 */
import { KV_KEY_SUBS } from './config.js';
import { isSourceRefreshDue, refreshSourceSnapshot } from '../services/source-snapshot-service.js';
import { fetchRemoteSourceSnapshot } from '../services/subscription-service.js';

async function loadSubscriptionsForCron(storage) {
    if (typeof storage.getAllSubscriptions === 'function') {
        const subscriptions = await storage.getAllSubscriptions();
        if (Array.isArray(subscriptions)) return subscriptions;
    }
    const subscriptions = await storage.get(KV_KEY_SUBS);
    return Array.isArray(subscriptions) ? subscriptions : [];
}

async function runWithConcurrency(items, concurrency, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const task = Promise.resolve()
            .then(() => fn(item))
            .catch((error) => ({
                state: 'failed',
                name: item.name,
                error: String(error?.message || 'Unexpected refresh error'),
            }));
        executing.add(task);
        task.finally(() => executing.delete(task));
        results.push(task);
        if (executing.size >= concurrency) await Promise.race(executing);
    }
    return Promise.all(results);
}

/** Authenticated externally scheduled run; respects per-source auto-update intervals. */
export async function handleCronTrigger(env) {
    const { StorageFactory } = await import('../storage-adapter.js');
    const storage = await StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );
    const subscriptions = await loadSubscriptionsForCron(storage);
    const remoteSources = subscriptions.filter(
        (source) => source?.enabled && /^https?:\/\//i.test(String(source.url || ''))
    );
    const startedAt = Date.now();
    console.info(`[Cron] Checking ${remoteSources.length} remote sources`);

    const results = await runWithConcurrency(remoteSources, 6, async (source) => {
        if (!(await isSourceRefreshDue(storage, source))) {
            return { state: 'skipped', name: source.name };
        }
        const refreshed = await refreshSourceSnapshot({
            storage,
            source,
            fetcher: (current) => fetchRemoteSourceSnapshot(current, storage),
        });
        if (refreshed.busy) return { state: 'skipped', name: source.name };
        if (refreshed.success) {
            return { state: 'updated', name: source.name };
        }
        return {
            state: 'failed',
            name: source.name,
            error: refreshed.error || 'Upstream refresh failed',
            preserved: Boolean(refreshed.snapshot),
        };
    });

    const updated = results.filter((r) => r.state === 'updated').length;
    const skipped = results.filter((r) => r.state === 'skipped').length;
    const failures = results.filter((r) => r.state === 'failed');
    const summary = {
        total: remoteSources.length,
        updated,
        skipped,
        failed: failures.length,
        changes: updated > 0,
        preserved: failures.filter((r) => r.preserved).length,
        duration: `${Date.now() - startedAt}ms`,
        failed_subscriptions: failures.map(({ name, error }) => ({ name, error })),
    };
    console.info('[Cron] Snapshot refresh completed:', summary);
    return new Response(JSON.stringify({ success: true, summary }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
