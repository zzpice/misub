import { createRouter, createMemoryHistory } from 'vue-router';
import { isChunkLoadError, shouldReloadForChunkError } from '../utils/chunk-reload.js';
import { t } from '../i18n/index.js';

/**
 * 解析路由页标题。
 *
 * 路由表是**模块级常量**，只会在应用启动时求值一次，所以那里不能直接写
 * `t('...')` —— 否则切换语言后标题永远是启动时的那个。约定：
 * - 需要翻译的页面放 `meta.titleKey`（i18n key）
 * - 品牌名等无需翻译的放 `meta.title`（字面量）
 */
export function translateRouteTitle(route, t) {
    const key = route?.meta?.titleKey;
    if (key) return t(key);
    return route?.meta?.title ? String(route.meta.title) : '';
}

// Lazy load views for better performance
const DashboardView = () => import('../views/DashboardView.vue');
const SubscriptionGroupsView = () => import('../views/SubscriptionGroupsView.vue');
const ManualNodesView = () => import('../views/ManualNodesView.vue');
const MySubscriptionsView = () => import('../views/MySubscriptionsView.vue');
const SettingsView = () => import('../views/SettingsView.vue');

const HomeView = () => import('../views/HomeView.vue'); // [NEW] Wrapper View

let authContextResolver = () => ({ state: 'loading' });

export function configureAuthGuard(resolver) {
    authContextResolver = typeof resolver === 'function' ? resolver : authContextResolver;
}

const routes = [
    {
        path: '/', // Root path is HomeView (Smart Wrapper)
        name: 'Home',
        component: HomeView,
        meta: { titleKey: 'pageTitles.home', isPublic: true }, // Publicly accessible, view handles content
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: DashboardView,
        meta: { titleKey: 'pageTitles.dashboard', requiresAuth: true },
    },
    {
        path: '/dashboard/groups',
        name: 'SubscriptionGroups',
        component: SubscriptionGroupsView,
        meta: { titleKey: 'pageTitles.groups', requiresAuth: true },
    },
    {
        path: '/dashboard/nodes',
        name: 'ManualNodes',
        component: ManualNodesView,
        meta: { titleKey: 'pageTitles.nodes', requiresAuth: true },
    },
    {
        path: '/dashboard/subscriptions',
        name: 'MySubscriptions',
        component: MySubscriptionsView,
        meta: { titleKey: 'pageTitles.subscriptions', requiresAuth: true },
    },
    {
        path: '/dashboard/settings',
        name: 'Settings',
        component: SettingsView,
        meta: { titleKey: 'pageTitles.settings', requiresAuth: true },
    },
    // Unknown internal locations return to the root login/dashboard entry.
    { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
    // Internal sections have virtual paths; the browser address remains /.
    history: createMemoryHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    },
});

// 自动恢复动态 chunk 加载失败导致的白屏
router.onError((error) => {
    if (isChunkLoadError(error?.message) && shouldReloadForChunkError()) {
        window.location.reload();
    }
});

// Navigation guard
router.beforeEach((to) => {
    if (typeof document !== 'undefined') {
        const title = translateRouteTitle(to, t);
        document.title = title ? `${title} - MISUB` : 'MISUB';
    }

    if (!to.meta.requiresAuth) return true;

    const context = authContextResolver() || {};
    if (context.state === 'loading') return true;
    if (context.state === 'loggedIn') return true;

    return {
        path: '/',
    };
});

export default router;
