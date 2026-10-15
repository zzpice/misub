<script setup>
    import { computed, defineAsyncComponent } from 'vue';
    import { useI18n } from '../../i18n/index.js';
    import SettingsLayout from '../layout/SettingsLayout.vue';
    import SettingsSidebar from './SettingsSidebar.vue';
    const BasicSettings = defineAsyncComponent(() => import('./sections/BasicSettings.vue'));
    const GlobalSettings = defineAsyncComponent(() => import('./sections/GlobalSettings.vue'));
    const ServiceSettings = defineAsyncComponent(() => import('./sections/ServiceSettings.vue'));
    const WebdavBackupSettings = defineAsyncComponent(
        () => import('./sections/WebdavBackupSettings.vue')
    );
    const SystemSettings = defineAsyncComponent(() => import('./sections/SystemSettings.vue'));

    const { t } = useI18n();

    const props = defineProps({
        activeTab: {
            type: String,
            required: true,
        },
        settings: {
            type: Object,
            required: true,
        },
        disguiseConfig: {
            type: Object,
            default: () => ({}),
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
        isSaving: {
            type: Boolean,
            default: false,
        },
        hasWhitespace: {
            type: Boolean,
            default: false,
        },
        isStorageTypeValid: {
            type: Boolean,
            default: true,
        },
        /** 独立页面用 ?focus= 深链定位字段时高亮；弹窗不使用 */
        highlightedFocusId: {
            type: String,
            default: '',
        },
        /** 弹窗内空间有限、没有页面级标题，头部信息卡需要常显；独立页面在移动端隐藏它 */
        layoutClass: {
            type: String,
            default: 'h-full',
        },
        exportBackup: {
            type: Function,
            default: null,
        },
        importBackup: {
            type: Function,
            default: null,
        },
        handleReset: {
            type: Function,
            default: null,
        },
    });

    const emit = defineEmits(['update:activeTab', 'save']);

    const activeTabModel = computed({
        get: () => props.activeTab,
        set: (value) => emit('update:activeTab', value),
    });

    const saveDisabled = computed(
        () => props.isSaving || props.hasWhitespace || !props.isStorageTypeValid
    );
</script>

<template>
    <SettingsLayout :class="layoutClass">
        <template #sidebar>
            <SettingsSidebar v-model:activeTab="activeTabModel" />
        </template>

        <div v-if="isLoading" class="text-center p-12">
            <svg
                class="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-4"
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
            <p class="text-gray-500">{{ t('settings.loading') }}</p>
        </div>

        <div v-else class="space-y-6 max-w-6xl w-full mx-auto">
            <BasicSettings
                v-if="activeTab === 'basic'"
                :settings="settings"
                :disguiseConfig="disguiseConfig"
                :highlighted-focus-id="highlightedFocusId"
            />
            <GlobalSettings v-if="activeTab === 'global'" :settings="settings" />
            <ServiceSettings v-if="activeTab === 'service'" :settings="settings" />
            <div v-if="activeTab === 'system'" class="space-y-6">
                <WebdavBackupSettings :settings="settings" />
                <SystemSettings
                    :settings="settings"
                    :exportBackup="exportBackup"
                    :importBackup="importBackup"
                    :handleReset="handleReset"
                />
            </div>
        </div>

        <template #footer>
            <button
                @click="emit('save')"
                :disabled="saveDisabled"
                class="px-6 py-2.5 sub-radius-lg text-white text-sm font-medium shadow-sm transition-all flex items-center gap-2"
                :class="
                    isSaving
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 hover:shadow-md active:scale-95'
                "
            >
                <svg
                    v-if="isSaving"
                    class="animate-spin h-4 w-4 text-white"
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
                <span>{{ isSaving ? t('settings.saving') : t('settings.saveChanges') }}</span>
            </button>
        </template>
    </SettingsLayout>
</template>
