import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';
import { buildAuthUrl, isGoogleConfigured, redirectUri, STATE_COOKIE } from '@/lib/google_photos.js';

export const runtime = 'nodejs';

// Starts Google sign-in. `?consent=1` re-shows the consent screen, used to
// grant Google Photos access after declining it or to get a new refresh token.
export async function GET(request) {
    if (!isGoogleConfigured()) {
        return NextResponse.redirect(new URL('/login?error=not_configured', request.url));
    }

    const url = new URL(request.url);
    const consent = url.searchParams.get('consent') === '1';
    const nonce = randomBytes(16).toString('hex');
    const state = await new SignJWT({ type: 'google_oauth', nonce, consent })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const redirect = NextResponse.redirect(buildAuthUrl({ state, redirect_uri: redirectUri(request.url), consent }));
    redirect.cookies.set(STATE_COOKIE, nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 600
    });
    return redirect;
}
