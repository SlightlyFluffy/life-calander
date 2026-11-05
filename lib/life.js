import { query } from '@/lib/db.js';
import { getSignedDownloadUrl } from '@/lib/blob.js';

export const getCalendar = async (user_id) => {
    const { rows } = await query(
        "SELECT to_char(birth_date, 'YYYY-MM-DD') AS birth_date, lifespan_years FROM life_calendars WHERE user_id = $1",
        [user_id]
    );
    return rows[0] || null;
};

export const EVENT_COLUMNS = "id, to_char(event_date, 'YYYY-MM-DD') AS event_date, title, notes, emoji, image_path, created_at, updated_at";
export const PHOTO_COLUMNS = "id, source, taken_at, to_char(taken_on, 'YYYY-MM-DD') AS taken_on, media_type, file_name, file_path, width, height";

export const serializeEvent = async (row) => ({
    ...row,
    image_url: row.image_path ? await getSignedDownloadUrl(row.image_path) : null,
    image_path: undefined
});

export const serializePhoto = async (row) => ({
    ...row,
    url: await getSignedDownloadUrl(row.file_path),
    file_path: undefined
});

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
