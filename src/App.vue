<script setup>
    import { defineAsyncComponent, onMounted, onUnmounted, watch, computed, ref } from 'vue';
    import RouteErrorBoundary from './components/ui/RouteErrorBoundary.vue';
    import ConfirmDialog from './components/ui/ConfirmDialog.vue';
    import { useRoute, useRouter } from 'vue-router';
    import { useThemeStore } from './stores/theme';
    import { useSessionStore } from './stores/session';
    import { useToastStore } from './stores/toast';
    import { useDataStore } from './stores/useDataStore';
    import { useUIStore } from './stores/ui';
    import { storeToRefs } from 'pinia';
    import NavBar from './components/layout/NavBar.vue';
    import { detectLegacyD1 } from './lib/api.js';
    import { useI18n } from './i18n/index.js';
    import { BRAND_TITLE } from './lib/brand.js';
    import { configureAuthGuard, translateRouteTitle } from './router/index.js';

    // Lazy components
    const Login = defineAsyncComponent(() => import('./components/modals/Login.vue'));
    const Toast = defineAsyncComponent(() => import('./components/ui/Toast.vue'));
    const Footer = defineAsyncComponent(() => import('./components/layout/Footer.vue'));
    const Dashboard = defineAsyncComponent(
        () => import('./components/features/Dashboard/Dashboard.vue')
    );
    const Header = defineAsyncComponent(() => import('./components/layout/Header.vue'));
    const SavePrompt = defineAsyncComponent(() => import('./components/ui/SavePrompt.vue'));
    const ScrollToTop = defineAsyncComponent(() => import('./components/ui/ScrollToTop.vue'));
    const LegacyD1MigrationModal = defineAsyncComponent(
        () => import('./components/modals/LegacyD1MigrationModal.vue')
    );

    const route = useRoute();
    const router = useRouter();
    const { t, locale } = useI18n();
    const themeStore = useThemeStore();
    const { theme } = storeToRefs(themeStore);
    const { initTheme } = themeStore;

    const sessionStore = useSessionStore();
    const { sessionState } = storeToRefs(sessionStore);
    const { checkSession, login, logout } = sessionStore;

    const toastStore = useToastStore();

    const dataStore = useDataStore();
    const { isDirty, saveState } = storeToRefs(dataStore);

    const uiStore = useUIStore();
    const { layoutMode } = storeToRefs(uiStore);

    const isLoggedIn = computed(() => sessionState.value === 'loggedIn');
    const isPublicRoute = computed(() => route.meta.isPublic);
    const isSessionLoading = computed(() => sessionState.value === 'loading');
    configureAuthGuard(() => ({
        state: sessionState.value,
    }));

    const showModernNavBar = computed(() => isLoggedIn.value && layoutMode.value === 'modern');
    const showLegacyHeader = computed(() => {
        if (showModernNavBar.value) return false;
        if (isLoggedIn.value) return true;
        if (isSessionLoading.value || !isPublicRoute.value) return false;
        return true;
    });
    const shouldShowFooter = computed(() => !isSessionLoading.value);

    const shouldCenterMain = computed(
        () =>
            sessionState.value !== 'loggedIn' &&
            sessionState.value !== 'loading' &&
            !isPublicRoute.value
    );

    const showSavePrompt = computed(
        () => layoutMode.value === 'modern' && (isDirty.value || saveState.value === 'success')
    );

    const showLegacyD1MigrationModal = ref(false);
    const legacyD1Details = ref({ hasLegacySubscriptions: false, hasLegacyProfiles: false });


    const isDefaultPassword = computed(() => {
        return (
            sessionStore.subscriptionConfig?.isDefaultPassword === true ||
            sessionStore.securityWarning?.type === 'default_admin_password'
        );
    });
    const defaultPasswordWarningMessage = computed(
        () => sessionStore.securityWarning?.message || t('notices.defaultPasswordWarning')
    );

    onMounted(async () => {
        window.addEventListener('misub:unauthorized', handleUnauthorized);
        initTheme();
        await checkSession();
    });

    onUnmounted(() => {
        window.removeEventListener('misub:unauthorized', handleUnauthorized);
    });

    watch(
        () => [
            route.fullPath,
            // 切换语言时也要重算标题，否则会一直停在启动时的语言
            locale.value,
        ],
        () => {
            if (typeof document === 'undefined') return;
            const rawTitle = translateRouteTitle(route, t);
            document.title = rawTitle ? `${rawTitle} · ${BRAND_TITLE}` : BRAND_TITLE;
        },
        { immediate: true }
    );

    watch(
        sessionState,
        async (newVal) => {
            if (newVal === 'loggedIn') {
                await dataStore.fetchData();

                try {
                    const result = await detectLegacyD1();
                    if (result?.success && result.data?.hasLegacyData) {
                        legacyD1Details.value = result.data;
                        showLegacyD1MigrationModal.value = true;
                    }
                } catch {
                    // Non-blocking legacy check.
                }
            }
        },
        { immediate: true }
    );

    const handleLegacyD1MigrationSuccess = async () => {
        showLegacyD1MigrationModal.value = false;
        await dataStore.fetchData(true);
    };

    const handleLegacyD1MigrationClose = (value) => {
        showLegacyD1MigrationModal.value = value;
    };

    const handleSave = async () => {
        await dataStore.saveData();
    };
    const handleDiscard = async () => {
        await dataStore.fetchData(true);
        toastStore.showToast(t('notices.discardedChanges'));
    };

    const redirectUnauthenticatedRoute = () => {
        if (sessionState.value !== 'loggedOut' || !route.meta?.requiresAuth) return;
        router.replace('/').catch(() => {});
    };

    const handleUnauthorized = async () => {
        const changed = await sessionStore.handleUnauthorized();
        if (!changed) return;
        toastStore.showToast(t('settings.authFailedRelogin'), 'error');
        redirectUnauthenticatedRoute();
    };

    watch([sessionState, () => route.fullPath], redirectUnauthenticatedRoute, {
        immediate: true,
    });
</script>

<template>
    <div
        :class="theme"
        class="min-h-screen flex flex-col text-gray-800 dark:text-gray-200 transition-colors duration-300 bg-gray-100 dark:bg-slate-950"
    >
        <!-- Navigation -->
        <NavBar v-if="showModernNavBar" :is-logged-in="true" @logout="logout" />
        <Header v-else-if="showLegacyHeader" :is-logged-in="isLoggedIn" @logout="logout" />

        <main
            :class="[
                'grow w-full py-6 pb-24 md:pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
                {
                    'flex items-center justify-center': shouldCenterMain,
                    'ios-header-padding': showLegacyHeader,
                },
            ]"
        >
            <div
                v-if="sessionState === 'loading'"
                class="flex flex-col items-center justify-center p-8 min-h-[60vh]"
                role="status"
                aria-live="polite"
            >
                <div class="relative mb-8">
                    <div
                        class="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-pulse"
                    ></div>
                    <div
                        class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"
                    ></div>
                </div>
                <div class="flex flex-col items-center gap-3">
                    <div
                        class="h-6 w-32 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded animate-pulse"
                    ></div>
                    <div
                        class="h-4 w-24 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded animate-pulse"
                    ></div>
                </div>
            </div>

            <template v-else-if="isLoggedIn">
                <!-- Security Banner -->
                <div
                    v-if="isDefaultPassword"
                    class="mb-4 px-4 py-4 bg-gradient-to-r from-red-500/90 via-red-600/90 to-red-500/90 backdrop-blur-xl text-white misub-radius-lg border border-red-400/30 shadow-lg shadow-red-500/20"
                >
                    <div class="mx-auto flex max-w-7xl items-center justify-center gap-4">
                        <div class="relative">
                            <div
                                class="absolute inset-0 bg-white/30 rounded-full blur-md animate-pulse"
                            ></div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                class="w-6 h-6 relative z-10"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </div>
                        <p class="text-sm font-medium">
                            {{ defaultPasswordWarningMessage }}
                        </p>
                    </div>
                </div>

                <SavePrompt
                    :is-dirty="showSavePrompt"
                    :save-state="saveState"
                    @save="handleSave"
                    @discard="handleDiscard"
                />

                <router-view v-if="layoutMode === 'modern'" v-slot="{ Component }">
                    <transition name="fade" mode="out-in">
                        <RouteErrorBoundary :reset-key="route.fullPath">
                            <component :is="Component" />
                        </RouteErrorBoundary>
                    </transition>
                </router-view>

                <Dashboard v-else />
            </template>

            <!-- PUBLIC ROUTE VIEW (Not logged in, but isPublic) -->
            <template v-else-if="isPublicRoute">
                <router-view v-slot="{ Component }">
                    <transition name="fade" mode="out-in">
                        <RouteErrorBoundary :reset-key="route.fullPath">
                            <component :is="Component" />
                        </RouteErrorBoundary>
                    </transition>
                </router-view>
            </template>

            <!-- LOGIN VIEW (Not logged in, not public) -->
            <template v-else>
                <Login :login="login" />
            </template>
        </main>

        <Toast />
        <ConfirmDialog />
        <LegacyD1MigrationModal
            :show="showLegacyD1MigrationModal"
            :details="legacyD1Details"
            @update:show="handleLegacyD1MigrationClose"
            @success="handleLegacyD1MigrationSuccess"
        />
        <Footer v-if="shouldShowFooter" />
        <ScrollToTop v-if="isLoggedIn || isPublicRoute" />
    </div>
</template>

<style>
    :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
    }

    .ios-content-offset {
        padding-top: calc(var(--safe-top));
    }

    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.2s ease;
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }

    .slide-fade-enter-active,
    .slide-fade-leave-active {
        transition: all 0.3s ease;
    }

    .slide-fade-enter-from,
    .slide-fade-leave-to {
        transform: translateY(-10px);
        opacity: 0;
    }

    /* iOS Specific Padding for Fixed Header */
    @supports (-webkit-touch-callout: none) {
        .ios-header-padding {
            padding-top: calc(env(safe-area-inset-top, 0px) + 80px) !important;
        }
    }
</style>
