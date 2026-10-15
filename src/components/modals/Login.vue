<script setup>
    import { ref } from 'vue';
    import { useI18n } from '../../i18n/index.js';
    import Button from '../ui/Button.vue';
    import BrandMark from '../layout/BrandMark.vue';

    const { t } = useI18n();

    const password = ref('');
    const isLoading = ref(false);
    const error = ref('');
    const showPassword = ref(false);

    const props = defineProps({
        login: Function,
    });

    const submitLogin = async () => {
        if (!password.value) {
            error.value = t('login.passwordRequired');
            return;
        }
        isLoading.value = true;
        error.value = '';
        try {
            await props.login(password.value);
        } catch (err) {
            error.value = err.message || t('login.unknownError');
        } finally {
            isLoading.value = false;
        }
    };
</script>

<template>
    <section class="login-panel">
        <BrandMark :size="48" />
        <h1>Zzp Sub</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('login.verifyIdentity') }}</p>
        <form @submit.prevent="submitLogin" class="mt-8 space-y-5">
            <label for="admin-password" class="block text-sm font-medium">{{
                t('login.passwordPlaceholder')
            }}</label>
            <div class="relative">
                <input
                    id="admin-password"
                    v-model="password"
                    @input="error = ''"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    :disabled="isLoading"
                    :aria-invalid="Boolean(error)"
                    :aria-describedby="error ? 'login-error' : undefined"
                    class="w-full border border-gray-300 dark:border-white/20 bg-transparent px-3 py-3 pr-16 text-base focus-visible:outline-2 focus-visible:outline-primary-500"
                />
                <button
                    type="button"
                    class="absolute right-1 top-1 bottom-1 px-3 text-xs text-gray-500 dark:text-gray-400"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                >
                    {{ showPassword ? t('login.hidePassword') : t('login.showPassword') }}
                </button>
            </div>
            <p
                v-if="error"
                id="login-error"
                role="alert"
                class="text-sm text-red-600 dark:text-red-400"
            >
                {{ error }}
            </p>
            <Button type="submit" :loading="isLoading" variant="primary" size="lg" class="w-full">{{
                isLoading ? t('login.verifying') : t('login.authorizeLogin')
            }}</Button>
        </form>
    </section>
</template>
