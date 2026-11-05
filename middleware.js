import { NextResponse } from 'next/server';
import { readSessionFromRequest } from '@/lib/session.js';

const PUBLIC_PREFIXES = ['/login', '/api/auth/google', '/api/auth/callback'];

export const middleware = async (request) => {
    const { pathname } = request.nextUrl;
    const user = await readSessionFromRequest(request);

    if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        if (pathname === '/login' && user) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }

    if (!user) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
};

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png).*)']
};
