// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeFetchNetworkUrl, readResponseBufferWithLimit } from '../../functions/modules/security-utils.js';
import { fetchRemoteSourceSnapshot } from '../../functions/services/subscription-service.js';
import { fetchTransformTemplate } from '../../functions/modules/subscription/transform-template-cache.js';
import { handleNodeCountRequest } from '../../functions/modules/handlers/node-handler.js';
import { fetchSubscriptionNodes } from '../../functions/modules/subscription/node-fetcher.js';

describe('audit: bounded external requests across subscription and admin paths', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
    it('follows public redirects while stripping cross-origin credentials and preserving Cloudflare TLS options', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://cdn.example/sub' } }))
            .mockResolvedValueOnce(new Response('ok'));
        vi.stubGlobal('fetch', fetcher);
        await safeFetchNetworkUrl('https://source.example/sub', { headers: { Authorization: 'synthetic', Cookie: 'synthetic', 'User-Agent': 'Synthetic' }, cf: { insecureSkipVerify: true } });
        const [request, options] = fetcher.mock.calls[1];
        expect(request.url).toBe('https://cdn.example/sub');
        expect(request.headers.get('authorization')).toBeNull();
        expect(request.headers.get('cookie')).toBeNull();
        expect(request.headers.get('user-agent')).toBe('Synthetic');
        expect(options.cf.insecureSkipVerify).toBe(true);
    });
    it('enforces actual streamed byte limits even if Content-Length understates the body', async () => {
        const cancel = vi.fn();
        const response = new Response(new ReadableStream({
            start(controller) { controller.enqueue(new Uint8Array(33)); }, cancel,
        }), { headers: { 'Content-Length': '1' } });
        await expect(readResponseBufferWithLimit(response, 32)).rejects.toThrow('Response content too large');
        expect(cancel).toHaveBeenCalled();
    });
    it('rejects an oversized upstream before it can replace a saved snapshot', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('synthetic', { headers: { 'Content-Length': '10485761' } })));
        await expect(fetchRemoteSourceSnapshot({ url: 'https://source.example/sub' })).rejects.toThrow('Response content too large');
    });
    it('keeps the upstream timeout active until its body finishes', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async request => new Response(new ReadableStream({
            start(controller) { request.signal.addEventListener('abort', () => controller.error(new Error('Body aborted'))); },
        }))));
        const result = expect(fetchRemoteSourceSnapshot({ url: 'https://source.example/sub' })).rejects.toThrow('Body aborted');
        await vi.advanceTimersByTimeAsync(12000);
        await result;
    });
    it('preserves an 18-hour template on body failure within its advertised 24-hour fallback window', async () => {
        const storage = { get: async () => ({ nodes: 'saved template', timestamp: Date.now() - 18 * 3600000 }), put: vi.fn() };
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
            start(controller) { controller.error(new Error('Synthetic body failure')); },
        }))));
        expect(await fetchTransformTemplate(storage, 'https://template.example/config')).toBe('saved template');
        expect(storage.put).not.toHaveBeenCalled();
    });
    it('blocks private direct preview URLs without making network requests', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
        const result = await fetchSubscriptionNodes('http://127.0.0.1/sub', 'Synthetic', 'Synthetic');
        expect(result.success).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();
    });
    it('blocks private redirect targets in node-count diagnostics', async () => {
        const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'http://10.0.0.1/sub' } }));
        vi.stubGlobal('fetch', fetcher);
        const response = await handleNodeCountRequest(new Request('https://local.example/api/node_count', {
            method: 'POST', body: JSON.stringify({ url: 'https://source.example/sub' }),
        }), {});
        expect((await response.json()).success).toBe(false);
        expect(fetcher.mock.calls.every(([request]) => new URL(request.url).hostname === 'source.example')).toBe(true);
    });
});
