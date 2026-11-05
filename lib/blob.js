import { put, del, get } from '@vercel/blob';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const getSigningSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required for signing blob URLs');
    }
    return secret;
};

const signPayload = (pathname, expires_at) => {
    const hmac = createHmac('sha256', getSigningSecret());
    hmac.update(`${pathname}:${expires_at}`);
    return hmac.digest('hex');
};

export const uploadFile = async ({ user_id, file, kind }) => {
    const extension = (file.name?.split('.').pop() || 'bin').toLowerCase();
    const key = `${user_id}/${kind}/${randomUUID()}.${extension}`;
    const result = await put(key, file, {
        access: 'private',
        addRandomSuffix: false
    });
    return { pathname: result.pathname };
};

export const deleteFile = async (pathname) => {
    await del(pathname);
};

export const getSignedDownloadUrl = async (pathname, options = {}) => {
    const ttl_seconds = options.ttl_seconds ?? SIGNED_URL_TTL_SECONDS;
    const expires_at = Math.floor(Date.now() / 1000) + ttl_seconds;
    const signature = signPayload(pathname, expires_at);
    const base = process.env.APP_URL ?? '';
    const encoded = pathname.split('/').map(encodeURIComponent).join('/');
    return `${base}/api/blob/${encoded}?exp=${expires_at}&sig=${signature}`;
};

export const verifySignedDownload = ({ pathname, exp, sig }) => {
    if (!pathname || !exp || !sig) {
        return { valid: false, reason: 'missing-params' };
    }
    const expires_at = Number(exp);
    if (!Number.isFinite(expires_at)) {
        return { valid: false, reason: 'invalid-exp' };
    }
    if (Math.floor(Date.now() / 1000) > expires_at) {
        return { valid: false, reason: 'expired' };
    }
    const expected = signPayload(pathname, expires_at);
    let expected_buf;
    let sig_buf;
    try {
        expected_buf = Buffer.from(expected, 'hex');
        sig_buf = Buffer.from(sig, 'hex');
    } catch {
        return { valid: false, reason: 'bad-signature' };
    }
    if (expected_buf.length !== sig_buf.length || expected_buf.length === 0) {
        return { valid: false, reason: 'bad-signature' };
    }
    if (!timingSafeEqual(expected_buf, sig_buf)) {
        return { valid: false, reason: 'bad-signature' };
    }
    return { valid: true };
};

export const streamPrivateBlob = async (pathname) => {
    const result = await get(pathname, { access: 'private' });
    return result;
};
