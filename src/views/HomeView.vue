<script setup>
    import { defineAsyncComponent, computed, watchEffect, h } from 'vue';
    import { useSessionStore } from '../stores/session';
    import { storeToRefs } from 'pinia';
    import { useRouter } from 'vue-router';

    const NotFoundView = defineAsyncComponent(() => import('./NotFound.vue'));
    // Render 函数保持严格 CSP 兼容，不使用运行时模板编译。
    const RedirectPlaceholder = { render: () => h('div') };
    const { sessionState } = storeToRefs(useSessionStore());
    const router = useRouter();
    watchEffect(() => {
        if (sessionState.value === 'loggedIn') router.replace('/dashboard').catch(() => {});
    });
    const currentView = computed(() =>
        sessionState.value === 'loggedIn' ? RedirectPlaceholder : NotFoundView
    );
</script>

<template>
    <component :is="currentView" />
</template>
