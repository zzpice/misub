<script setup>
    defineProps({ size: { type: Number, default: 32 } });
</script>

<template>
    <svg
        :width="size"
        :height="size"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MiSub · zzpice"
        class="shrink-0"
    >
        <defs>
            <linearGradient id="misub-brand-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#635bff" />
                <stop offset="1" stop-color="#089dbb" />
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="17" fill="url(#misub-brand-gradient)" />
        <path
            d="M16 44V21l16 17 16-17v23"
            fill="none"
            stroke="white"
            stroke-width="7"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <circle cx="50" cy="15" r="4" fill="#9cf9dc" />
    </svg>
</template>
