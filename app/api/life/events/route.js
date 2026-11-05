import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { uploadFile } from '@/lib/blob.js';
import { EVENT_COLUMNS, serializeEvent, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/life.js';
import { isValidDateString } from '@/lib/life_weeks.js';

export const runtime = 'nodejs';

// Accepts multipart form data so an optional image can be attached.
export async function POST(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const form = await request.formData();
        const title = String(form.get('title') || '').trim();
        const event_date = String(form.get('event_date') || '');
        const notes = String(form.get('notes') || '').trim() || null;
        const emoji = String(form.get('emoji') || '').trim().slice(0, 8) || null;
        const image = form.get('image');

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!isValidDateString(event_date)) {
            return NextResponse.json({ error: 'A valid date is required' }, { status: 400 });
        }

        let image_path = null;
        if (image && typeof image !== 'string' && image.size > 0) {
            if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
                return NextResponse.json({ error: 'Image must be JPEG, PNG, WebP, GIF or HEIC' }, { status: 400 });
            }
            if (image.size > MAX_IMAGE_BYTES) {
                return NextResponse.json({ error: 'Image must be under 10 MB' }, { status: 400 });
            }
            ({ pathname: image_path } = await uploadFile({ user_id: user.user_id, file: image, kind: 'life-event' }));
        }

        const { rows } = await query(
            `INSERT INTO life_events (user_id, event_date, title, notes, emoji, image_path) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${EVENT_COLUMNS}`,
            [user.user_id, event_date, title, notes, emoji, image_path]
        );
        return NextResponse.json({ event: await serializeEvent(rows[0]) }, { status: 201 });
    } catch (error) {
        console.error('Create life event error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }
}
