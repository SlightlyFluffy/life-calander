import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session.js';
import { verifySignedDownload, streamPrivateBlob } from '@/lib/blob.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { pathname: segments } = await params;
        const pathname = Array.isArray(segments) ? segments.map(decodeURIComponent).join('/') : '';
        const url = new URL(request.url);
        const exp = url.searchParams.get('exp');
        const sig = url.searchParams.get('sig');

        if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0') || pathname.startsWith('/')) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
        }

        const verification = verifySignedDownload({ pathname, exp, sig });
        if (!verification.valid) {
            return NextResponse.json({ error: 'Invalid or expired signature' }, { status: 403 });
        }

        if (!pathname.startsWith(`${user.user_id}/`)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await streamPrivateBlob(pathname);
        if (!result || !result.stream) {
            return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
        }

        const headers = new Headers();
        if (result.blob?.contentType) {
            headers.set('Content-Type', result.blob.contentType);
        }
        if (result.blob?.size) {
            headers.set('Content-Length', String(result.blob.size));
        }
        if (result.blob?.contentDisposition) {
            headers.set('Content-Disposition', result.blob.contentDisposition);
        }
        headers.set('Cache-Control', 'private, max-age=0, no-store');

        return new Response(result.stream, { status: 200, headers });
    } catch (error) {
        console.error('Blob stream error:', { error: error.message, stack: error.stack });
        return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
    }
}
