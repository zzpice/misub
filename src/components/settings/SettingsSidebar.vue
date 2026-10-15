<script setup>
    import { useI18n } from '../../i18n/index.js';

    const { t } = useI18n();

    const props = defineProps({
        activeTab: {
            type: String,
            required: true,
        },
    });

    const emit = defineEmits(['update:activeTab']);

    // 分组：原先 7 个 tab 平铺，其中「基础设置 / 全局设置 / 系统设置」三个命名含义高度重叠，
    // 用户难以判断某个设置该去哪一栏找。改为按「站点展示 / 数据与集成 / 系统维护」三组归类，
    // 每组给出小标题，降低查找成本。
    const tabGroups = [
        {
            id: 'site',
            labelKey: 'settings.groups.site',
            tabs: [{ id: 'basic', labelKey: 'settings.tabs.basic' }],
        },
        {
            id: 'data',
            labelKey: 'settings.groups.data',
            tabs: [
                { id: 'global', labelKey: 'settings.tabs.global' },
                { id: 'service', labelKey: 'settings.tabs.service' },
            ],
        },
        {
            id: 'maintenance',
            labelKey: 'settings.groups.maintenance',
            tabs: [{ id: 'system', labelKey: 'settings.tabs.system' }],
        },
    ];
</script>

<template>
    <nav class="settings-tabs" :aria-label="t('settings.title')">
        <template v-for="group in tabGroups" :key="group.id">
            <button
                v-for="tab in group.tabs"
                :key="tab.id"
                :aria-current="activeTab === tab.id ? 'page' : undefined"
                @click="emit('update:activeTab', tab.id)"
                class="settings-tab"
                :class="
                    activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200'
                "
            >
                <svg
                    class="mr-2 md:mr-3 flex-shrink-0 h-5 w-5 md:h-6 md:w-6"
                    :class="
                        activeTab === tab.id
                            ? 'text-primary-600 dark:text-primary-300'
                            : 'text-gray-500 dark:text-gray-400'
                    "
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        v-if="tab.id === 'basic'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                        v-if="tab.id === 'basic'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />

                    <path
                        v-if="tab.id === 'global'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 3c-4.418 0-8 3.134-8 7s3.582 7 8 7 8-3.134 8-7-3.582-7-8-7zm0 10.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0 5.5v2m-4-3l-1.5 1.5m9-1.5L16 19.5m-9-9H3m18 0h-4"
                    />

                    <path
                        v-if="tab.id === 'service'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                    />

                    <path
                        v-if="tab.id === 'system'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2-2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                </svg>
                {{ t(tab.labelKey) }}
            </button>
        </template>
    </nav>
</template>
