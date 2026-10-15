<script setup>
    import StatusIndicator from './StatusIndicator.vue';
    import { useI18n } from '@/i18n/index.js';

    defineProps({
        isDirty: Boolean,
        saveState: String,
    });

    defineEmits(['save', 'discard']);
    const { t } = useI18n();
</script>

<template>
    <Transition name="slide-fade">
        <div
            v-if="isDirty || saveState === 'success'"
            class="save-prompt fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[95%] max-w-2xl px-4 py-3 rounded-2xl flex flex-row items-center justify-between transition-all duration-300 gap-4 shadow-2xl backdrop-blur-xl border border-white/20 dark:border-white/10"
            :class="
                saveState === 'success'
                    ? 'bg-teal-50 dark:bg-teal-900/30 ring-1 ring-teal-500/20'
                    : 'bg-white/95 dark:bg-gray-900/95 ring-1 ring-gray-200/50 dark:ring-white/10 shadow-primary-500/10'
            "
        >
            <div class="flex items-center gap-3">
                <span class="flex h-3 w-3 relative">
                    <span
                        class="hidden"
                        :class="saveState === 'success' ? 'bg-teal-400' : 'bg-orange-400'"
                    ></span>
                    <span
                        class="relative inline-flex rounded-full h-3 w-3"
                        :class="saveState === 'success' ? 'bg-teal-500' : 'bg-orange-500'"
                    ></span>
                </span>
                <p
                    class="text-sm font-semibold transition-colors duration-300"
                    :class="
                        saveState === 'success'
                            ? 'text-teal-700 dark:text-teal-300'
                            : 'text-gray-700 dark:text-gray-300'
                    "
                >
                    {{
                        saveState === 'success'
                            ? t('common.allChangesSaved')
                            : t('common.unsavedChanges')
                    }}
                </p>
            </div>

            <div class="flex items-center gap-3 w-full sm:w-auto">
                <button
                    v-if="saveState !== 'success'"
                    :disabled="saveState === 'saving'"
                    @click="$emit('discard')"
                    class="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hover:bg-black/5 dark:hover:bg-white/5 sub-radius-md whitespace-nowrap"
                >
                    {{ t('actions.discard') }}
                </button>
                <button
                    @click.prevent="$emit('save')"
                    :disabled="saveState !== 'idle'"
                    class="flex-1 sm:flex-none px-6 py-2 text-sm text-white font-bold sub-radius-lg flex items-center justify-center transition-all duration-300 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                    :class="{
                        'bg-primary-600 hover:bg-primary-500': saveState === 'idle',
                        'bg-gray-500': saveState === 'saving',
                        'bg-teal-500': saveState === 'success',
                    }"
                >
                    <div v-if="saveState === 'saving'" class="flex items-center">
                        <StatusIndicator status="loading" size="sm" class="mr-2" />
                        <span>{{ t('settings.saving') }}</span>
                    </div>
                    <div v-else-if="saveState === 'success'" class="flex items-center">
                        <svg
                            class="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            ></path>
                        </svg>
                        <span>{{ t('common.saved') }}</span>
                    </div>
                    <span v-else>{{ t('common.saveNow') }}</span>
                </button>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
    .slide-fade-enter-active,
    .slide-fade-leave-active {
        transition:
            opacity var(--duration-fast) ease-out,
            translate var(--duration-fast) ease-out;
    }

    .slide-fade-enter-from,
    .slide-fade-leave-to {
        translate: 0 6px;
        opacity: 0;
    }
</style>
