/**
 * WebDAV backup / restore handler for MiSub.
 *
 * Design notes:
 * - Backup is domain-level, not KV/D1 whole-store mirroring.
 * - Restore only touches known MiSub business keys/collections.
 * - WebDAV credentials and runtime secrets are never written into backup payloads.
 */

import { isPersonalMode } from './personal-mode.js';
import { StorageFactory, SettingsCache, STORAGE_TYPES } from '../storage-adapter.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS } from './config.js';
import { KV_KEY_RULE_TEMPLATES, listRuleTemplates } from './rule-template-handler.js';
import {
    createJsonResponse,
    createErrorResponse,
    JSON_BODY_LIMITS,
    readJsonWithLimit,
} from './utils.js';

import { snapshotKey } from '../services/source-snapshot-service.js';
import { regionPreferencesKey } from '../services/region-preferences.js';
import { REGION_KEYWORDS } from './utils/geo-utils.js';
import { profileCountKey, readProfileDownloadCount } from '../services/profile-download-counter.js';
import { readResponseBufferWithLimit } from './security-utils.js';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const BACKUP_TYPE = 'misub-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_SCOPES = {
    DATA_ONLY: 'dataOnly',
    DATA_AND_SETTINGS: 'dataAndSettings',
};

const RESTORE_SNAPSHOT_KEY = 'misub_restore_snapshot_latest';
const BACKUP_FILENAME_PREFIX = 'misub-backup-';
const BACKUP_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_WEBDAV_CONFIG = {
    enabled: false,
    endpoint: '',
    username: '',
    password: '',
    remotePath: '/MiSub',
    filenameTemplate: 'misub-backup-{datetime}.json',
    backupScope: BACKUP_SCOPES.DATA_ONLY,
    autoBackup: false,
    interval: 'daily',
    retentionCount: 7,
    lastCheckedAt: null,
    lastBackupAt: null,
    lastBackupStatus: null,
    lastBackupMessage: '',
    lastBackupFile: '',
};

function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeScope(scope) {
    return scope === BACKUP_SCOPES.DATA_AND_SETTINGS
        ? BACKUP_SCOPES.DATA_AND_SETTINGS
        : BACKUP_SCOPES.DATA_ONLY;
}

function normalizeWebdavConfig(settings = {}) {
    return { ...DEFAULT_WEBDAV_CONFIG, ...(settings.webdavBackup || {}) };
}

function sanitizeRuntimeSecrets(settings = {}, env = {}) {
    const sanitized = cloneJson(settings) || {};
    delete sanitized.webdavBackup;
    delete sanitized.adminPassword;
    delete sanitized.ADMIN_PASSWORD;
    delete sanitized.password;
    delete sanitized.cookieSecret;
    delete sanitized.COOKIE_SECRET;
    delete sanitized.SUBSCRIPTION_TOKEN;
    delete sanitized.PROFILE_TOKEN;
    if (isPersonalMode(env)) {
        delete sanitized.mytoken;
        delete sanitized.profileToken;
    }
    delete sanitized.sessionSecret;
    delete sanitized.lastBackupAt;
    delete sanitized.lastBackupStatus;
    delete sanitized.lastBackupMessage;
    delete sanitized.lastBackupFile;
    return sanitized;
}

export function sanitizeSettingsForBackup(settings = {}, env = {}) {
    return sanitizeRuntimeSecrets(settings, env);
}

export function sanitizeSettingsForRestore(settings = {}, env = {}) {
    return sanitizeRuntimeSecrets(settings, env);
}

async function getStorage(env) {
    const storageType = await StorageFactory.getStorageType(env);
    return {
        storageType,
        storageAdapter: StorageFactory.createAdapter(env, storageType),
    };
}

async function readBusinessData(storageAdapter) {
    const [subscriptions, profiles, ruleTemplates] = await Promise.all([
        typeof storageAdapter.getAllSubscriptions === 'function'
            ? storageAdapter.getAllSubscriptions()
            : storageAdapter.get(KV_KEY_SUBS).then((value) => value || []),
        typeof storageAdapter.getAllProfiles === 'function'
            ? storageAdapter.getAllProfiles()
            : storageAdapter.get(KV_KEY_PROFILES).then((value) => value || []),
        listRuleTemplates(storageAdapter),
    ]);

    return {
        subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
        profiles: Array.isArray(profiles) ? profiles : [],
        ruleTemplates: Array.isArray(ruleTemplates) ? ruleTemplates : [],
    };
}

export async function buildBackupPayload(env, options = {}) {
    const { storageAdapter, storageType } = await getStorage(env);
    const settings =
        (await storageAdapter.get(KV_KEY_SETTINGS)) || (await SettingsCache.get(env)) || {};
    const backupConfig = normalizeWebdavConfig(settings);
    const scope = normalizeScope(options.scope || backupConfig.backupScope);
    const businessData = await readBusinessData(storageAdapter);

    const durable = { sourceSnapshots: Object.create(null), regionPreferences: Object.create(null), downloadCounts: Object.create(null) };
    await Promise.all(businessData.subscriptions.filter(s => s?.id && /^https?:\/\//i.test(s.url || '')).map(async source => {
        const [snapshot, preferences] = await Promise.all([
            storageAdapter.get(snapshotKey(source)), storageAdapter.get(regionPreferencesKey(source.id)),
        ]);
        if (snapshot?.sourceUrl === String(source.url).trim() && Array.isArray(snapshot.nodes) && snapshot.nodes.length) {
            durable.sourceSnapshots[source.id] = snapshot;
        }
        if (preferences) durable.regionPreferences[source.id] = preferences;
    }));
    await Promise.all(businessData.profiles.filter(p => p?.id).map(async profile => {
        durable.downloadCounts[profile.id] = await readProfileDownloadCount(storageAdapter, profile);
    }));
    const payload = {
        version: BACKUP_VERSION,
        app: 'MiSub',
        type: BACKUP_TYPE,
        scope,
        exportedAt: new Date().toISOString(),
        source: {
            storageType,
            trigger: options.trigger || 'manual',
        },
        data: {
            subscriptions: cloneJson(businessData.subscriptions),
            profiles: cloneJson(businessData.profiles),
            ruleTemplates: cloneJson(businessData.ruleTemplates),
            settings: null,
            ...durable,
        },
    };

    if (scope === BACKUP_SCOPES.DATA_AND_SETTINGS) {
        payload.data.settings = sanitizeSettingsForBackup(settings, env);
    }

    // Leave room for the API's { payload } envelope. Reject explicitly before upload.
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BACKUP_BYTES - 1024) {
        throw new Error('备份超过 20 MiB 限制，请使用完整 D1 数据库备份');
    }
    return payload;
}

function validateDurableData(data) {
    const sources = new Map(data.subscriptions.filter(s => s?.id).map(s => [String(s.id), s]));
    const profiles = new Set(data.profiles.filter(p => p?.id).map(p => String(p.id)));
    for (const field of ['sourceSnapshots', 'regionPreferences', 'downloadCounts']) {
        if (data[field] === undefined) continue; // Old exports remain compatible.
        if (!data[field] || typeof data[field] !== 'object' || Array.isArray(data[field])) throw Error('无效的持久数据备份');
        for (const [id, value] of Object.entries(data[field])) {
            if (field === 'downloadCounts') {
                if (!profiles.has(id) || !Number.isSafeInteger(value) || value < 0) throw Error('无效的订阅计数备份');
                continue;
            }
            const source = sources.get(id);
            if (!source || !/^https?:\/\//i.test(source.url || '') || !value || typeof value !== 'object' || Array.isArray(value)) throw Error('无效的订阅持久数据备份');
            if (field === 'sourceSnapshots') {
                if (value.sourceUrl !== String(source.url).trim() || !Array.isArray(value.nodes) || !value.nodes.length ||
                    value.nodes.some(n => typeof n !== 'string' || !n.trim())) throw Error('无效的节点快照备份');
            } else {
                if (typeof value.version !== 'string' || !value.overrides || typeof value.overrides !== 'object' || Array.isArray(value.overrides) ||
                    Object.keys(value.overrides).length > 3000 || Object.entries(value.overrides).some(([hash, region]) =>
                        !/^[0-9a-f]{64}$/.test(hash) || !Object.hasOwn(REGION_KEYWORDS, region))) throw Error('无效的地区纠错备份');
            }
        }
    }
}

export function normalizeBackupPayload(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('无效的备份文件格式');
    }

    // New unified format.
    if (raw.type === BACKUP_TYPE && raw.data && typeof raw.data === 'object') {
        if (!Array.isArray(raw.data.subscriptions) || !Array.isArray(raw.data.profiles) ||
            (raw.data.ruleTemplates !== undefined && !Array.isArray(raw.data.ruleTemplates))) throw Error('无效的备份数据集合');
        validateDurableData(raw.data);
        return {
            ...raw,
            scope: normalizeScope(raw.scope),
            data: {
                ...Object.fromEntries(['sourceSnapshots', 'regionPreferences', 'downloadCounts']
                    .filter(field => raw.data[field] !== undefined).map(field => [field, raw.data[field]])),
                subscriptions: Array.isArray(raw.data.subscriptions) ? raw.data.subscriptions : [],
                profiles: Array.isArray(raw.data.profiles) ? raw.data.profiles : [],
                ruleTemplates: Array.isArray(raw.data.ruleTemplates) ? raw.data.ruleTemplates : [],
                settings:
                    raw.data.settings && typeof raw.data.settings === 'object'
                        ? raw.data.settings
                        : null,
            },
        };
    }

    // Legacy local export format: { subscriptions, manualNodes, profiles }.
    if (Array.isArray(raw.subscriptions)) {
        return {
            version: BACKUP_VERSION,
            app: 'MiSub',
            type: BACKUP_TYPE,
            scope: BACKUP_SCOPES.DATA_ONLY,
            exportedAt: raw.exportedAt || new Date().toISOString(),
            source: { storageType: 'legacy-local', trigger: 'import' },
            data: {
                subscriptions: [
                    ...raw.subscriptions,
                    ...(Array.isArray(raw.manualNodes) ? raw.manualNodes : []),
                ],
                profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
                ruleTemplates: Array.isArray(raw.ruleTemplates) ? raw.ruleTemplates : [],
                settings: null,
            },
        };
    }

    throw new Error('无效的备份文件格式');
}

async function syncCollection(storageAdapter, type, items) {
    const finalItems = Array.isArray(items) ? items : [];
    const isProfiles = type === 'profiles';
    const key = isProfiles ? KV_KEY_PROFILES : KV_KEY_SUBS;

    if (storageAdapter.type !== STORAGE_TYPES.KV) {
        const getAll = isProfiles
            ? storageAdapter.getAllProfiles?.bind(storageAdapter)
            : storageAdapter.getAllSubscriptions?.bind(storageAdapter);
        const putItem = isProfiles
            ? storageAdapter.putProfile?.bind(storageAdapter)
            : storageAdapter.putSubscription?.bind(storageAdapter);
        const deleteItem = isProfiles
            ? storageAdapter.deleteProfileById?.bind(storageAdapter)
            : storageAdapter.deleteSubscriptionById?.bind(storageAdapter);

        if (getAll && putItem && deleteItem) {
            const currentItems = await getAll();
            const finalMap = new Map(
                finalItems.filter((item) => item?.id).map((item) => [item.id, item])
            );
            const currentMap = new Map(
                (Array.isArray(currentItems) ? currentItems : [])
                    .filter((item) => item?.id)
                    .map((item) => [item.id, item])
            );

            for (const item of finalMap.values()) {
                const existing = currentMap.get(item.id);
                if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
                    await putItem(item);
                }
            }
            for (const id of currentMap.keys()) {
                if (!finalMap.has(id)) {
                    await deleteItem(id);
                }
            }
            return;
        }
    }

    await storageAdapter.put(key, finalItems);
}

async function createPreRestoreSnapshot(env, storageAdapter, scope) {
    const snapshot = await buildBackupPayload(env, {
        scope:
            scope === BACKUP_SCOPES.DATA_AND_SETTINGS
                ? BACKUP_SCOPES.DATA_AND_SETTINGS
                : BACKUP_SCOPES.DATA_ONLY,
        trigger: 'pre-restore',
    });
    await storageAdapter.put(RESTORE_SNAPSHOT_KEY, snapshot);
    return snapshot;
}

export async function restoreBackupPayload(env, rawPayload, options = {}) {
    const payload = normalizeBackupPayload(rawPayload);
    const scope = normalizeScope(options.scope || payload.scope);
    const { storageAdapter } = await getStorage(env);

    if (options.createSnapshot !== false) {
        await createPreRestoreSnapshot(env, storageAdapter, scope);
    }

    await syncCollection(storageAdapter, 'subscriptions', payload.data.subscriptions);
    await syncCollection(storageAdapter, 'profiles', payload.data.profiles);
    await storageAdapter.put(
        KV_KEY_RULE_TEMPLATES,
        Array.isArray(payload.data.ruleTemplates) ? payload.data.ruleTemplates : []
    );

    // Only supplied records are restored. Old files never erase durable state
    // they could not contain, and runtime leases/backoff records are excluded.
    for (const [id, value] of Object.entries(payload.data.sourceSnapshots || {})) {
        await storageAdapter.put(snapshotKey({ id }), value);
    }
    for (const [id, value] of Object.entries(payload.data.regionPreferences || {})) {
        await storageAdapter.put(regionPreferencesKey(id), value);
    }
    for (const [id, value] of Object.entries(payload.data.downloadCounts || {})) {
        await storageAdapter.put(profileCountKey({ id }), value);
    }
    if (scope === BACKUP_SCOPES.DATA_AND_SETTINGS && payload.data.settings) {
        const currentSettings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
        const restoredSettings = sanitizeSettingsForRestore(payload.data.settings, env);
        const finalSettings = {
            ...restoredSettings,
            webdavBackup: currentSettings.webdavBackup,
        };
        await storageAdapter.put(KV_KEY_SETTINGS, finalSettings);
        SettingsCache.clear();
    }

    return {
        success: true,
        message: '备份已恢复',
        scope,
        restored: {
            subscriptions: payload.data.subscriptions.length,
            profiles: payload.data.profiles.length,
            ruleTemplates: payload.data.ruleTemplates.length,
            settings: scope === BACKUP_SCOPES.DATA_AND_SETTINGS && !!payload.data.settings,
        },
    };
}

function joinWebdavPath(base, path) {
    const trimmedBase = String(base || '').replace(/\/+$/, '');
    const parts = String(path || '')
        .split('/')
        .filter(Boolean)
        .map((part) => encodeURIComponent(part));
    return [trimmedBase, ...parts].join('/');
}

function decodeWebdavPathSegment(segment) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function normalizeWebdavHref(endpoint, href) {
    const endpointUrl = new URL(endpoint);
    const hrefUrl = new URL(String(href || '').replace(/&amp;/gi, '&'), `${endpointUrl.origin}/`);

    // A PROPFIND response can contain absolute URLs. Never turn a URL from a
    // different origin into a path that will later be fetched with credentials.
    if (hrefUrl.origin !== endpointUrl.origin) return null;

    const endpointPath = endpointUrl.pathname.replace(/\/+$/, '');
    const hrefPath = hrefUrl.pathname;
    if (hrefPath !== endpointPath && !hrefPath.startsWith(`${endpointPath}/`)) return null;

    const relativePath = hrefPath.slice(endpointPath.length);
    const decodedParts = relativePath.split('/').filter(Boolean).map(decodeWebdavPathSegment);
    return decodedParts.length ? `/${decodedParts.join('/')}` : '/';
}

function toBasicAuth(username, password) {
    const raw = `${username || ''}:${password || ''}`;
    if (typeof btoa === 'function') {
        return btoa(unescape(encodeURIComponent(raw)));
    }
    return Buffer.from(raw, 'utf8').toString('base64');
}

function assertSafeWebdavConfig(config) {
    if (!config.endpoint || !/^https:\/\//i.test(config.endpoint)) {
        throw new Error('WebDAV 地址必须使用 https://');
    }
    if (!config.username || !config.password) {
        throw new Error('请填写 WebDAV 用户名和密码');
    }
}

async function webdavFetch(config, path, init = {}) {
    assertSafeWebdavConfig(config);
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Basic ${toBasicAuth(config.username, config.password)}`);
    const url = joinWebdavPath(config.endpoint, path);
    // Backup bodies contain credentials. Never replay them to a redirected origin.
    let currentUrl = url;
    for (let attempt = 0; attempt <= 3; attempt++) {
        const response = await fetch(currentUrl, { ...init, headers, redirect: 'manual',
            signal: init.signal || AbortSignal.timeout(15000) });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        await response.body?.cancel();
        const next = new URL(response.headers.get('Location') || '', currentUrl);
        if (attempt === 3 || next.origin !== new URL(url).origin || !response.headers.get('Location')) {
            throw new Error('WebDAV redirect rejected');
        }
        currentUrl = next.toString();
    }
}

async function ensureRemoteDirectory(config) {
    const parts = String(config.remotePath || '/MiSub')
        .split('/')
        .filter(Boolean);
    let current = '';
    for (const part of parts) {
        current += `/${part}`;
        const response = await webdavFetch(config, current, { method: 'MKCOL' });
        if (![200, 201, 204, 405].includes(response.status)) {
            throw new Error(`创建 WebDAV 目录失败: HTTP ${response.status}`);
        }
    }
}

export function formatBackupFilename(
    template = DEFAULT_WEBDAV_CONFIG.filenameTemplate,
    now = new Date()
) {
    // Keep backup names stable at UTC+8 regardless of the Worker/runtime
    // timezone (Cloudflare Workers normally exposes UTC).
    const utcPlus8 = new Date(now.getTime() + BACKUP_TIMEZONE_OFFSET_MS);
    const datetime = utcPlus8.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const date = utcPlus8.toISOString().slice(0, 10);
    const safeTemplate = template || DEFAULT_WEBDAV_CONFIG.filenameTemplate;
    return safeTemplate.replace(/\{datetime\}/g, datetime).replace(/\{date\}/g, date);
}

async function updateBackupStatus(env, patch) {
    const { storageAdapter } = await getStorage(env);
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    const update = current => ({
        ...current, webdavBackup: { ...normalizeWebdavConfig(current), ...patch },
    });
    const saved = typeof storageAdapter.updateSettingsByKey === 'function'
        ? await storageAdapter.updateSettingsByKey(KV_KEY_SETTINGS, update)
        : update(settings);
    if (typeof storageAdapter.updateSettingsByKey !== 'function') await storageAdapter.put(KV_KEY_SETTINGS, saved);
    const webdavBackup = saved.webdavBackup;
    SettingsCache.clear();
    return webdavBackup;
}

export async function performWebdavBackup(env, options = {}) {
    const { storageAdapter } = await getStorage(env);
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    const config = normalizeWebdavConfig(settings);
    assertSafeWebdavConfig(config);

    const payload = await buildBackupPayload(env, {
        scope: options.scope || config.backupScope,
        trigger: options.trigger || 'manual',
    });
    const filename = formatBackupFilename(config.filenameTemplate);
    const remotePath = `${String(config.remotePath || '/MiSub').replace(/\/+$/, '')}/${filename}`;
    const body = JSON.stringify(payload, null, 2);

    try {
        await ensureRemoteDirectory(config);
        const response = await webdavFetch(config, remotePath, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body,
        });
        if (!response.ok && response.status !== 201 && response.status !== 204) {
            throw new Error(`WebDAV 上传失败: HTTP ${response.status}`);
        }

        await updateBackupStatus(env, {
            lastBackupAt: payload.exportedAt,
            lastBackupStatus: 'success',
            lastBackupMessage: '备份成功',
            lastBackupFile: remotePath,
        });

        return {
            success: true,
            message: '备份成功',
            file: remotePath,
            size: body.length,
            scope: payload.scope,
            timestamp: payload.exportedAt,
        };
    } catch (error) {
        await updateBackupStatus(env, {
            lastBackupAt: new Date().toISOString(),
            lastBackupStatus: 'failed',
            lastBackupMessage: error.message || '备份失败',
        });
        throw error;
    }
}

export async function handleWebdavBackupStatus(env) {
    const { storageAdapter } = await getStorage(env);
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    const config = normalizeWebdavConfig(settings);
    const { password, ...safeConfig } = config;
    return createJsonResponse({ success: true, data: safeConfig });
}

export async function handleWebdavBackupTest(request, env) {
    if (request.method !== 'POST') return createErrorResponse('Method Not Allowed', 405);
    try {
        const { storageAdapter } = await getStorage(env);
        const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
        const body = await readJsonWithLimit(request, JSON_BODY_LIMITS.large).catch((e) => {
            if (e?.status === 413) throw e;
            return {};
        });
        const config = {
            ...normalizeWebdavConfig(settings),
            ...(body?.webdavBackup || body || {}),
        };
        assertSafeWebdavConfig(config);
        await ensureRemoteDirectory(config);
        return createJsonResponse({ success: true, message: 'WebDAV 连接测试成功' });
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || 'WebDAV 连接测试失败' },
            error.status || 400
        );
    }
}

export async function handleManualWebdavBackup(request, env) {
    if (request.method !== 'POST') return createErrorResponse('Method Not Allowed', 405);
    try {
        const body = await readJsonWithLimit(request, JSON_BODY_LIMITS.large).catch((e) => {
            if (e?.status === 413) throw e;
            return {};
        });
        const result = await performWebdavBackup(env, { scope: body.scope, trigger: 'manual' });
        return createJsonResponse(result);
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || '备份失败' },
            error.status || 500
        );
    }
}

export async function handleBackupExport(request, env) {
    if (request.method !== 'POST') return createErrorResponse('Method Not Allowed', 405);
    try {
        const body = await readJsonWithLimit(request, JSON_BODY_LIMITS.large).catch((e) => {
            if (e?.status === 413) throw e;
            return {};
        });
        const payload = await buildBackupPayload(env, {
            scope: body.scope,
            trigger: 'local-export',
        });
        return createJsonResponse({ success: true, exportData: payload });
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || '导出失败' },
            error.status || 500
        );
    }
}

export async function handleBackupRestore(request, env) {
    if (request.method !== 'POST') return createErrorResponse('Method Not Allowed', 405);
    try {
        const body = await readJsonWithLimit(request, MAX_BACKUP_BYTES);
        const payload = body?.payload || body?.backup || body;
        const result = await restoreBackupPayload(env, payload, { scope: body?.scope });
        return createJsonResponse(result);
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || '恢复失败' },
            error.status || 400
        );
    }
}

export async function listWebdavBackupFiles(env) {
    const { storageAdapter } = await getStorage(env);
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    const config = normalizeWebdavConfig(settings);
    const remoteDir = String(config.remotePath || '/MiSub').replace(/\/+$/, '');
    const response = await webdavFetch(config, remoteDir || '/', {
        method: 'PROPFIND',
        headers: { Depth: '1' },
    });
    if (!response.ok) throw new Error(`列出 WebDAV 备份失败: HTTP ${response.status}`);

    const xml = new TextDecoder().decode(await readResponseBufferWithLimit(response, 1024 * 1024));
    const hrefs = Array.from(xml.matchAll(/<[^:>]*:?href[^>]*>([^<]+)<\/[^:>]*:?href>/gi))
        .map((match) => normalizeWebdavHref(config.endpoint, match[1]))
        .filter(Boolean);
    const files = hrefs
        .filter((href) => href.endsWith('.json') && href.includes(BACKUP_FILENAME_PREFIX))
        .map((href) => ({
            path: href,
            name: href.split('/').filter(Boolean).pop(),
        }))
        .sort((a, b) => String(b.name).localeCompare(String(a.name)));

    return files;
}

export async function handleWebdavBackupList(request, env) {
    if (request.method !== 'GET') return createErrorResponse('Method Not Allowed', 405);
    try {
        const files = await listWebdavBackupFiles(env);
        return createJsonResponse({ success: true, data: files });
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || '获取备份列表失败', data: [] },
            400
        );
    }
}

export async function fetchWebdavBackupFile(env, filePath) {
    const { storageAdapter } = await getStorage(env);
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    const config = normalizeWebdavConfig(settings);
    const response = await webdavFetch(config, filePath, { method: 'GET' });
    if (!response.ok) throw new Error(`读取 WebDAV 备份失败: HTTP ${response.status}`);
    return JSON.parse(new TextDecoder().decode(await readResponseBufferWithLimit(response, MAX_BACKUP_BYTES)));
}

export async function handleWebdavRestore(request, env) {
    if (request.method !== 'POST') return createErrorResponse('Method Not Allowed', 405);
    try {
        const body = await readJsonWithLimit(request, MAX_BACKUP_BYTES);
        const payload =
            body.payload || (body.file ? await fetchWebdavBackupFile(env, body.file) : null);
        const result = await restoreBackupPayload(env, payload, { scope: body.scope });
        return createJsonResponse(result);
    } catch (error) {
        return createJsonResponse(
            { success: false, message: error.message || '恢复失败' },
            error.status || 400
        );
    }
}
