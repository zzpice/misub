import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    subscriptionsRef: { value: [] },
    saveData: vi.fn(),
    showToast: vi.fn(),
    refreshSourceSnapshot: vi.fn(),
    handleError: vi.fn(),
}));
vi.mock('pinia', () => ({
    storeToRefs: () => ({ subscriptions: mocks.subscriptionsRef }),
}));
vi.mock('../../src/stores/useDataStore', () => ({
    useDataStore: () => ({ saveData: mocks.saveData }),
}));
vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast: mocks.showToast }),
}));
vi.mock('../../src/lib/api.js', () => ({
    refreshSourceSnapshot: mocks.refreshSourceSnapshot,
}));
vi.mock('../../src/utils/errorHandler.js', () => ({
    handleError: mocks.handleError,
}));

describe('manual persistent snapshot refresh failures', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.subscriptionsRef.value = [];
        mocks.saveData.mockReset().mockResolvedValue(true);
        mocks.refreshSourceSnapshot.mockReset();
        mocks.showToast.mockReset();
        mocks.handleError.mockReset();
    });

    it.each([false, true])(
        'preserves last successful metadata even if the deprecated enableNodeCache flag is %s',
        async (oldCacheFlag) => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const oldUserInfo = { upload: 1, download: 2, total: 100, expire: 999 };
            mocks.subscriptionsRef.value = [{
                id: 'sub-1',
                name: 'Source',
                url: 'https://source.example/sub',
                enabled: true,
                enableNodeCache: oldCacheFlag,
                nodeCount: 86,
                userInfo: oldUserInfo,
            }];
            mocks.refreshSourceSnapshot.mockResolvedValue({
                success: false,
                error: 'Upstream HTTP 403',
                errorType: 'server',
                status: 502,
            });
            const { useSubscriptions } = await import('../../src/composables/useSubscriptions.js');
            const markDirty = vi.fn();
            try {
                const result = await useSubscriptions(markDirty).handleUpdateNodeCount('sub-1');
                expect(result).toBe(false);
                expect(mocks.saveData).toHaveBeenCalledTimes(1);
                expect(mocks.refreshSourceSnapshot).toHaveBeenCalledWith('sub-1');
                expect(mocks.subscriptionsRef.value[0].nodeCount).toBe(86);
                expect(mocks.subscriptionsRef.value[0].userInfo).toEqual(oldUserInfo);
                expect(mocks.subscriptionsRef.value[0].lastError).toBe('Upstream HTTP 403');
                expect(errorSpy).toHaveBeenCalled();
                expect(markDirty).not.toHaveBeenCalled();
            } finally {
                errorSpy.mockRestore();
            }
        }
    );
});
