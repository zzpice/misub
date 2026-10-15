<script setup>
    import { useI18n } from '../../../i18n/index.js';

    defineProps({
        settings: { type: Object, required: true },
        exportBackup: Function,
        importBackup: Function,
        handleReset: Function,
    });

    const { t } = useI18n();
</script>

<template>
    <div class="space-y-8">
        <div class="settings-section">
            <div class="mb-5 flex items-start gap-3">
                <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                >
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
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                        />
                    </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                        {{ t('systemSettings.backupRestoreTitle') }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ t('systemSettings.backupRestoreDesc') }}
                    </p>
                </div>
            </div>
            <div class="flex gap-4">
                <button
                    @click="exportBackup"
                    class="px-4 py-2 text-sm font-medium text-white sub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700"
                >
                    {{ t('systemSettings.exportBackup') }}
                </button>
                <button
                    @click="importBackup"
                    class="px-4 py-2 text-sm font-medium text-white sub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600"
                >
                    {{ t('systemSettings.importBackup') }}
                </button>
            </div>
        </div>

        <div
            class="rounded-xl border border-red-200/60 bg-red-50/30 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10"
        >
            <div class="mb-5 flex items-start gap-3">
                <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400"
                >
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-red-900 dark:text-red-300">
                        {{ t('systemSettings.dangerZoneTitle') }}
                    </h3>
                    <p class="text-sm text-red-600/80 dark:text-red-400/80">
                        {{ t('systemSettings.dangerZoneDesc') }}
                    </p>
                </div>
            </div>

            <div
                class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/50 dark:bg-gray-900/40 p-6 sub-radius-lg border border-red-100 dark:border-red-900/20"
            >
                <div class="space-y-2">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ t('systemSettings.factoryResetTitle') }}
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        <span v-html="t('systemSettings.factoryResetDesc')"></span>
                    </p>
                </div>
                <div class="flex items-center sm:justify-end">
                    <button
                        @click="handleReset"
                        class="px-5 py-2.5 sub-radius-lg text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-900/50 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-all active:scale-95"
                    >
                        {{ t('systemSettings.factoryResetTitle') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
