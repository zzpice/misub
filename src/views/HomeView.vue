<script setup>
    import { defineAsyncComponent, computed, watchEffect, h } from 'vue';
    import { useSessionStore } from '../stores/session';
    import { storeToRefs } from 'pinia';
    import { useRouter } from 'vue-router';

    const Login = defineAsyncComponent(() => import('../components/modals/Login.vue'));
    // Render 函数保持严格 CSP 兼容，不使用运行时模板编译。
    const RedirectPlaceholder = { render: () => h('div') };
    const sessionStore = useSessionStore();
    const { sessionState } = storeToRefs(sessionStore);
    const router = useRouter();
    watchEffect(() => {
        if (sessionState.value === 'loggedIn') router.replace('/dashboard').catch(() => {});
    });
    const currentView = computed(() =>
        sessionState.value === 'loggedIn' ? RedirectPlaceholder : Login
    );
</script>

<template>
    <component :is="currentView" :login="sessionStore.login" />
</template>
