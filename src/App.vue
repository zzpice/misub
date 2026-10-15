<script setup>
    import { defineAsyncComponent, onMounted, onUnmounted, watch, computed } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { storeToRefs } from 'pinia';
    import RouteErrorBoundary from './components/ui/RouteErrorBoundary.vue';
    import ConfirmDialog from './components/ui/ConfirmDialog.vue';
    import NavBar from './components/layout/NavBar.vue';
    import BrandLogo from './components/layout/BrandLogo.vue';
    import NavActionGroup from './components/layout/NavActionGroup.vue';
    import { useThemeStore } from './stores/theme';
    import { useSessionStore } from './stores/session';
    import { useToastStore } from './stores/toast';
    import { useDataStore } from './stores/useDataStore';
    import { useI18n } from './i18n/index.js';
    import { BRAND_TITLE } from './lib/brand.js';
    import { configureAuthGuard, translateRouteTitle } from './router/index.js';
    import { confirmAction } from './composables/useConfirm.js';

    const Login = defineAsyncComponent(() => import('./components/modals/Login.vue'));
    const Toast = defineAsyncComponent(() => import('./components/ui/Toast.vue'));
    const Footer = defineAsyncComponent(() => import('./components/layout/Footer.vue'));
    const SavePrompt = defineAsyncComponent(() => import('./components/ui/SavePrompt.vue'));
    const route = useRoute();
    const router = useRouter();
    const { t, locale } = useI18n();
    const themeStore = useThemeStore();
    const sessionStore = useSessionStore();
    const toastStore = useToastStore();
    const dataStore = useDataStore();
    const { sessionState } = storeToRefs(sessionStore);
    const { isDirty, saveState } = storeToRefs(dataStore);
    const isLoggedIn = computed(() => sessionState.value === 'loggedIn');
    configureAuthGuard(() => ({ state: sessionState.value }));

    const redirectUnauthenticated = () => {
        if (sessionState.value === 'loggedOut' && route.meta.requiresAuth) router.replace('/');
    };
    const handleUnauthorized = async () => {
        if (await sessionStore.handleUnauthorized()) {
            toastStore.showToast(t('settings.authFailedRelogin'), 'error');
            redirectUnauthenticated();
        }
    };
    const preventUnsavedExit = (event) => {
        if (!isDirty.value) return;
        event.preventDefault();
        event.returnValue = '';
    };
    const handleDiscard = async () => {
        if (saveState.value === 'saving') return;
        if (!(await confirmAction({ message: t('common.discardConfirm'), variant: 'danger' })))
            return;
        if (await dataStore.fetchData(true)) toastStore.showToast(t('notices.discardedChanges'));
    };
    const handleLogout = async () => {
        if (
            isDirty.value &&
            !(await confirmAction({ message: t('common.discardConfirm'), variant: 'danger' }))
        )
            return;
        await sessionStore.logout();
    };
    onMounted(() => {
        themeStore.initTheme();
        window.addEventListener('misub:unauthorized', handleUnauthorized);
        window.addEventListener('beforeunload', preventUnsavedExit);
        sessionStore.checkSession();
    });
    onUnmounted(() => {
        window.removeEventListener('misub:unauthorized', handleUnauthorized);
        window.removeEventListener('beforeunload', preventUnsavedExit);
    });
    watch(
        [() => route.fullPath, locale],
        () => {
            const title = translateRouteTitle(route, t);
            document.title = title ? `${title} · ${BRAND_TITLE}` : BRAND_TITLE;
        },
        { immediate: true }
    );
    watch([sessionState, () => route.fullPath], redirectUnauthenticated);
</script>

<template>
    <div
        :class="[themeStore.theme, { 'is-authenticated': isLoggedIn }]"
        class="sub-app min-h-screen flex flex-col text-gray-800 dark:text-gray-200"
    >
        <a class="skip-link" href="#main">{{ t('common.skipToContent') }}</a>
        <NavBar v-if="isLoggedIn" :is-logged-in="true" @logout="handleLogout" />
        <header v-else-if="sessionState !== 'loading'" class="login-header">
            <BrandLogo />
            <NavActionGroup :is-logged-in="false" />
        </header>
        <main id="main" tabindex="-1" class="app-main" :class="{ 'login-main': !isLoggedIn }">
            <div v-if="sessionState === 'loading'" class="session-loading" role="status">
                <span class="loading-dot"></span>{{ t('settings.loading') }}
            </div>
            <template v-else-if="isLoggedIn">
                <SavePrompt
                    :is-dirty="isDirty"
                    :save-state="saveState"
                    @save="dataStore.saveData()"
                    @discard="handleDiscard"
                />
                <router-view v-slot="{ Component }">
                    <RouteErrorBoundary :reset-key="route.fullPath">
                        <component :is="Component" />
                    </RouteErrorBoundary>
                </router-view>
            </template>
            <Login v-else :login="sessionStore.login" />
        </main>
        <Toast />
        <ConfirmDialog />
        <Footer v-if="sessionState !== 'loading'" />
    </div>
</template>
