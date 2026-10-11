/**
 * Anonymous profile download counter.
 * Intentionally independent of access logging, client IP and User-Agent retention.
 * In personal D1 mode an atomic UPSERT avoids lost increments under concurrency.
 */
const PREFIX = 'misub_profile_download_count_';

export function profileCountKey(profile) {
    return PREFIX + String(profile?.id || profile?.customId || '');
}

function validCount(value) {
    const count = Number(value);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export async function readProfileDownloadCount(storage, profile) {
    const keys = [...new Set([profileCountKey(profile), PREFIX + String(profile?.customId || profile?.id || '')])];
    const counts = await Promise.all(keys.map(key => storage.get(key)));
    return Math.max(validCount(profile?.downloadCount), ...counts.map(validCount));
}

export async function incrementProfileDownload(storage, profile) {
    if (!profile?.id && !profile?.customId) return;
    const key = profileCountKey(profile);
    const legacyKey = PREFIX + String(profile.customId || profile.id);
    const baseline = validCount(profile.downloadCount);
    if (storage?.db?.prepare) {
        // Carry forward the old alias count without changing its row. The fixed ID
        // survives future alias edits, and the UPSERT remains atomic under concurrency.
        await storage.db.prepare(
            `INSERT INTO settings (key, value, updated_at)
             VALUES (?, MAX(?, COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key = ?), 0)) + 1, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
             value = MAX(CAST(settings.value AS INTEGER), CAST(excluded.value AS INTEGER) - 1) + 1,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(key, baseline, legacyKey).run();
        return;
    }
    // Legacy KV instances: best effort without storing identifying request data.
    await storage.put(key, (await readProfileDownloadCount(storage, profile)) + 1);
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
