import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db.js';
import { setSessionCookie } from '@/lib/session.js';
import {
    exchangeCode, saveConnection, decodeIdToken, hasPhotosScope, redirectUri, STATE_COOKIE
} from '@/lib/google_photos.js';

export const runtime = 'nodejs';

const redirectTo = (request, path) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.set(STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return response;
};

export async function GET(request) {
    const url = new URL(request.url);
    if (url.searchParams.get('error')) {
        return redirectTo(request, '/login?error=cancelled');
    }

    try {
        const { payload: state } = await jwtVerify(
            url.searchParams.get('state') || '',
            new TextEncoder().encode(process.env.JWT_SECRET)
        );
        const cookie_nonce = request.cookies.get(STATE_COOKIE)?.value;
        if (state.type !== 'google_oauth' || !cookie_nonce || state.nonce !== cookie_nonce) {
            return redirectTo(request, '/login?error=invalid');
        }

        const tokens = await exchangeCode({ code: url.searchParams.get('code'), redirect_uri: redirectUri(request.url) });
        const identity = decodeIdToken(tokens.id_token);

        const { rows } = await query(
            `INSERT INTO users (google_sub, email, name, picture) VALUES ($1, $2, $3, $4)
             ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name,
                picture = EXCLUDED.picture, last_login_at = now()
             RETURNING id`,
            [identity.sub, identity.email || null, identity.name || null, identity.picture || null]
        );
        const user_id = rows[0].id;

        const saved = await saveConnection({ user_id, tokens });
        // Google only sends a refresh token on first consent. If we have none
        // stored (e.g. the database was reset), ask for consent once more.
        if (!saved && !state.consent) {
            return redirectTo(request, '/api/auth/google?consent=1');
        }

        const destination = hasPhotosScope(tokens)
            ? (state.consent ? '/?google=connected' : '/')
            : '/?google=photos_declined';
        const response = redirectTo(request, destination);
        await setSessionCookie(response, { user_id });
        return response;
    } catch (error) {
        console.error('Google sign-in error:', { error: error.message });
        return redirectTo(request, '/login?error=error');
    }
}
