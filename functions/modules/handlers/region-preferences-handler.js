import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse, JSON_BODY_LIMITS, readJsonWithLimit } from '../utils.js';
import { updateRegionPreferences } from '../../services/region-preferences.js';
export async function handleRegionPreferencesRequest(request, env) {
    if (request.method !== 'POST') return createJsonResponse({ error: 'Method Not Allowed' }, 405);
    try {
        const body = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
        if (typeof body?.subscriptionId !== 'string' || body.subscriptionId.length > 200)
            return createJsonResponse({ error: '无效的订阅源' }, 400);
        const storage = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        const source = await storage.getSubscriptionById(body.subscriptionId);
        if (!source?.enabled) return createJsonResponse({ error: '订阅源不存在或已禁用' }, 404);
        const saved = await updateRegionPreferences(storage, source, body.entries);
        return createJsonResponse({ success: true, ...saved });
    } catch (err) {
        return createJsonResponse({ error: err?.message || '保存失败' }, 400);
    }
}
