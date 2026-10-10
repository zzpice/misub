/** 订阅刷新：保留流量、节点计数、失败保护与持久化。 */
import { KV_KEY_SUBS, SYSTEM_CONSTANTS } from './config.js';

async function loadSubscriptionsForCron(storageAdapter) {
    if (typeof storageAdapter.getAllSubscriptions === 'function') {
        const subscriptions = await storageAdapter.getAllSubscriptions();
        if (Array.isArray(subscriptions)) {
            return subscriptions;
        }
    }

    const subscriptions = await storageAdapter.get(KV_KEY_SUBS);
    return Array.isArray(subscriptions) ? subscriptions : [];
}

async function persistSubscriptionsForCron(storageAdapter, subscriptions) {
    if (typeof storageAdapter.putAllSubscriptions === 'function') {
        await storageAdapter.putAllSubscriptions(subscriptions);
        return;
    }

    await storageAdapter.put(KV_KEY_SUBS, subscriptions);
}

/** 并行刷新远程订阅。 */
export async function handleCronTrigger(env) {
    const { StorageFactory } = await import('../storage-adapter.js');

    const storageAdapter = await StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );
    const originalSubs = await loadSubscriptionsForCron(storageAdapter);
    const allSubs = JSON.parse(JSON.stringify(originalSubs));

    const httpSubscriptions = allSubs.filter((sub) => sub.url.startsWith('http') && sub.enabled);

    console.info(`[Cron] Starting parallel update for ${httpSubscriptions.length} subscriptions`);
    const startTime = Date.now();

    const CONCURRENCY = 6;
    const TIMEOUT = 15000;

    const nodeRegex =
        /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm;
    let changesMade = false;
    let updatedCount = 0;
    let failedCount = 0;
    const failedSubscriptions = [];

    async function processSubscription(sub) {
        try {
            const fetchWithTimeout = (url, options) => {
                const { cf, ...requestInit } = options;
                const fetchCall = cf
                    ? fetch(new Request(url, requestInit), { cf })
                    : fetch(new Request(url, requestInit));
                return Promise.race([
                    fetchCall,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
                    ),
                ]);
            };

            const [trafficResult, nodeCountResult] = await Promise.allSettled([
                fetchWithTimeout(sub.url, {
                    headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                    redirect: 'follow',
                    cf: { insecureSkipVerify: true },
                }),
                fetchWithTimeout(sub.url, {
                    headers: { 'User-Agent': SYSTEM_CONSTANTS.FETCHER_USER_AGENT },
                    redirect: 'follow',
                    cf: { insecureSkipVerify: true },
                }),
            ]);

            let hasTrafficUpdate = false;
            let hasNodeCountUpdate = false;

            if (trafficResult.status === 'fulfilled' && trafficResult.value.ok) {
                const userInfoHeader = trafficResult.value.headers.get('subscription-userinfo');
                if (userInfoHeader) {
                    const info = {};
                    userInfoHeader.split(';').forEach((part) => {
                        const [key, value] = part.trim().split('=');
                        if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                    });
                    const originalSub = allSubs.find((s) => s.id === sub.id);
                    if (originalSub) {
                        originalSub.userInfo = info;
                    }
                    hasTrafficUpdate = true;
                }
            }

            if (nodeCountResult.status === 'fulfilled' && nodeCountResult.value.ok) {
                const text = await nodeCountResult.value.text();
                let decoded = '';
                try {
                    decoded = atob(text.replace(/\s/g, ''));
                } catch {
                    decoded = text;
                }
                const matches = decoded.match(nodeRegex);
                if (matches) {
                    const originalSub = allSubs.find((s) => s.id === sub.id);
                    if (originalSub) {
                        const newCount = matches.length;
                        originalSub.nodeCount = newCount;
                    }
                    hasNodeCountUpdate = true;
                }
            }

            return {
                name: sub.name,
                success: hasTrafficUpdate || hasNodeCountUpdate,
                traffic: hasTrafficUpdate,
                nodes: hasNodeCountUpdate,
            };
        } catch (e) {
            return {
                name: sub.name,
                success: false,
                error: e.message,
            };
        }
    }

    async function runWithConcurrency(items, concurrency, fn) {
        const results = [];
        const executing = new Set();
        for (const item of items) {
            const promise = fn(item).then((result) => {
                executing.delete(promise);
                return result;
            });
            executing.add(promise);
            results.push(promise);
            if (executing.size >= concurrency) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    const results = await runWithConcurrency(httpSubscriptions, CONCURRENCY, processSubscription);

    for (const result of results) {
        if (result.success) {
            updatedCount++;
            changesMade = true;
        } else if (result.error) {
            failedCount++;
            failedSubscriptions.push({ name: result.name, error: result.error });
        }
    }

    if (changesMade) {
        await persistSubscriptionsForCron(storageAdapter, allSubs);
    }

    const duration = Date.now() - startTime;
    const summary = {
        success: true,
        summary: {
            total: httpSubscriptions.length,
            updated: updatedCount,
            failed: failedCount,
            changes: changesMade,
            duration: `${duration}ms`,
            failed_subscriptions: failedSubscriptions,
        },
    };

    console.info(`[Cron] Completed in ${duration}ms:`, summary.summary);

    return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
