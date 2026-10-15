<script setup>
    import SectionHeader from '../SectionHeader.vue';
    import Input from '../../ui/Input.vue';
    import Switch from '../../ui/Switch.vue';
    import { useI18n } from '../../../i18n/index.js';

    defineProps({ settings: { type: Object, required: true } });
    const { t } = useI18n();
</script>

<template>
    <div class="space-y-8">
        <!-- 默认显示语言 -->
        <div class="settings-section">
            <SectionHeader
                :title="t('settings.defaultLanguageTitle')"
                :description="t('settings.defaultLanguageDesc')"
                tone="amber"
            >
                <template #icon>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="m5 8 6 6"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="m4 14 6-6 2-3"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M2 5h12"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 2h1"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="m22 22-5-10-5 10"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M14 18h6"
                        />
                    </svg>
                </template>
            </SectionHeader>
            <div class="max-w-xs">
                <select
                    v-model="settings.defaultLocale"
                    class="block w-full px-3 py-2.5 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 sub-radius-lg shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500/40 focus:border-amber-500 sm:text-sm dark:text-white transition-colors"
                >
                    <option value="zh-CN">{{ t('settings.defaultLanguageZh') }}</option>
                    <option value="en-US">{{ t('settings.defaultLanguageEn') }}</option>
                </select>
            </div>
        </div>

        <!-- 订阅基本信息配置 -->
        <div class="settings-section">
            <SectionHeader
                :title="t('settings.subscriptionConfigTitle')"
                :description="t('settings.subscriptionConfigDesc')"
                tone="indigo"
            >
                <template #icon>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </template>
            </SectionHeader>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <Input
                        :label="t('settings.customFileName')"
                        v-model="settings.FileName"
                        class="sub-radius-lg"
                    />
                </div>
            </div>
        </div>

        <!-- 功能开关区域 -->
        <div class="settings-section">
            <SectionHeader
                :title="t('settings.featureControlTitle')"
                :description="t('settings.featureControlDesc')"
                tone="green"
            >
                <template #icon>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                    </svg>
                </template>
            </SectionHeader>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- 流量与到期时间节点 -->
                <div
                    class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 sub-radius-lg"
                >
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-200">
                            {{ t('settings.trafficNodeTitle') }}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {{ t('settings.trafficNodeDesc') }}
                        </p>
                    </div>
                    <Switch v-model="settings.enableTrafficNode" />
                </div>

                <!-- 合并到期时间策略 -->
                <div
                    class="p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 sub-radius-lg space-y-2"
                >
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-200">
                            {{ t('settings.mergeExpireStrategyTitle') }}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {{ t('settings.mergeExpireStrategyDesc') }}
                        </p>
                    </div>
                    <select
                        v-model="settings.mergeExpireStrategy"
                        class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 sub-radius-lg shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
                    >
                        <option value="max">{{ t('settings.mergeExpireMax') }}</option>
                        <option value="min">{{ t('settings.mergeExpireMin') }}</option>
                    </select>
                </div>
            </div>
        </div>
    </div>
</template>
