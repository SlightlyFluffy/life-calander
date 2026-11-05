import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { getCalendar } from '@/lib/life.js';
import { isValidDateString, todayString } from '@/lib/life_weeks.js';
import { isGoogleConfigured, getConnection } from '@/lib/google_photos.js';

export const runtime = 'nodejs';

// Calendar settings plus per-day counts; the client buckets days into weeks.
export async function GET(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const [calendar, connection, photo_days, event_days] = await Promise.all([
            getCalendar(user.user_id),
            getConnection(user.user_id),
            query(
                "SELECT to_char(taken_on, 'YYYY-MM-DD') AS day, count(*)::int AS count FROM life_photos WHERE user_id = $1 GROUP BY taken_on",
                [user.user_id]
            ),
            query(
                "SELECT to_char(event_date, 'YYYY-MM-DD') AS day, count(*)::int AS count, array_agg(coalesce(emoji, '')) AS emojis FROM life_events WHERE user_id = $1 GROUP BY event_date",
                [user.user_id]
            )
        ]);

        return NextResponse.json({
            calendar,
            photo_days: photo_days.rows,
            event_days: event_days.rows,
            google: { configured: isGoogleConfigured(), connected: Boolean(connection?.has_photos_scope) },
            can_edit: true
        });
    } catch (error) {
        console.error('Get life calendar error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to load life calendar' }, { status: 500 });
    }
}

export async function PUT(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { birth_date, lifespan_years } = await request.json();
        if (!isValidDateString(birth_date) || birth_date > todayString()) {
            return NextResponse.json({ error: 'A valid birth date in the past is required' }, { status: 400 });
        }
        const lifespan = Number(lifespan_years ?? 90);
        if (!Number.isInteger(lifespan) || lifespan < 1 || lifespan > 120) {
            return NextResponse.json({ error: 'Lifespan must be between 1 and 120 years' }, { status: 400 });
        }

        await query(
            `INSERT INTO life_calendars (user_id, birth_date, lifespan_years) VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET birth_date = EXCLUDED.birth_date, lifespan_years = EXCLUDED.lifespan_years, updated_at = now()`,
            [user.user_id, birth_date, lifespan]
        );
        return NextResponse.json({ calendar: await getCalendar(user.user_id) });
    } catch (error) {
        console.error('Save life calendar error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to save life calendar' }, { status: 500 });
    }
}
