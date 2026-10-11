import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    subscriptionsRef: { value: [] },
    dataStore: {
        settings: { autoUpdateInterval: 0 },
        saveData: vi.fn(),
    },
}));
vi.mock('pinia', () => ({
    storeToRefs: () => ({ subscriptions: mocks.subscriptionsRef }),
}));
vi.mock('../../src/stores/useDataStore', () => ({
    useDataStore: () => mocks.dataStore,
}));
vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../src/lib/api.js', () => ({
    refreshSourceSnapshot: vi.fn(),
}));
vi.mock('../../src/utils/errorHandler.js', () => ({
    handleError: vi.fn(),
}));

describe('removed global browser-side automatic update interval', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        mocks.subscriptionsRef.value = [];
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    it.each([0, 5, 60])('never installs a browser interval for legacy setting %i', async (interval) => {
        mocks.dataStore.settings = { autoUpdateInterval: interval };
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');
        const instance = useSubscriptions(vi.fn());
        expect(instance.startAutoUpdate).toBeUndefined();
        expect(instance.stopAutoUpdate).toBeUndefined();
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });
});
