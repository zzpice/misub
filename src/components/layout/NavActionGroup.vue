<script setup>
    import BaseIcon from '../ui/BaseIcon.vue';
    import ThemeToggle from '../features/ThemeToggle.vue';
    import LanguageSwitcher from './LanguageSwitcher.vue';
    import { NAV_ICONS } from '../../constants/navigation.js';
    import { useI18n } from '../../i18n/index.js';
    defineProps({ isLoggedIn: Boolean });
    defineEmits(['logout']);
    const { t } = useI18n();
</script>
<template>
    <div class="flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <button
            v-if="isLoggedIn"
            type="button"
            class="nav-action-btn nav-action-btn-danger"
            @click="$emit('logout')"
            :title="t('actions.logout')"
            :aria-label="t('actions.logout')"
        >
            <BaseIcon :path="NAV_ICONS.logout" className="h-5 w-5" />
        </button>
    </div>
</template>
