import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';

export const runtime = 'nodejs';

export async function GET(request) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { rows } = await query('SELECT id, email, name, picture FROM users WHERE id = $1', [user.user_id]);
    if (rows.length === 0) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ user: rows[0] });
}
