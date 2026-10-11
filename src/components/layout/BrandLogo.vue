<script setup>
    import BrandMark from './BrandMark.vue';

    defineProps({
        textSizeClass: { type: String, default: 'text-lg' },
        iconSize: { type: Number, default: 28 },
        to: { type: String, default: '/' },
    });
</script>

<template>
    <router-link :to="to" class="nav-brand-wrap">
        <div class="nav-brand-badge nav-brand-badge-sm">
            <BrandMark :size="iconSize" />
        </div>
        <span class="nav-brand-text" :class="textSizeClass">MiSub</span>
    </router-link>
</template>
