/**
 * Default settings constants.
 * @author MiSub Team
 */

import { DEFAULT_SUBCONVERTER_BACKEND } from './subconverter-backends.js';

export const DEFAULT_SETTINGS = {
    FileName: 'Zzp-Sub',
    mytoken: 'auto',
    profileToken: 'profiles',
    defaultLocale: 'zh-CN',
    transformConfigMode: 'builtin',
    transformConfig: '',
    ruleLevel: 'std',
    builtinSkipCertVerify: false,
    builtinEnableUdp: true,
    builtinLoonSkipCertVerify: false,
    enableAccessLog: false,
    accessLogPersistenceMode: 'light',
    mergeExpireStrategy: 'max',

    enableTrafficNode: false,
    enableFlagEmoji: true,

    storageType: 'd1',
    defaultPrefixSettings: {
        enableManualNodes: true,
        enableSubscriptions: true,
        manualNodePrefix: '\u624b\u52a8\u8282\u70b9',
        subscriptionPrefix: '',
        prependGroupName: false,
    },
    manualNodeGroupOrder: [], // 用户自定义的分组顺序
    // 首页「待处理事项」里被用户主动忽略的条目 id。
    // 存在设置里是为了跨设备同步（原先只存 localStorage，换设备就丢）。
    // 条目的 id 都是固定字符串（见 src/utils/dashboard-health.js），跨设备可比对。
    dismissedHealthItems: [],
    defaultOperators: [],
    regionOverrides: [],

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

    customDnsOverride: '',
};

export const DEFAULT_NODE_FORM = {
    name: '',
    url: '',
    enabled: true,
    fetchProxy: '',
};

export const DEFAULT_PROFILE_FORM = {
    name: '',
    customId: '',
    transformConfigMode: 'global',
    transformConfig: '',
    ruleLevel: '', // 为空表示跟随全局配置
    subscriptions: [],
    manualNodes: [],
    enabled: true,
    prefixSettings: {
        enableManualNodes: true,
        enableSubscriptions: true,
        manualNodePrefix: '\u624b\u52a8\u8282\u70b9',
        subscriptionPrefix: '',
        prependGroupName: null,
    },
    subconverter: {
        engineMode: '',
        backend: '',
        options: {
            udp: null,
            emoji: null,
            scv: null,
            sort: null,
            tfo: null,
            list: null,
        },
    },
    nodeTransform: null,
    nodeTransformPresetId: '',
};
