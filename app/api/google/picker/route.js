import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session.js';
import { getAccessToken, createPickerSession, durationMs, GoogleNotConnectedError } from '@/lib/google_photos.js';

export const runtime = 'nodejs';

export async function POST(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const access_token = await getAccessToken(user.user_id);
        const session = await createPickerSession(access_token);
        return NextResponse.json({
            id: session.id,
            picker_uri: `${session.pickerUri.replace(/\/$/, '')}/autoclose`,
            poll_interval_ms: durationMs(session.pollingConfig?.pollInterval, 4000),
            timeout_ms: durationMs(session.pollingConfig?.timeoutIn, 30 * 60 * 1000)
        });
    } catch (error) {
        if (error instanceof GoogleNotConnectedError) {
            return NextResponse.json({ error: error.message, code: 'not_connected' }, { status: 409 });
        }
        console.error('Create picker session error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to open Google Photos picker' }, { status: 502 });
    }
}
