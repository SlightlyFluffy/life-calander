import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-dev-key', 'salt', 32);

export const encrypt = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const auth_tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${auth_tag}:${encrypted}`;
};

export const decrypt = (encrypted_text) => {
    const [iv_hex, auth_tag_hex, encrypted] = encrypted_text.split(':');
    const iv = Buffer.from(iv_hex, 'hex');
    const auth_tag = Buffer.from(auth_tag_hex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(auth_tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

export const encryptFields = (custom_fields, encrypted_field_names) => {
    const result = { ...custom_fields };
    for (const field_name of encrypted_field_names) {
        if (result[field_name] !== undefined && result[field_name] !== null) {
            result[field_name] = encrypt(String(result[field_name]));
        }
    }
    return result;
};

export const decryptFields = (custom_fields, encrypted_field_names) => {
    const result = { ...custom_fields };
    for (const field_name of encrypted_field_names) {
        if (result[field_name] !== undefined && result[field_name] !== null) {
            result[field_name] = decrypt(result[field_name]);
        }
    }
    return result;
};
