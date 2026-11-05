import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { getCalendar, EVENT_COLUMNS, PHOTO_COLUMNS, serializeEvent, serializePhoto } from '@/lib/life.js';
import { weekRange, WEEKS_PER_YEAR } from '@/lib/life_weeks.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { year: year_param, week: week_param } = await params;
        const year = Number(year_param);
        const week = Number(week_param);
        if (!Number.isInteger(year) || !Number.isInteger(week) || year < 0 || year > 130 || week < 0 || week >= WEEKS_PER_YEAR) {
            return NextResponse.json({ error: 'Invalid week' }, { status: 400 });
        }

        const calendar = await getCalendar(user.user_id);
        if (!calendar) {
            return NextResponse.json({ error: 'Life calendar is not set up' }, { status: 404 });
        }

        const { start, end } = weekRange(calendar.birth_date, year, week);
        const [events, photos] = await Promise.all([
            query(
                `SELECT ${EVENT_COLUMNS} FROM life_events WHERE user_id = $1 AND event_date >= $2 AND event_date < $3 ORDER BY event_date, created_at`,
                [user.user_id, start, end]
            ),
            query(
                `SELECT ${PHOTO_COLUMNS} FROM life_photos WHERE user_id = $1 AND taken_on >= $2 AND taken_on < $3 ORDER BY taken_at`,
                [user.user_id, start, end]
            )
        ]);

        return NextResponse.json({
            year,
            week,
            start,
            end,
            events: await Promise.all(events.rows.map(serializeEvent)),
            photos: await Promise.all(photos.rows.map(serializePhoto))
        });
    } catch (error) {
        console.error('Get life week error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to load week' }, { status: 500 });
    }
}
