import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { deleteFile } from '@/lib/blob.js';

export const runtime = 'nodejs';

// Removes the copy stored in Little Red Book. Nothing is deleted from Google Photos.
export async function DELETE(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id } = await params;
        const { rows } = await query(
            'DELETE FROM life_photos WHERE id = $1 AND user_id = $2 RETURNING file_path',
            [id, user.user_id]
        );
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }
        await deleteFile(rows[0].file_path).catch((error) => console.error('Blob delete failed:', { error: error.message }));
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Delete life photo error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
    }
}
