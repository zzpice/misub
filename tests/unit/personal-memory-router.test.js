// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import router, { configureAuthGuard } from '../../src/router/index.js';

describe('personal dashboard memory navigation', () => {
    beforeEach(async () => {
        configureAuthGuard(() => ({ state: 'loggedIn' }));
        await router.replace('/');
    });

    it('keeps browser path at / when switching internal modules', async () => {
        await router.push('/dashboard');
        expect(router.currentRoute.value.path).toBe('/dashboard');
        await router.push('/dashboard/nodes');
        expect(router.currentRoute.value.path).toBe('/dashboard/nodes');
        await router.push('/dashboard/settings');
        expect(router.currentRoute.value.path).toBe('/dashboard/settings');
        expect(window.location.pathname).toBe('/');
    });

    it('returns to the root instead of visiting a separate login page after logout', async () => {
        configureAuthGuard(() => ({ state: 'loggedOut' }));
        await router.push('/dashboard/groups');
        expect(router.currentRoute.value.path).toBe('/');
        expect(window.location.pathname).toBe('/');
    });

    it('keeps the root path on reload-like reset and unknown internal routes', async () => {
        await router.push('/dashboard');
        await router.replace('/');
        expect(router.currentRoute.value.path).toBe('/');
        await router.push('/explore');
        expect(router.currentRoute.value.path).toBe('/');
        expect(window.location.pathname).toBe('/');
    });
});
