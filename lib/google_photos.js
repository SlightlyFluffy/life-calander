// Google OAuth + Google Photos Picker API helpers.
//
// Since March 2025 the Google Photos Library API can no longer read a user's whole
// library. The supported way is the Picker API: the user chooses photos in a
// Google-hosted picker, and we receive only those items. Their download URLs expire
// after ~60 minutes, so we copy a resized version into our own Blob storage.

import { query } from '@/lib/db.js';
import { encrypt, decrypt } from '@/lib/encryption.js';

export const STATE_COOKIE = 'lc_google_state';
export const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const LOGIN_SCOPES = ['openid', 'email', 'profile', PICKER_SCOPE];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const PICKER_API = 'https://photospicker.googleapis.com/v1';

export const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = (request_url) => {
    const base = process.env.APP_URL || new URL(request_url).origin;
    return `${base.replace(/\/$/, '')}/api/auth/callback`;
};

// `consent` forces Google to show the consent screen again, which is the only
// way to get a new refresh token or a scope the user previously declined.
export const buildAuthUrl = ({ state, redirect_uri, consent = false }) => {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri,
        response_type: 'code',
        scope: LOGIN_SCOPES.join(' '),
        access_type: 'offline',
        prompt: consent ? 'consent' : 'select_account',
        include_granted_scopes: 'true',
        state
    });
    return `${AUTH_URL}?${params.toString()}`;
};

const postForm = async (url, params) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error_description || data.error || `Google token request failed: ${response.status}`);
        error.code = data.error;
        throw error;
    }
    return data;
};

export const exchangeCode = ({ code, redirect_uri }) => postForm(TOKEN_URL, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri,
    grant_type: 'authorization_code'
});

export const hasPhotosScope = (tokens) => String(tokens.scope || '').split(' ').includes(PICKER_SCOPE);

// Stores Google tokens. Without a new refresh token, only the access token is updated.
export const saveConnection = async ({ user_id, tokens }) => {
    const expires_at = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
    if (tokens.refresh_token) {
        await query(
            `INSERT INTO google_connections (user_id, refresh_token, access_token, access_token_expires_at, has_photos_scope)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
                refresh_token = EXCLUDED.refresh_token,
                access_token = EXCLUDED.access_token,
                access_token_expires_at = EXCLUDED.access_token_expires_at,
                has_photos_scope = EXCLUDED.has_photos_scope,
                updated_at = now()`,
            [user_id, encrypt(tokens.refresh_token), encrypt(tokens.access_token), expires_at, hasPhotosScope(tokens)]
        );
        return true;
    }
    const { rowCount } = await query(
        `UPDATE google_connections SET access_token = $1, access_token_expires_at = $2,
            has_photos_scope = has_photos_scope OR $3, updated_at = now() WHERE user_id = $4`,
        [encrypt(tokens.access_token), expires_at, hasPhotosScope(tokens), user_id]
    );
    return rowCount > 0;
};

// Reads the identity claims from an ID token received directly from Google's
// token endpoint over TLS (no signature check needed for that case).
export const decodeIdToken = (id_token) => {
    const payload = String(id_token || '').split('.')[1];
    if (!payload) throw new Error('Missing ID token');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
};

export const getConnection = async (user_id) => {
    const { rows } = await query('SELECT * FROM google_connections WHERE user_id = $1', [user_id]);
    return rows[0] || null;
};

export class GoogleNotConnectedError extends Error {}

// Returns a valid access token, refreshing it when it has expired.
export const getAccessToken = async (user_id) => {
    const connection = await getConnection(user_id);
    if (!connection || !connection.has_photos_scope) throw new GoogleNotConnectedError('Google Photos is not connected');

    if (connection.access_token && new Date(connection.access_token_expires_at) > new Date()) {
        return decrypt(connection.access_token);
    }

    let tokens;
    try {
        tokens = await postForm(TOKEN_URL, {
            refresh_token: decrypt(connection.refresh_token),
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token'
        });
    } catch (error) {
        if (error.code === 'invalid_grant') {
            await query('DELETE FROM google_connections WHERE user_id = $1', [user_id]);
            throw new GoogleNotConnectedError('Google access was revoked. Please reconnect.');
        }
        throw error;
    }

    const expires_at = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
    await query(
        'UPDATE google_connections SET access_token = $1, access_token_expires_at = $2, updated_at = now() WHERE user_id = $3',
        [encrypt(tokens.access_token), expires_at, user_id]
    );
    return tokens.access_token;
};

export const disconnect = async (user_id) => {
    const connection = await getConnection(user_id);
    if (!connection) return;
    try {
        await fetch(`${REVOKE_URL}?token=${encodeURIComponent(decrypt(connection.refresh_token))}`, { method: 'POST' });
    } catch (error) {
        console.error('Google revoke failed:', { error: error.message });
    }
    await query('DELETE FROM google_connections WHERE user_id = $1', [user_id]);
};

const pickerFetch = async (access_token, path, init = {}) => {
    const response = await fetch(`${PICKER_API}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json', ...(init.headers || {}) }
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error?.message || `Google Photos request failed: ${response.status}`);
    }
    return data;
};

export const createPickerSession = (access_token) => pickerFetch(access_token, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ pickingConfig: { maxItemCount: '2000' } })
});

export const getPickerSession = (access_token, session_id) =>
    pickerFetch(access_token, `/sessions/${encodeURIComponent(session_id)}`);

export const deletePickerSession = (access_token, session_id) =>
    pickerFetch(access_token, `/sessions/${encodeURIComponent(session_id)}`, { method: 'DELETE' });

export const listPickedItems = (access_token, { session_id, page_token, page_size }) => {
    const params = new URLSearchParams({ sessionId: session_id, pageSize: String(page_size) });
    if (page_token) params.set('pageToken', page_token);
    return pickerFetch(access_token, `/mediaItems?${params.toString()}`);
};

// Downloads a resized copy (videos return a still frame) of a picked item.
export const downloadPickedItem = async (access_token, item, size = 1600) => {
    const response = await fetch(`${item.mediaFile.baseUrl}=w${size}-h${size}`, {
        headers: { authorization: `Bearer ${access_token}` }
    });
    if (!response.ok) {
        throw new Error(`Failed to download ${item.id}: ${response.status}`);
    }
    const content_type = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, content_type };
};

// Pulls a duration like "5s" or "1800s" from the Picker API into milliseconds.
export const durationMs = (value, fallback) => {
    const match = /^([\d.]+)s$/.exec(String(value || ''));
    return match ? Math.round(Number(match[1]) * 1000) : fallback;
};
