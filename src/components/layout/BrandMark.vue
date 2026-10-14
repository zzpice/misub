<script setup>
    import brandSvg from '../../../public/brand.svg?raw';

    defineProps({ size: { type: Number, default: 32 } });
</script>

<template>
    <span
        role="img"
        aria-label="MiSub · zzpice"
        class="brand-mark inline-flex shrink-0"
        :style="{ width: `${size}px`, height: `${size}px` }"
        v-html="brandSvg"
    />
</template>

<style scoped>
    .brand-mark :deep(svg) {
        width: 100%;
        height: 100%;
    }
</style>
