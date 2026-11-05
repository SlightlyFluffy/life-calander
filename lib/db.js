import pg from 'pg';

const is_local = (process.env.DATABASE_URL || '').includes('localhost');

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: is_local ? false : { rejectUnauthorized: false }
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
