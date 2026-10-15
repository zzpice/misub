/**
 * Source previews use the same durable data as downstream subscriptions in
 * personal mode. Merely opening the preview must never refetch an upstream.
 * The legacy non-personal path retains its on-demand fetch behavior.
 */
import { isPersonalMode } from '../personal-mode.js';
import { readSourceSnapshot } from '../../services/source-snapshot-service.js';
import { parseNodeList } from '../utils/node-parser.js';
import { filterNodeObjects, parseFilterRuleText } from '../utils/node-cleaner.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';
import { readRegionPreferences, applySourceRegions } from '../../services/region-preferences.js';

export const SNAPSHOT_MISSING_MESSAGE =
    '尚未保存此订阅的节点快照。请在上游订阅链接有效时，点击订阅卡片的刷新按钮，成功后即可离线预览和下游订阅。';

export async function fetchPreviewSourceNodes(
    storage,
    env,
    subscription,
    userAgent,
    skipCertVerify = false
) {
    if (!isPersonalMode(env)) {
        return fetchSubscriptionNodes(
            subscription.url,
            subscription.name,
            userAgent,
            subscription.customUserAgent,
            false,
            subscription.exclude,
            subscription.fetchProxy,
            skipCertVerify,
            Boolean(subscription?.plusAsSpace),
            subscription?.enableNodeCache === true
        );
    }

    const snapshot = await readSourceSnapshot(storage, subscription);
    if (!snapshot?.nodes?.length) {
        return {
            subscriptionName: subscription.name,
            url: subscription.url,
            success: false,
            nodes: [],
            error: SNAPSHOT_MISSING_MESSAGE,
            snapshotMissing: true,
        };
    }

    let nodes = parseNodeList(snapshot.nodes.join('\n'), {
        plusAsSpace: Boolean(subscription.plusAsSpace),
    });
    if (subscription.exclude?.trim()) {
        const { includeRules, excludeRules } = parseFilterRuleText(subscription.exclude);
        if (includeRules.hasRules) nodes = filterNodeObjects(nodes, includeRules, 'include');
        if (excludeRules.hasRules) nodes = filterNodeObjects(nodes, excludeRules, 'exclude');
    }

    const saved = await readRegionPreferences(storage, subscription.id);
    const settings = (await storage.get('worker_settings_v1')) || {};
    const localized = await applySourceRegions(
        nodes,
        subscription,
        saved,
        settings.regionOverrides
    );
    return {
        subscriptionName: subscription.name,
        url: subscription.url,
        success: true,
        nodes: localized.map((node) => ({ ...node, subscriptionName: subscription.name })),
        error: null,
        snapshotUpdatedAt: snapshot.updatedAt,
    };
}
