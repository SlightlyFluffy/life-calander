import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/session.js';
import { uploadFile } from '@/lib/blob.js';
import { localDateOf } from '@/lib/life_weeks.js';
import {
    getAccessToken, listPickedItems, downloadPickedItem, GoogleNotConnectedError
} from '@/lib/google_photos.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PAGE_SIZE = 25;
const CONCURRENCY = 5;

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' };

const runPool = async (items, limit, worker) => {
    const results = [];
    let index = 0;
    const next = async () => {
        while (index < items.length) {
            const current = index++;
            results[current] = await worker(items[current]).then(
                (value) => ({ ok: true, value }),
                (error) => ({ ok: false, error })
            );
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
    return results;
};

// Imports one page of the items picked in a session. The client calls this
// repeatedly with the returned next_page_token until it comes back null.
export async function POST(request, { params }) {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    try {
        const { id: session_id } = await params;
        const body = await request.json().catch(() => ({}));
        const time_zone = typeof body.time_zone === 'string' ? body.time_zone : 'UTC';

        const access_token = await getAccessToken(user.user_id);
        const page = await listPickedItems(access_token, { session_id, page_token: body.page_token, page_size: PAGE_SIZE });
        const items = (page?.mediaItems || []).filter((item) => item.mediaFile?.baseUrl && item.createTime);

        const { rows: existing } = items.length
            ? await query(
                "SELECT source_id FROM life_photos WHERE user_id = $1 AND source = 'google_photos' AND source_id = ANY($2)",
                [user.user_id, items.map((item) => item.id)]
            )
            : { rows: [] };
        const already = new Set(existing.map((row) => row.source_id));
        const fresh = items.filter((item) => !already.has(item.id));

        const results = await runPool(fresh, CONCURRENCY, async (item) => {
            const { buffer, content_type } = await downloadPickedItem(access_token, item);
            const extension = EXTENSIONS[content_type] || 'jpg';
            const file = new File([buffer], `${item.id}.${extension}`, { type: content_type });
            const { pathname } = await uploadFile({ user_id: user.user_id, file, kind: 'life-photo' });
            const metadata = item.mediaFile.mediaFileMetadata || {};
            await query(
                `INSERT INTO life_photos (user_id, source, source_id, taken_at, taken_on, media_type, file_name, file_path, width, height)
                 VALUES ($1, 'google_photos', $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT DO NOTHING`,
                [
                    user.user_id, item.id, item.createTime, localDateOf(item.createTime, time_zone),
                    item.type === 'VIDEO' ? 'VIDEO' : 'PHOTO', item.mediaFile.filename || null, pathname,
                    metadata.width ? Number(metadata.width) : null, metadata.height ? Number(metadata.height) : null
                ]
            );
        });

        const failed = results.filter((result) => !result.ok);
        failed.forEach((result) => console.error('Photo import item failed:', { error: result.error.message }));

        return NextResponse.json({
            imported: results.length - failed.length,
            skipped: items.length - fresh.length,
            failed: failed.length,
            next_page_token: page?.nextPageToken || null
        });
    } catch (error) {
        if (error instanceof GoogleNotConnectedError) {
            return NextResponse.json({ error: error.message, code: 'not_connected' }, { status: 409 });
        }
        console.error('Import picked photos error:', { error: error.message });
        return NextResponse.json({ error: 'Failed to import photos' }, { status: 502 });
    }
}
