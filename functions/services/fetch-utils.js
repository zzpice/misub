/**
 * 网络请求工具集
 * 提供自动重试、超时及逐跳 URL 校验
 */

import { safeFetchNetworkUrl } from '../modules/security-utils.js';

const DEFAULT_RETRY_OPTIONS = {
    MAX_RETRIES: 2, // 最多重试 2 次
    BASE_DELAY: 1000, // 重试基础延迟 1 秒
    RETRYABLE_STATUS: [500, 502, 503, 504, 429], // 可重试的 HTTP 状态码
};

/**
 * 带重试的 fetch 函数
 * @param {string} url - 请求 URL
 * @param {Object} init - fetch 初始化选项
 * @param {Object} options - 重试选项 (maxRetries, baseDelay, retryableStatus)
 * @returns {Promise<Response>} - 响应对象
 */
export async function fetchWithRetry(url, init = {}, options = {}) {
    const {
        maxRetries = DEFAULT_RETRY_OPTIONS.MAX_RETRIES,
        baseDelay = DEFAULT_RETRY_OPTIONS.BASE_DELAY,
        retryableStatus = DEFAULT_RETRY_OPTIONS.RETRYABLE_STATUS,
    } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await safeFetchNetworkUrl(url, {
                ...init,
                signal: init.signal || AbortSignal.timeout(12000),
            });

            if (response.ok) {
                return response;
            }

            // 检查状态码是否可重试
            if (!retryableStatus.includes(response.status)) {
                return response; // 不可重试的错误直接返回
            }

            // 如果是最后一次尝试，则直接返回
            if (attempt === maxRetries) {
                return response;
            }

            // 构造错误以便进入 catch 块进行延迟处理
            await response.body?.cancel();
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (error.status === 400) throw error;
            if (attempt === maxRetries) {
                break;
            }

            // 指数退避策略: 1s, 2s, 4s...
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(
                `[Fetch Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay / 1000}s...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Subscription fetch failed after ${maxRetries} retries`);
}
