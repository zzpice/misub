<script setup>
    import { computed, ref, watch } from 'vue';
    import { useI18n } from '@/i18n/index.js';
    import Switch from '@/components/ui/Switch.vue';
    import TransformCard from './ServiceSettings/TransformCard.vue';
    import DnsOverrideCard from './ServiceSettings/DnsOverrideCard.vue';
    import CronCard from './ServiceSettings/CronCard.vue';

    const { t } = useI18n();
    const props = defineProps({
        settings: { type: Object, required: true },
    });

    const advancedOpen = ref(false);
    const isBuiltinMode = computed(() => props.settings.transformConfigMode === 'builtin');
    const ruleLevelKey = computed(
        () =>
            ({
                base: 'transformRuleBase',
                std: 'transformRuleStd',
                full: 'transformRuleFull',
                relay: 'transformRuleRelay',
            })[props.settings.ruleLevel || 'std'] || 'transformRuleStd'
    );
    const currentModeKey = computed(
        () =>
            ({
                builtin: 'transformBuiltinAuto',
                preset: 'transformPreset',
                custom: 'transformCustomUrl',
                custom_template: 'transformCustomTemplate',
            })[props.settings.transformConfigMode || 'builtin'] || 'transformBuiltinAuto'
    );

    // Never silently reset a saved advanced configuration when simplifying the UI.
    const hasAdvancedConfiguration = computed(
        () =>
            !isBuiltinMode.value ||
            (props.settings.ruleLevel && props.settings.ruleLevel !== 'std') ||
            props.settings.builtinSkipCertVerify === true ||
            Boolean(String(props.settings.customDnsOverride || '').trim()) ||
            Boolean(String(props.settings.cronSecret || '').trim())
    );
    watch(
        hasAdvancedConfiguration,
        (configured, previous) => {
            if (configured && !previous) advancedOpen.value = true;
        },
        { immediate: true }
    );
</script>

<template>
    <div class="space-y-6">
        <section
            class="rounded-xl border border-gray-100/80 bg-white/90 p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70 space-y-4"
        >
            <div class="space-y-1">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ t('settings.serviceBasicTitle') }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.serviceBasicDesc') }}
                </p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
                <div
                    class="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-white/5 dark:bg-white/5 space-y-1"
                >
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {{ t('settings.transformRuleSource') }}
                    </p>
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ t('settings.' + currentModeKey) }}
                    </p>
                    <p v-if="isBuiltinMode" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t('settings.' + ruleLevelKey) }}
                    </p>
                    <p v-else class="text-xs text-amber-700 dark:text-amber-300">
                        {{ t('settings.serviceCustomActive') }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-white/5 dark:bg-white/5"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="space-y-1">
                            <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {{ t('settings.transformBuiltinUdp') }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {{ t('settings.serviceUdpHint') }}
                            </p>
                        </div>
                        <Switch
                            v-model="settings.builtinEnableUdp"
                            :disabled="!isBuiltinMode"
                            size="sm"
                        />
                    </div>
                </div>
            </div>
            <p
                v-if="hasAdvancedConfiguration && !advancedOpen"
                class="text-xs text-amber-700 dark:text-amber-300"
            >
                {{ t('settings.serviceAdvancedConfigured') }}
            </p>
        </section>

        <section class="space-y-4">
            <button
                type="button"
                aria-controls="misub-service-advanced"
                :aria-expanded="advancedOpen"
                @click="advancedOpen = !advancedOpen"
                class="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/90 px-5 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/10 dark:bg-gray-900/70 dark:hover:bg-white/5"
            >
                <span class="space-y-1">
                    <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{
                        t('settings.serviceAdvancedTitle')
                    }}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">{{
                        t('settings.serviceAdvancedDesc')
                    }}</span>
                </span>
                <span class="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {{ advancedOpen ? t('settings.serviceCollapse') : t('settings.serviceExpand') }}
                </span>
            </button>
            <div id="misub-service-advanced" v-show="advancedOpen" class="space-y-6">
                <TransformCard :settings="settings" />
                <DnsOverrideCard :settings="settings" />
                <CronCard :settings="settings" />
            </div>
        </section>
    </div>
</template>
