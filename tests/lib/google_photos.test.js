import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db.js', () => ({ query: vi.fn() }));

describe('lib/google_photos', () => {
    beforeEach(() => {
        process.env.GOOGLE_CLIENT_ID = 'client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'secret';
    });

    it('builds a sign-in URL that asks for the Photos Picker scope and offline access', async () => {
        const { buildAuthUrl, PICKER_SCOPE } = await import('../../lib/google_photos.js');
        const url = new URL(buildAuthUrl({ state: 's', redirect_uri: 'http://localhost:3000/api/auth/callback' }));
        expect(url.searchParams.get('scope').split(' ')).toEqual(['openid', 'email', 'profile', PICKER_SCOPE]);
        expect(url.searchParams.get('access_type')).toBe('offline');
        expect(url.searchParams.get('prompt')).toBe('select_account');
        const consent = new URL(buildAuthUrl({ state: 's', redirect_uri: 'x', consent: true }));
        expect(consent.searchParams.get('prompt')).toBe('consent');
    });

    it('detects whether the Photos scope was granted', async () => {
        const { hasPhotosScope, PICKER_SCOPE } = await import('../../lib/google_photos.js');
        expect(hasPhotosScope({ scope: `openid email ${PICKER_SCOPE}` })).toBe(true);
        expect(hasPhotosScope({ scope: 'openid email profile' })).toBe(false);
    });

    it('decodes ID token claims', async () => {
        const { decodeIdToken } = await import('../../lib/google_photos.js');
        const body = Buffer.from(JSON.stringify({ sub: '42', email: 'a@b.c' })).toString('base64url');
        expect(decodeIdToken(`h.${body}.sig`)).toMatchObject({ sub: '42', email: 'a@b.c' });
        expect(() => decodeIdToken(undefined)).toThrow();
    });

    it('parses Picker API durations', async () => {
        const { durationMs } = await import('../../lib/google_photos.js');
        expect(durationMs('5s', 1)).toBe(5000);
        expect(durationMs('1800s', 1)).toBe(1800000);
        expect(durationMs(undefined, 42)).toBe(42);
    });
});
