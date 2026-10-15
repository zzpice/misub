import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const apiMocks = vi.hoisted(() => ({
    fetchInitialData: vi.fn(),
    fetchLoginConfig: vi.fn(),
    login: vi.fn(),
    apiGet: vi.fn(),
}));

vi.mock('../../src/lib/api', () => apiMocks);
vi.mock('../../src/lib/http.js', () => ({
    api: { get: apiMocks.apiGet },
}));
vi.mock('../../src/router', () => ({
    default: { push: vi.fn() },
}));
vi.mock('../../src/utils/errorHandler.js', () => ({
    handleError: vi.fn(),
}));

describe('session store resilience', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('authenticates with a single data request and no obsolete login-path lookup', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        apiMocks.fetchInitialData.mockResolvedValue({
            success: true,
            data: { misubs: [], profiles: [], config: {} },
        });
        await store.checkSession();
        expect(store.sessionState).toBe('loggedIn');
        expect(apiMocks.fetchInitialData).toHaveBeenCalledTimes(1);
        expect(apiMocks.fetchLoginConfig).not.toHaveBeenCalled();
    });

    it('fails closed when the session is unauthenticated', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        apiMocks.fetchInitialData.mockResolvedValue({ success: false, errorType: 'auth' });
        await store.checkSession();
        expect(store.sessionState).toBe('loggedOut');
    });

    it('keeps a failed logout from claiming the session was cleared', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        store.sessionState = 'loggedIn';
        apiMocks.apiGet.mockRejectedValue(new Error('network down'));
        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data: {} });

        const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            await expect(store.logout()).resolves.toBe(false);
            expect(store.sessionState).toBe('loggedIn');
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('waits for session confirmation before redirecting after login', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        apiMocks.login.mockResolvedValue({ success: true, data: {} });
        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data: {} });
        apiMocks.fetchLoginConfig.mockResolvedValue({ success: true, data: {} });

        await store.login('password');

        expect(store.sessionState).toBe('loggedIn');
    });

    it('keeps default-password warning from login response for immediate frontend display', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();

        apiMocks.login.mockResolvedValue({
            success: true,
            data: {
                securityWarning: {
                    type: 'default_admin_password',
                    shouldChangePassword: true,
                    message: '当前正在使用默认管理员密码 admin，请登录后立即修改。',
                },
            },
        });
        apiMocks.fetchInitialData.mockResolvedValue({
            success: true,
            data: { config: { isDefaultPassword: true }, misubs: [], profiles: [] },
        });
        apiMocks.fetchLoginConfig.mockResolvedValue({
            success: true,
            data: { customLoginPath: 'login' },
        });

        await store.login('admin');

        expect(store.securityWarning).toMatchObject({
            type: 'default_admin_password',
            shouldChangePassword: true,
        });
    });
});
