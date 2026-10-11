/**
 * Anonymous profile download counter.
 * Intentionally independent of access logging, client IP and User-Agent retention.
 * In personal D1 mode an atomic UPSERT avoids lost increments under concurrency.
 */
const PREFIX = 'misub_profile_download_count_';

export function profileCountKey(profile) {
    return PREFIX + String(profile?.customId || profile?.id || '');
}

export async function incrementProfileDownload(storage, profile) {
    if (!profile?.id && !profile?.customId) return;
    const key = profileCountKey(profile);

    if (storage?.db?.prepare) {
        await storage.db.prepare(
            `INSERT INTO settings (key, value, updated_at)
             VALUES (?, '1', CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
             value = CAST(settings.value AS INTEGER) + 1,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(key).run();
        return;
    }

    // Legacy KV instances: best effort without storing any identifying request data.
    const value = Number(await storage.get(key)) || 0;
    await storage.put(key, value + 1);
}

export function recordSuccessfulProfileResponse({
    response, context, storage, profile, request, skip = false,
}) {
    if (
        !profile || skip || !response || response.status !== 200 ||
        request?.method !== 'GET'
    ) return response;
    const task = incrementProfileDownload(storage, profile).catch((error) => {
        console.warn('[Profile Count] Unable to update anonymous count:', error?.message || error);
    });
    if (typeof context?.waitUntil === 'function') context.waitUntil(task);
    return response;
}
