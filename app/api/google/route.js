import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session.js';
import { disconnect } from '@/lib/google_photos.js';

export const runtime = 'nodejs';

// Revokes Google Photos access. Imported photos stay; the user stays signed in.
export async function DELETE(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        await disconnect(user.user_id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Google disconnect error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to disconnect Google Photos' }, { status: 500 });
    }
}
