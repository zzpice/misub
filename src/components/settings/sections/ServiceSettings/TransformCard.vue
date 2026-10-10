<script setup>
    import { computed } from 'vue';
    import TransformSelector from '@/components/forms/TransformSelector.vue';
    import Switch from '@/components/ui/Switch.vue';
    import SectionHeader from '../../SectionHeader.vue';
    import RuleTemplateManager from './RuleTemplateManager.vue';
    import { useI18n } from '@/i18n/index.js';

    const { t } = useI18n();
    const props = defineProps({ settings: { type: Object, required: true } });

    const modeOptions = computed(() => [
        { value: 'builtin', label: t('settings.transformBuiltinAuto') },
        { value: 'preset', label: t('settings.transformPreset') },
        { value: 'custom', label: t('settings.transformCustomUrl') },
        { value: 'custom_template', label: t('settings.transformCustomTemplate') },
    ]);

    const isBuiltinMode = computed(() => props.settings.transformConfigMode === 'builtin');

    const modeHint = computed(() => {
        if (isBuiltinMode.value) {
            return t('settings.transformBuiltinHint');
        }
        if (props.settings.transformConfigMode === 'preset') {
            return t('settings.transformPresetHint');
        }
        if (props.settings.transformConfigMode === 'custom_template') {
            return t('settings.transformCustomTemplateHint');
        }
        return t('settings.transformCustomHint');
    });
</script>

<template>
    <div class="space-y-6">
        <div
            class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70"
        >
            <SectionHeader
                :title="t('settings.transformRulesTitle')"
                :description="t('settings.transformRulesDesc')"
                tone="purple"
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                </template>
            </SectionHeader>

            <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div class="space-y-5">
                    <div>
                        <label
                            class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                        >
                            {{ t('settings.transformRuleSource') }}
                        </label>
                        <select
                            v-model="settings.transformConfigMode"
                            class="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-colors duration-200 focus:border-purple-500 focus-visible:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        >
                            <option
                                v-for="option in modeOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                        <p
                            class="mt-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400"
                        >
                            {{ modeHint }}
                        </p>
                    </div>

                    <div
                        class="rounded-xl border border-gray-100 bg-white p-5 transition-all duration-300 dark:border-white/5 dark:bg-gray-900/40"
                    >
                        <div class="mb-4 flex items-center justify-between">
                            <h4
                                class="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-indigo-200"
                            >
                                <span
                                    class="h-2 w-2 animate-pulse rounded-full bg-indigo-500"
                                ></span>
                                {{ t('settings.transformBuiltinParams') }}
                            </h4>
                            <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400"
                                >builtin-core</span
                            >
                        </div>

                        <div class="space-y-4">
                            <div
                                :class="{ 'opacity-60': !isBuiltinMode }"
                                class="transition-opacity"
                            >
                                <label class="mb-1.5 block text-[11px] font-medium text-gray-500">{{
                                    t('settings.transformRuleLevel')
                                }}</label>
                                <select
                                    v-model="settings.ruleLevel"
                                    :disabled="!isBuiltinMode"
                                    class="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                >
                                    <option value="base">
                                        {{ t('settings.transformRuleBase') }}
                                    </option>
                                    <option value="std">
                                        {{ t('settings.transformRuleStd') }}
                                    </option>
                                    <option value="full">
                                        {{ t('settings.transformRuleFull') }}
                                    </option>
                                    <option value="relay">
                                        {{ t('settings.transformRuleRelay') }}
                                    </option>
                                </select>
                            </div>

                            <div class="grid grid-cols-1 gap-3">
                                <div
                                    class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2.5 dark:border-white/5 dark:bg-white/5"
                                >
                                    <span
                                        class="text-[11px] font-medium text-gray-700 dark:text-gray-300"
                                        >{{ t('settings.transformBuiltinSkipCert') }}</span
                                    >
                                    <Switch v-model="settings.builtinSkipCertVerify" size="sm" />
                                </div>
                                <div
                                    class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2.5 dark:border-white/5 dark:bg-white/5"
                                >
                                    <span
                                        class="text-[11px] font-medium text-gray-700 dark:text-gray-300"
                                        >{{ t('settings.transformBuiltinUdp') }}</span
                                    >
                                    <Switch v-model="settings.builtinEnableUdp" size="sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    :class="{ 'opacity-50 pointer-events-none': isBuiltinMode }"
                    class="transition-all"
                >
                    <label
                        class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-purple-600 dark:text-purple-400"
                    >
                        {{ t('settings.transformTemplateConfig') }}
                    </label>
                    <TransformSelector
                        v-model="settings.transformConfig"
                        type="config"
                        :force-custom="settings.transformConfigMode === 'custom'"
                        :custom-templates-only="settings.transformConfigMode === 'custom_template'"
                        :placeholder="t('settings.transformPresetPlaceholder')"
                        :custom-placeholder="t('settings.transformRemotePlaceholder')"
                        :allowEmpty="settings.transformConfigMode === 'builtin'"
                    />
                    <p
                        v-if="settings.transformConfigMode === 'custom_template'"
                        class="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] leading-relaxed text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    >
                        {{ t('settings.transformCustomTemplateSelectHint') }}
                    </p>
                </div>
            </div>
        </div>
        <RuleTemplateManager />
    </div>
</template>
