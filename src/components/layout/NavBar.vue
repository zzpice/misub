<script setup>
    import { useRoute } from 'vue-router';
    import BaseIcon from '../ui/BaseIcon.vue';
    import BrandLogo from './BrandLogo.vue';
    import NavActionGroup from './NavActionGroup.vue';
    import { MAIN_NAV_ITEMS } from '../../constants/navigation.js';
    import { useI18n } from '../../i18n/index.js';

    const route = useRoute();
    const { t } = useI18n();

    defineProps({
        isLoggedIn: Boolean,
    });

    const emit = defineEmits(['logout']);

    const navItems = MAIN_NAV_ITEMS;

    function isActive(path) {
        if (path === '/') return route.path === '/';
        if (path === '/dashboard') return route.path === '/dashboard';
        return route.path.startsWith(path);
    }
</script>

<template>
    <header
        :aria-label="t('nav.top')"
        class="app-nav-bar lg:hidden sticky top-0 z-[50] flex items-center justify-between px-4 py-2.5 w-full bg-white dark:bg-slate-950 border-b border-gray-200/60 dark:border-white/10 transition-colors duration-150"
    >
        <BrandLogo to="/dashboard" text-size-class="text-lg" :icon-size="32" />

        <NavActionGroup :is-logged-in="isLoggedIn" @logout="emit('logout')" />
    </header>

    <header
        :aria-label="t('nav.main')"
        class="app-nav-bar hidden lg:block sticky top-0 z-[50] w-full bg-white dark:bg-slate-950 border-b border-gray-200/60 dark:border-white/10 transition-all duration-300"
    >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div class="shrink-0 pr-5">
                <BrandLogo to="/dashboard" text-size-class="text-lg" :icon-size="32" />
            </div>

            <nav :aria-label="t('nav.main')" class="nav-tab-shell">
                <router-link
                    v-for="item in navItems"
                    :key="item.path"
                    :to="item.path"
                    :aria-current="isActive(item.path) ? 'page' : undefined"
                    class="nav-tab group"
                    :class="isActive(item.path) ? 'nav-tab-active' : 'nav-tab-inactive'"
                >
                    <div v-if="isActive(item.path)" class="nav-tab-active-pill"></div>

                    <BaseIcon
                        :path="item.iconPath"
                        className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-300"
                        :class="
                            isActive(item.path) ? 'scale-105' : 'opacity-75 group-hover:opacity-100'
                        "
                    />
                    <span class="relative z-10">{{ t(item.key) }}</span>
                </router-link>
            </nav>

            <div class="flex items-center pl-5 ml-3 gap-2">
                <NavActionGroup :is-logged-in="isLoggedIn" @logout="emit('logout')" />
            </div>
        </div>
    </header>

    <nav v-if="isLoggedIn" :aria-label="t('nav.bottom')" class="lg:hidden mobile-nav-glass">
        <div class="mobile-nav-inner">
            <router-link
                v-for="item in navItems"
                :key="item.path"
                :to="item.path"
                :aria-current="isActive(item.path) ? 'page' : undefined"
                class="nav-mobile-item"
                :class="isActive(item.path) ? 'nav-mobile-item-active' : 'nav-mobile-item-inactive'"
            >
                <span class="nav-mobile-icon-wrap">
                    <BaseIcon
                        :path="item.iconPath"
                        className="w-5 h-5 transition-transform duration-300"
                        :class="isActive(item.path) ? 'scale-110' : ''"
                    />
                </span>

                <span
                    class="text-[clamp(0.625rem,2.6vw,0.75rem)] font-medium tracking-tight leading-tight text-center"
                    >{{ t(item.key) }}</span
                >
            </router-link>
        </div>
    </nav>
</template>
