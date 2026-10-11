import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeInfo } from '../utils/geo-utils.js';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';
import { KV_KEY_SUBS } from '../config.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';
import { fetchPreviewSourceNodes } from './preview-source.js';
import { getRegionOptions } from '../utils/geo-utils.js';

/**
 * 处理单个订阅模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} subscriptionId - 订阅ID
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleSingleSubscriptionMode(
    request,
    env,
    subscriptionId,
    userAgent,
    skipCertVerify = false
) {
    const storageAdapter = StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );

    // 查找订阅
    const subscription =
        typeof storageAdapter.getSubscriptionById === 'function'
            ? await storageAdapter.getSubscriptionById(subscriptionId)
            : ((await storageAdapter.get(KV_KEY_SUBS)) || []).find(
                  (sub) => sub.id === subscriptionId
              );

    if (!subscription || !subscription.enabled) {
        return createJsonResponse({ error: '订阅不存在或已禁用' }, 404);
    }

    // 检查是否为手工节点
    if (!subscription.url.startsWith('http')) {
        // 手工节点：直接解析节点URL
        const nodeInfo = parseNodeInfo(subscription.url);
        const manualNodeResult = {
            subscriptionName: subscription.name || '手工节点',
            url: subscription.url,
            success: true,
            nodes: [
                {
                    ...nodeInfo,
                    subscriptionName: subscription.name || '手工节点',
                },
            ],
            error: null,
            isManualNode: true,
        };

        return {
            success: true,
            subscriptions: [manualNodeResult],
            nodes: manualNodeResult.nodes,
            totalCount: manualNodeResult.nodes.length,
            stats: {
                protocols: { [nodeInfo.protocol]: 1 },
                regions: { [nodeInfo.region || '其他']: 1 },
            },
        };
    }

    // 已保存的订阅在个人模式下只预览 D1 最后成功快照，不再临时抓上游。
    const result = await fetchPreviewSourceNodes(
        storageAdapter,
        env,
        subscription,
        userAgent,
        skipCertVerify
    );

    if (result.snapshotMissing) {
        return {
            success: false,
            error: result.error,
            subscriptions: [result],
            nodes: [],
            totalCount: 0,
            stats: { protocols: {}, regions: {} },
        };
    }

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        regionOptions: getRegionOptions(),
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes),
        },
    };
}

/**
 * 处理直接URL模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {string} subscriptionUrl - 订阅URL
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleDirectUrlMode(
    subscriptionUrl,
    userAgent,
    skipCertVerify = false,
    plusAsSpace = false
) {
    const result = await fetchSubscriptionNodes(
        subscriptionUrl,
        '预览订阅',
        userAgent,
        null,
        false,
        '',
        null,
        skipCertVerify,
        plusAsSpace
    );

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes),
        },
    };
}
