<script setup>
    const props = defineProps({
        editingSubscription: {
            type: Object,
            required: true,
        },
    });
    import Input from '../../ui/Input.vue';
    import Switch from '../../ui/Switch.vue';
    import { ref, watch } from 'vue';
    import { fetchNodeCount } from '../../../lib/api.js';
    import { useToastStore } from '../../../stores/toast.js';
    import { useI18n } from '../../../i18n/index.js';
    import { getRegionOptions } from '../../../../functions/modules/utils/geo-utils.js';

    const { showToast } = useToastStore();
    const { t } = useI18n();
    const regionOptions = getRegionOptions();

    // 使用独立的本地状态，防止用户清空输入框时开关自动跳回关闭状态
    const useFetchProxy = ref(false);
    const isTestingProxy = ref(false);

    // 当弹窗传入新订阅信息时，初始化开关状态
    watch(
        () => props.editingSubscription,
        (newSub) => {
            if (newSub) {
                useFetchProxy.value = !!newSub.fetchProxy;
                if (typeof newSub.autoUpdateEnabled !== 'boolean')
                    newSub.autoUpdateEnabled = true;
                if (!Number.isFinite(Number(newSub.autoUpdateIntervalMinutes)) ||
                    Number(newSub.autoUpdateIntervalMinutes) < 5)
                    newSub.autoUpdateIntervalMinutes = 60;
            }
        },
        { immediate: true }
    );

    // 当用户主动关闭开关时，清理绑定的代理地址
    watch(useFetchProxy, (val) => {
        if (!val && props.editingSubscription) {
            props.editingSubscription.fetchProxy = '';
        }
    });

    const testProxyConnectivity = async () => {
        if (!props.editingSubscription.fetchProxy || !props.editingSubscription.url) {
            showToast(t('subscriptions.proxyRequired'), 'warning');
            return;
        }
        isTestingProxy.value = true;
        try {
            const res = await fetchNodeCount(
                props.editingSubscription.url,
                props.editingSubscription.fetchProxy,
                props.editingSubscription.plusAsSpace,
                props.editingSubscription.customUserAgent
            );
            if (res.success) {
                showToast(
                    t('subscriptions.proxyTestSuccess', { count: res.data.count }),
                    'success'
                );
            } else {
                showToast(t('subscriptions.proxyTestFailed', { message: res.error }), 'error');
            }
        } catch (err) {
            showToast(t('subscriptions.proxyTestError', { message: err.message }), 'error');
        } finally {
            isTestingProxy.value = false;
        }
    };
</script>

<template>
    <!-- 订阅名称 -->
    <div>
        <Input
            id="sub-edit-name"
            v-model="editingSubscription.name"
            :label="t('subscriptions.nameLabel')"
            :placeholder="t('subscriptions.nameAutoPlaceholder')"
        />
    </div>

    <!-- 订阅链接 -->
    <div>
        <Input
            id="sub-edit-url"
            v-model="editingSubscription.url"
            :label="t('subscriptions.urlLabel')"
            placeholder="https://..."
            class="font-mono"
        />
    </div>

    <!-- Independent update policy for each HTTP source. -->
    <div class="pt-3 border-t border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between gap-4">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    自动更新上游快照
                </span>
                <p class="text-xs text-gray-500 mt-1">
                    下游访问时按需检查；关闭后只能手动抓取，不需要保持管理页面打开。
                </p>
            </div>
            <Switch v-model="editingSubscription.autoUpdateEnabled" />
        </div>
        <label
            v-if="editingSubscription.autoUpdateEnabled"
            class="mt-3 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"
        >
            更新间隔（分钟）
            <input
                v-model.number="editingSubscription.autoUpdateIntervalMinutes"
                type="number"
                min="5"
                step="5"
                class="w-28 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent px-3 py-2"
                @blur="editingSubscription.autoUpdateIntervalMinutes = Math.max(
                    5, Math.floor(Number(editingSubscription.autoUpdateIntervalMinutes) || 60)
                )"
            />
        </label>
    </div>

    <div class="pt-3 border-t border-gray-100 dark:border-gray-700">
        <label for="sub-default-region" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">订阅源默认地区</label>
        <select id="sub-default-region" v-model="editingSubscription.defaultRegion"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
            <option value="">自动识别（不设默认值）</option>
            <option v-for="region in regionOptions" :key="region.name" :value="region.name">
                {{ region.flag }} {{ region.name }}
            </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">仅在节点名称无法明确识别时使用，不覆盖国旗、国家或城市信息。</p>
    </div>

    <!-- 专属拉取代理 -->
    <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between mb-2">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                    t('subscriptions.fetchProxyTitle')
                }}</span>
                <p class="text-xs text-gray-500 mt-0.5">{{ t('subscriptions.fetchProxyDesc') }}</p>
            </div>
            <Switch v-model="useFetchProxy" />
        </div>

        <!-- 代理输入框 (动画展开) -->
        <div v-if="useFetchProxy" class="mt-3 space-y-2 animate-fade-in">
            <div class="flex gap-2">
                <Input
                    id="sub-edit-proxy"
                    v-model="editingSubscription.fetchProxy"
                    :placeholder="t('subscriptions.proxyPlaceholder')"
                    class="font-mono text-sm flex-1"
                />
                <button
                    type="button"
                    @click="testProxyConnectivity"
                    :disabled="
                        isTestingProxy ||
                        !editingSubscription.fetchProxy ||
                        !editingSubscription.url
                    "
                    class="h-[46px] px-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center whitespace-nowrap"
                >
                    <svg
                        v-if="isTestingProxy"
                        class="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        ></circle>
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-4 h-4 mr-1.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                    </svg>
                    {{ isTestingProxy ? t('subscriptions.testing') : t('subscriptions.testProxy') }}
                </button>
            </div>
            <p class="text-[11px] text-indigo-600 dark:text-indigo-400">
                {{ t('subscriptions.fetchProxyHint') }}
            </p>
        </div>
    </div>
</template>

<style scoped>
    .animate-fade-in {
        animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-3px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
