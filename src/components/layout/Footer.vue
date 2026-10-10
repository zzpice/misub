<script setup>
    import { currentVersion, buildCommit } from '../../lib/build-info.js';
</script>

<template>
    <footer class="w-full text-center p-8 border-t border-gray-200 dark:border-white/10 mt-8">
        <div
            class="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400"
        >
            <p>
                <a
                    href="https://github.com/zzpice/misub"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-indigo-600/80 dark:text-indigo-400/80 hover:underline"
                    >MiSub</a
                >
                · Maintained by zzpice
            </p>
            <span
                :title="buildCommit || currentVersion"
                class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[9px] font-mono opacity-80"
            >
                v{{ currentVersion
                }}<template v-if="buildCommit"> · {{ buildCommit.slice(0, 7) }}</template>
            </span>
        </div>
    </footer>
</template>
