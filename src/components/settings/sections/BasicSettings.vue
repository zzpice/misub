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
        <div
            class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70"
        >
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
                    class="block w-full px-3 py-2.5 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500/40 focus:border-amber-500 sm:text-sm dark:text-white transition-colors"
                >
                    <option value="zh-CN">{{ t('settings.defaultLanguageZh') }}</option>
                    <option value="en-US">{{ t('settings.defaultLanguageEn') }}</option>
                </select>
            </div>
        </div>

        <!-- 订阅基本信息配置 -->
        <div
            class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70"
        >
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
                        class="misub-radius-lg"
                    />
                </div>
            </div>
        </div>

        <!-- 功能开关区域 -->
        <div
            class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70"
        >
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
                <!-- 订阅自动更新间隔 -->
                <div
                    class="p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">
                                {{ t('settings.autoUpdateInterval') }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {{ t('settings.autoUpdateDesc') }}
                            </p>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-3">
                        <div class="flex items-center gap-2">
                            <input
                                type="number"
                                :value="
                                    ![0, 30, 60, 120].includes(settings.autoUpdateInterval)
                                        ? settings.autoUpdateInterval
                                        : ''
                                "
                                @input="
                                    (e) => {
                                        const v = parseInt(e.target.value);
                                        if (v >= 5) settings.autoUpdateInterval = v;
                                    }
                                "
                                :placeholder="t('settings.customInterval')"
                                min="5"
                                class="w-24 px-2.5 py-2 text-sm bg-white/70 dark:bg-black/20 border border-gray-200/80 dark:border-white/10 misub-radius-md text-gray-900 dark:text-white placeholder-gray-400 focus-visible:ring-2 focus-visible:ring-primary-500/40 focus:border-primary-500 outline-none transition-all"
                                :aria-label="t('settings.autoUpdateInterval')"
                            />
                            <span class="text-xs text-gray-500 dark:text-gray-400">{{
                                t('settings.minutes')
                            }}</span>
                        </div>
                        <span class="text-xs text-gray-500 dark:text-gray-400 self-center">{{
                            t('settings.quickSelect')
                        }}</span>
                        <button
                            v-for="option in [
                                { value: 0, label: t('settings.disabledOption') },
                                { value: 30, label: t('settings.option30Minutes') },
                                { value: 60, label: t('settings.option1Hour') },
                            ]"
                            :key="option.value"
                            @click="settings.autoUpdateInterval = option.value"
                            :aria-pressed="settings.autoUpdateInterval === option.value"
                            :class="[
                                'px-3 py-2 text-xs font-medium misub-radius-md border transition-colors',
                                settings.autoUpdateInterval === option.value
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/30'
                                    : 'bg-white/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200/70 dark:border-white/10 hover:bg-white dark:hover:bg-gray-800',
                            ]"
                        >
                            {{ option.label }}
                        </button>
                    </div>
                    <p
                        v-if="settings.autoUpdateInterval === 0"
                        class="text-xs text-amber-600 dark:text-amber-400 mt-2"
                    >
                        {{ t('settings.autoUpdateDisabledHint') }}
                    </p>
                </div>

                <!-- 流量与到期时间节点 -->
                <div
                    class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg"
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
                    class="p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg space-y-2"
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
                        class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
                    >
                        <option value="max">{{ t('settings.mergeExpireMax') }}</option>
                        <option value="min">{{ t('settings.mergeExpireMin') }}</option>
                    </select>
                </div>
            </div>
        </div>

    </div>
</template>
