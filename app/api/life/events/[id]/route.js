import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { deleteFile } from '@/lib/blob.js';
import { EVENT_COLUMNS, serializeEvent } from '@/lib/life.js';
import { isValidDateString } from '@/lib/life_weeks.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id } = await params;
        const body = await request.json();
        const title = body.title === undefined ? null : String(body.title).trim();
        if (title === '') {
            return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
        }
        if (body.event_date !== undefined && !isValidDateString(body.event_date)) {
            return NextResponse.json({ error: 'A valid date is required' }, { status: 400 });
        }

        const { rows } = await query(
            `UPDATE life_events SET
                title = COALESCE($1, title),
                event_date = COALESCE($2, event_date),
                notes = CASE WHEN $3::boolean THEN $4 ELSE notes END,
                emoji = CASE WHEN $5::boolean THEN $6 ELSE emoji END,
                updated_at = now()
             WHERE id = $7 AND user_id = $8 RETURNING ${EVENT_COLUMNS}`,
            [
                title,
                body.event_date ?? null,
                body.notes !== undefined, body.notes ? String(body.notes).trim() : null,
                body.emoji !== undefined, body.emoji ? String(body.emoji).trim().slice(0, 8) : null,
                id, user.user_id
            ]
        );
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        return NextResponse.json({ event: await serializeEvent(rows[0]) });
    } catch (error) {
        console.error('Update life event error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id } = await params;
        const { rows } = await query(
            'DELETE FROM life_events WHERE id = $1 AND user_id = $2 RETURNING image_path',
            [id, user.user_id]
        );
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (rows[0].image_path) {
            await deleteFile(rows[0].image_path).catch((error) => console.error('Blob delete failed:', { error: error.message }));
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Delete life event error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }
}
