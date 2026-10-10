import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import router, { configureAuthGuard } from '../../src/router/index.js';

describe('router authentication guard', () => {
    beforeEach(async () => {
        configureAuthGuard(() => ({ state: 'loggedOut' }));
        await router.replace('/');
    });

    afterEach(() => {
        configureAuthGuard(() => ({ state: 'loading' }));
    });

    it('returns unauthenticated users to the single root login page', async () => {
        await router.push('/dashboard');

        expect(router.currentRoute.value.path).toBe('/');
    });

    it('allows authenticated users to enter protected routes', async () => {
        configureAuthGuard(() => ({ state: 'loggedIn' }));

        await router.push('/dashboard');

        expect(router.currentRoute.value.path).toBe('/dashboard');
    });

    it('does not block public routes while the session is loading', async () => {
        configureAuthGuard(() => ({ state: 'loading' }));

        await router.push('/');

        expect(router.currentRoute.value.path).toBe('/');
    });
});
