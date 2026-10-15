import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse, JSON_BODY_LIMITS, readJsonWithLimit } from '../utils.js';
import { handleProfileMode } from './profile-handler.js';
import { handleSingleSubscriptionMode, handleDirectUrlMode } from './single-subscription.js';

/**
 * 确定请求模式
 * @param {Object} requestData - 请求数据
 * @returns {string} 请求模式
 */
export function determineRequestMode(requestData) {
    if (requestData.profileId) {
        return 'profile';
    } else if (requestData.subscriptionId) {
        return 'subscription';
    } else if (requestData.url) {
        return 'direct';
    }
    return 'unknown';
}

/**
 * 处理订阅节点请求的主要入口
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSubscriptionNodesRequest(request, env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
        const {
            url: subscriptionUrl,
            subscriptionId,
            profileId,
            userAgent = 'MiSub-Node-Preview/1.0',
            applyTransform = false, // 管理后台默认不应用转换，由前端控制
            skipCertVerify = false,
            plusAsSpace = false,
        } = requestData;

        // 验证必需参数
        if (!subscriptionUrl && !subscriptionId && !profileId) {
            return createJsonResponse(
                {
                    error: '请提供订阅URL、订阅ID或订阅组ID',
                },
                400
            );
        }

        // 根据参数确定请求模式
        const mode = determineRequestMode(requestData);

        let result;
        switch (mode) {
            case 'profile':
                // [Modified] Default applyTransform to true for profile preview if not specified
                // This ensures preview matches the final output ("What You See Is What You Get")
                result = await handleProfileMode(
                    request,
                    env,
                    profileId,
                    userAgent,
                    requestData.applyTransform !== undefined ? requestData.applyTransform : true,
                    skipCertVerify
                );
                break;
            case 'subscription':
                result = await handleSingleSubscriptionMode(
                    request,
                    env,
                    subscriptionId,
                    userAgent,
                    skipCertVerify
                );
                break;
            case 'direct':
                result = await handleDirectUrlMode(
                    subscriptionUrl,
                    userAgent,
                    skipCertVerify,
                    plusAsSpace
                );
                break;
            default:
                return createJsonResponse(
                    {
                        error: '无效的请求参数',
                    },
                    400
                );
        }

        return result instanceof Response ? result : createJsonResponse(result);
    } catch (e) {
        return createJsonResponse(
            {
                error: `获取节点列表失败: ${e.message}`,
            },
            e.status || 500
        );
    }
}
