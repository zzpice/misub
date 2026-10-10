<script setup>
    import BaseIcon from '../ui/BaseIcon.vue';
    import ThemeToggle from '../features/ThemeToggle.vue';
    import LoginEntryButton from './LoginEntryButton.vue';
    import ExternalRepoButton from './ExternalRepoButton.vue';
    import LanguageSwitcher from './LanguageSwitcher.vue';
    import { NAV_ICONS } from '../../constants/navigation.js';
    import { useI18n } from '../../i18n/index.js';

    const props = defineProps({
        isLoggedIn: {
            type: Boolean,
            default: false,
        },
        showSettings: {
            type: Boolean,
            default: false,
        },
        showLoginButton: {
            type: Boolean,
            default: true,
        },
        roundedClass: {
            type: String,
            default: 'misub-radius-md',
        },
        withFocusRing: {
            type: Boolean,
            default: false,
        },
        showDivider: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits(['openSettings', 'toggleLayout', 'logout']);
    const { t } = useI18n();
    function buildBtnClass(type) {
        const base = ['nav-action-btn', props.roundedClass];

        if (type === 'danger') {
            base.push('nav-action-btn-danger');
            if (props.withFocusRing) base.push('nav-action-focus-danger');
        } else {
            base.push('nav-action-btn-neutral');
            if (props.withFocusRing) base.push('nav-action-focus');
        }

        return base;
    }
</script>

<template>
    <div class="flex items-center gap-2">
        <LanguageSwitcher />

        <ThemeToggle />

        <div v-if="showDivider" class="h-4 w-px bg-gray-200 dark:bg-white/10 mx-1"></div>

        <template v-if="isLoggedIn">
            <button
                v-if="showSettings"
                @click="emit('openSettings')"
                :class="buildBtnClass('neutral')"
                :title="t('nav.settings')"
                :aria-label="t('actions.openSettings')"
            >
                <BaseIcon :path="NAV_ICONS.settings" className="h-5 w-5" />
            </button>

            <button
                @click="emit('toggleLayout')"
                :class="buildBtnClass('neutral')"
                :title="t('actions.toggleLayout')"
                :aria-label="t('actions.toggleLayout')"
            >
                <BaseIcon :path="NAV_ICONS.layout" className="h-5 w-5" />
            </button>

            <button
                @click="emit('logout')"
                :class="buildBtnClass('danger')"
                :title="t('actions.logout')"
                :aria-label="t('actions.logout')"
            >
                <BaseIcon :path="NAV_ICONS.logout" className="h-5 w-5" />
            </button>
        </template>

        <template v-else>
            <ExternalRepoButton :class-name="buildBtnClass('neutral')" />

            <LoginEntryButton v-if="showLoginButton" />
        </template>
    </div>
</template>
