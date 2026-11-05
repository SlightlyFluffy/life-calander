import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

export const COOKIE_NAME = 'lc_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export const signSession = (payload) => new SignJWT({ ...payload, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_SECONDS)
    .sign(getSecret());

export const readSessionFromRequest = async (request) => {
    const cookie = request.cookies.get(COOKIE_NAME);
    if (!cookie) return null;
    try {
        const { payload } = await jwtVerify(cookie.value, getSecret());
        return payload.type === 'session' ? payload : null;
    } catch {
        return null;
    }
};

export const requireAuth = async (request) => {
    const user = await readSessionFromRequest(request);
    if (!user) {
        return { user: null, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
    }
    return { user, response: null };
};

export const setSessionCookie = async (response, payload) => {
    response.cookies.set(COOKIE_NAME, await signSession(payload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_SECONDS
    });
    return response;
};

export const clearSessionCookie = (response) => {
    response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return response;
};
