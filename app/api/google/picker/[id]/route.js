import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session.js';
import { getAccessToken, getPickerSession, deletePickerSession, GoogleNotConnectedError } from '@/lib/google_photos.js';

export const runtime = 'nodejs';

const handleError = (error, label) => {
    if (error instanceof GoogleNotConnectedError) {
        return NextResponse.json({ error: error.message, code: 'not_connected' }, { status: 409 });
    }
    console.error(label, { error: error.message });
    return NextResponse.json({ error: 'Google Photos request failed' }, { status: 502 });
};

export async function GET(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id } = await params;
        const session = await getPickerSession(await getAccessToken(user.user_id), id);
        return NextResponse.json({ media_items_set: Boolean(session.mediaItemsSet), expire_time: session.expireTime });
    } catch (error) {
        return handleError(error, 'Poll picker session error:');
    }
}

export async function DELETE(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id } = await params;
        await deletePickerSession(await getAccessToken(user.user_id), id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleError(error, 'Delete picker session error:');
    }
}
