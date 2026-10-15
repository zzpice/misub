import { StorageFactory } from '../../storage-adapter.js';
import { refreshSourceSnapshot } from '../../services/source-snapshot-service.js';
import { fetchRemoteSourceSnapshot } from '../../services/subscription-service.js';
import { createJsonResponse, readJsonWithLimit } from '../utils.js';

/** Authenticated, explicit manual refresh. No public downstream request can force it. */
export async function handleSourceSnapshotRefresh(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }
    let body;
    try {
        body = await readJsonWithLimit(request, 4096);
    } catch (error) {
        return createJsonResponse(
            { success: false, error: error.status === 413 ? 'Request too large' : 'Invalid JSON' },
            error.status || 400
        );
    }
    const subscriptionId = body?.subscriptionId;
    if (typeof subscriptionId !== 'string' || !subscriptionId || subscriptionId.length > 200) {
        return createJsonResponse({ success: false, error: 'Invalid subscription ID' }, 400);
    }
    const storage = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const source = await storage.getSubscriptionById(subscriptionId);
    if (!source || !source.enabled || !/^https?:\/\//i.test(String(source.url || ''))) {
        return createJsonResponse({ success: false, error: 'Subscription not found' }, 404);
    }
    const result = await refreshSourceSnapshot({
        storage,
        source,
        fetcher: (subscription) => fetchRemoteSourceSnapshot(subscription, storage),
    });
    if (!result.success) {
        return createJsonResponse(
            {
                success: false,
                error: result.busy ? 'Refresh already in progress' : result.error,
                preserved: Boolean(result.snapshot),
            },
            result.busy ? 409 : 502
        );
    }
    const snapshot = result.snapshot;
    return createJsonResponse({
        success: true,
        data: {
            subscriptionId,
            count: snapshot.nodeCount,
            nodeCount: snapshot.nodeCount,
            userInfo: snapshot.userInfo,
            detectedName: snapshot.detectedName,
            lastSuccessAt: snapshot.updatedAt,
        },
    });
}
