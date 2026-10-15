/**
 * Unified config file.
 * Includes constants, KV keys, and default settings for the worker.
 */

// KV storage keys
export const KV_KEY_SUBS = 'misub_subscriptions_v1';
export const KV_KEY_PROFILES = 'misub_profiles_v1';
export const KV_KEY_SETTINGS = 'worker_settings_v1';

// Auth
export const COOKIE_NAME = 'auth_session';
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_RENEW_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // renew after 7 days of activity
export const DEFAULT_SUBCONVERTER_BACKEND = 'subapi.cmliussss.net';

// Default settings
export const DEFAULT_SETTINGS = {
    FileName: 'Zzp-Sub',
    mytoken: 'auto',
    profileToken: 'profiles',
    transformConfigMode: 'builtin',
    transformConfig: '',
    ruleLevel: 'std',
    builtinSkipCertVerify: false,
    builtinEnableUdp: true,
    builtinLoonSkipCertVerify: false,
    enableAccessLog: false,
    accessLogPersistenceMode: 'light',

    enableTrafficNode: false,
    enableFlagEmoji: true,

    storageType: 'kv',
    // 新增：借鉴Sub-Store和miaomiaowu的功能
    enableSubscriptionSync: true, // 启用订阅同步
    subscriptionCacheExpireMinutes: 60, // 订阅缓存过期时间（分钟）
    enableTrafficMonitor: true, // 启用流量监控
    enableTemplateEngine: true, // 启用模板引擎
    enableEnhancedLogging: true, // 启用增强日志
    maxSubscriptionConcurrency: 3, // 最大订阅并发数
    defaultUserAgent: 'clash-meta/2.5.0', // 默认User-Agent
    defaultPrefixSettings: {
        enableManualNodes: true,
        enableSubscriptions: true,
        manualNodePrefix: '手动节点',
        prependGroupName: false,
    },
    defaultOperators: [], // 新版操作符链式处理 (New Unified Pipeline)
    regionOverrides: [], // 自定义节点地区覆盖规则：{ pattern, region, flags }
    // @deprecated 使用 defaultOperators 代替
    defaultOperators: [],

    // 自定义公开页设置

    webdavBackup: {
        enabled: false,
        endpoint: '',
        username: '',
        password: '',
        remotePath: '/Zzp-Sub',
        filenameTemplate: 'zzp-sub-backup-{datetime}.json',
        backupScope: 'dataOnly',
        autoBackup: false,
        interval: 'daily',
        retentionCount: 7,
        lastCheckedAt: null,
        lastBackupAt: null,
        lastBackupStatus: null,
        lastBackupMessage: '',
        lastBackupFile: '',
    },
    externalApi: {
        enabled: false,
        tokens: [
            {
                name: 'default',
                token: '',
            },
        ],
    },
    // 订阅转换设置
    subconverter: {
        engineMode: 'builtin',
        defaultBackend: DEFAULT_SUBCONVERTER_BACKEND,
        defaultOptions: {
            udp: true,
            emoji: true,
            scv: true,
            tfo: false,
            sort: false,
            list: false,
        },
    },
};

// System constants
export const SYSTEM_CONSTANTS = {
    VERSION: '1.1.0',
    // Use v2rayN UA to fetch subscriptions reliably.
    FETCHER_USER_AGENT: 'v2rayN/7.23',
};
