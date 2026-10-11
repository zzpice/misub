import { resolveNodeRegion, getRegionEmoji } from '../utils/geo-utils.js';
// 地区展示配置：包含 Emoji 和标准中文名称
const REGION_DISPLAY_CONFIG = {
    香港: { flag: '🇭🇰', name: '香港节点' },
    台湾: { flag: '🇹🇼', name: '台湾节点' },
    日本: { flag: '🇯🇵', name: '日本节点' },
    新加坡: { flag: '🇸🇬', name: '狮城节点' },
    美国: { flag: '🇺🇸', name: '美国节点' },
    韩国: { flag: '🇰🇷', name: '韩国节点' },
    英国: { flag: '🇬🇧', name: '英国节点' },
    德国: { flag: '🇩🇪', name: '德国节点' },
    法国: { flag: '🇫🇷', name: '法国节点' },
    加拿大: { flag: '🇨🇦', name: '加拿大节点' },
    澳大利亚: { flag: '🇦🇺', name: '澳洲节点' },
    巴西: { flag: '🇧🇷', name: '巴西节点' },
    西班牙: { flag: '🇪🇸', name: '西班牙节点' },
    荷兰: { flag: '🇳🇱', name: '荷兰节点' },
    俄罗斯: { flag: '🇷🇺', name: '俄国节点' },
    印度: { flag: '🇮🇳', name: '印度节点' },
    土耳其: { flag: '🇹🇷', name: '土耳其节点' },
};

export function groupNodeLinesByRegion(nodes = [], options = {}) {
    const groups = new Map();

    nodes.forEach((node) => {
        const tagName = node.tag || node.name;
        // Generated URLs already contain the source-corrected flag. Treat that
        // final display marker as authoritative: otherwise a second regex pass
        // would undo a user edit after generation had applied manual > regex.
        const finalizedFlag = options.regionsAlreadyResolved
            ? String(tagName || '').match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0]
            : null;
        const finalizedRegion = finalizedFlag ? resolveNodeRegion(finalizedFlag) : '';
        const region = resolveNodeRegion(tagName, {
            manualRegion: node.manualRegion || node.metadata?.manualRegion || node.metadata?.resolvedRegion ||
                (finalizedRegion !== '其他' ? finalizedRegion : ''),
            regionOverrides: options.regionOverrides,
            defaultRegion: node.defaultRegion,
        });
        // 4. 构造标准的展示组名
        const config = REGION_DISPLAY_CONFIG[region] || { flag: getRegionEmoji(region), name: `${region}节点` };
        const groupName = `${config.flag} ${config.name}`;

        if (!groups.has(groupName)) {
            groups.set(groupName, []);
        }
        groups.get(groupName).push(node);
    });

    const result = [];
    groups.forEach((matchedNodes, name) => {
        result.push({
            name,
            tags: matchedNodes.map((item) => item.tag || item.name),
            nodes: matchedNodes,
            count: matchedNodes.length,
            selectorTag: `${name} 选择`,
            urltestTag: `${name} 测速`,
            fallbackTag: `${name} 兜底`,
        });
    });

    return result;
}
