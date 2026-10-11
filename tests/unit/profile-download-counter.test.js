import { describe, expect, it, vi } from 'vitest';
import {
    incrementProfileDownload,
    profileCountKey,
    recordSuccessfulProfileResponse,
} from '../../functions/services/profile-download-counter.js';

describe('anonymous subscription usage counter', () => {
    it('uses the existing profile counter key independently of access logging', async () => {
        const rows = new Map();
        const statement = {
            bind: vi.fn((key) => ({
                run: vi.fn(async () => rows.set(key, (rows.get(key) || 0) + 1)),
            })),
        };
        const prepare = vi.fn(() => statement);
        const storage = { db: { prepare } };
        const profile = { id: 'id', customId: 'family' };
        await Promise.all(Array.from({ length: 5 }, () => incrementProfileDownload(storage, profile)));
        expect(rows.get('misub_profile_download_count_family')).toBe(5);
        expect(prepare).toHaveBeenCalledTimes(5);
        expect(prepare.mock.calls[0][0]).toContain('ON CONFLICT(key) DO UPDATE');
        expect(profileCountKey(profile)).toBe('misub_profile_download_count_family');
    });

    it('counts only successful real GET responses and waits for durable write', async () => {
        const values = new Map();
        const storage = {
            get: vi.fn(async (key) => values.get(key)),
            put: vi.fn(async (key, value) => values.set(key, value)),
        };
        const profile = { id: 'abc' };
        const pending = [];
        const context = { waitUntil(promise) { pending.push(promise); } };
        const request = new Request('https://example.org/sub', { method: 'GET' });
        for (const response of [
            new Response('good'),
            new Response('failed', { status: 503 }),
            new Response('forbidden', { status: 403 }),
        ]) {
            expect(recordSuccessfulProfileResponse({
                response, context, storage, profile, request,
            })).toBe(response);
        }
        recordSuccessfulProfileResponse({
            response: new Response('good'), context, storage, profile,
            request, skip: true,
        });
        recordSuccessfulProfileResponse({
            response: new Response('head'), context, storage, profile,
            request: new Request('https://example.org/sub', { method: 'HEAD' }),
        });
        await Promise.all(pending);
        expect(pending).toHaveLength(1);
        expect(values.get('misub_profile_download_count_abc')).toBe(1);
        expect(storage.put).toHaveBeenCalledTimes(1);
    });

    it('does not fail the response if the counter storage is unavailable', async () => {
        const waitUntil = vi.fn((task) => task);
        const response = new Response('data');
        expect(recordSuccessfulProfileResponse({
            response,
            profile: { id: 'personal' },
            context: { waitUntil },
            storage: { get: vi.fn().mockRejectedValue(new Error('unavailable')) },
            request: new Request('https://example.org/sub'),
        })).toBe(response);
        await waitUntil.mock.calls[0][0];
    });
});
