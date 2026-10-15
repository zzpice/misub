import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDataStore } from '../../src/stores/useDataStore.js';
import { useSettingsStore } from '../../src/stores/settings.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function createStore() {
    setActivePinia(createPinia());
    return useDataStore();
}

describe('Data store settings cache', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        sessionStorage.clear();
    });

    it('shares one in-flight fetch result across concurrent fetchData calls', async () => {
        let resolveRequest;
        const responseData = { misubs: [], profiles: [], ruleTemplates: [], config: {} };
        const fetchMock = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveRequest = () => resolve(jsonResponse(responseData));
                })
        );
        vi.stubGlobal('fetch', fetchMock);

        const dataStore = createStore();
        const first = dataStore.fetchData();
        const second = dataStore.fetchData();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        resolveRequest();
        const [firstResult, secondResult] = await Promise.all([first, second]);
        expect(firstResult).toBe(true);
        expect(secondResult).toBe(true);
        expect(dataStore.profiles).toEqual([]);
    });

    it('updates settings in memory and never writes private data to session storage', async () => {
        const dataStore = createStore();
        dataStore.hydrateFromData({
            misubs: [{ id: 'private', url: 'https://example.test/secret' }],
            profiles: [],
            config: {},
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => jsonResponse({ success: true }))
        );
        await dataStore.saveSettings({ FileName: 'Personal' });
        expect(useSettingsStore().config.FileName).toBe('Personal');
        expect(sessionStorage.getItem('misub_data_cache')).toBeNull();
    });

    it('clears private data and ignores an in-flight response after logout', async () => {
        let respond;
        vi.stubGlobal(
            'fetch',
            vi.fn(
                () =>
                    new Promise((resolve) => {
                        respond = resolve;
                    })
            )
        );
        const store = createStore();
        const pending = store.fetchData();
        store.clearCachedData();
        respond(
            jsonResponse({
                misubs: [{ id: 'private' }],
                profiles: [],
                config: { mytoken: 'private-token' },
            })
        );
        expect(await pending).toBe(false);
        expect(store.subscriptions).toEqual([]);
        expect(store.settings.mytoken).not.toBe('private-token');
        expect(store.hasDataLoaded).toBe(false);
    });

    it('keeps edits made while a save is in flight dirty and intact', async () => {
        let respond;
        vi.stubGlobal(
            'fetch',
            vi.fn(
                () =>
                    new Promise((resolve) => {
                        respond = resolve;
                    })
            )
        );
        const store = createStore();
        store.hydrateFromData({
            misubs: [{ id: 'one', name: 'Initial' }],
            profiles: [],
            config: {},
        });
        store.updateSubscription('one', { name: 'Submitted' });
        const pending = store.saveData();
        store.updateSubscription('one', { name: 'Newer edit' });
        respond(
            jsonResponse({ success: true, data: { misubs: [{ id: 'one', name: 'Submitted' }] } })
        );
        expect(await pending).toBe(true);
        expect(store.subscriptions[0].name).toBe('Newer edit');
        expect(store.isDirty).toBe(true);
        expect(store.saveState).toBe('idle');
    });
});
