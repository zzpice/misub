/**
 * Default settings constants.
 * @author MiSub Team
 */

import { DEFAULT_SUBCONVERTER_BACKEND } from './subconverter-backends.js';

export const DEFAULT_SETTINGS = {
    FileName: 'MiSub',
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

    storageType: 'kv',
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
    defaultNodeTransform: {
        enabled: false,
        filter: {
            include: { enabled: false, rules: [] },
            exclude: { enabled: false, rules: [] },
            protocols: { enabled: false, values: [] },
            regions: { enabled: false, values: [] },
            script: { enabled: false, expression: '' },
            useless: { enabled: false },
        },
        rename: {
            regex: { enabled: false, rules: [] },
            script: { enabled: false, expression: '' },
            template: {
                enabled: false,
                template: '{emoji}{region}-{protocol}-{index}',
                indexStart: 1,
                indexPad: 2,
                indexScope: 'regionProtocol',
                regionAlias: {},
                protocolAlias: { hysteria2: 'hy2' },
            },
        },
        dedup: {
            enabled: false,
            mode: 'serverPort',
            includeProtocol: false,
            prefer: { protocolOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
        },
        sort: {
            enabled: false,
            nameIgnoreEmoji: true,
            keys: [
                {
                    key: 'region',
                    order: 'asc',
                    customOrder: [
                        '\u9999\u6e2f',
                        '\u53f0\u6e7e',
                        '\u65e5\u672c',
                        '\u65b0\u52a0\u5761',
                        '\u7f8e\u56fd',
                        '\u97e9\u56fd',
                        '\u82f1\u56fd',
                        '\u5fb7\u56fd',
                        '\u6cd5\u56fd',
                        '\u52a0\u62ff\u5927',
                    ],
                },
                {
                    key: 'protocol',
                    order: 'asc',
                    customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'],
                },
                { key: 'name', order: 'asc' },
            ],
        },
    },
    nodeTransformPresets: [],
    regionOverrides: [],

    webdavBackup: {
        enabled: false,
        endpoint: '',
        username: '',
        password: '',
        remotePath: '/MiSub',
        filenameTemplate: 'misub-backup-{datetime}.json',
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
