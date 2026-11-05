export const shorthands = undefined;

export async function up(pgm) {
    pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        google_sub: { type: 'text', notNull: true, unique: true },
        email: { type: 'text' },
        name: { type: 'text' },
        picture: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        last_login_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
    });

    pgm.createTable('google_connections', {
        user_id: { type: 'uuid', primaryKey: true, references: 'users', onDelete: 'CASCADE' },
        refresh_token: { type: 'text', notNull: true },
        access_token: { type: 'text' },
        access_token_expires_at: { type: 'timestamptz' },
        has_photos_scope: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
    });

    pgm.createTable('life_calendars', {
        user_id: { type: 'uuid', primaryKey: true, references: 'users', onDelete: 'CASCADE' },
        birth_date: { type: 'date', notNull: true },
        lifespan_years: { type: 'integer', notNull: true, default: 90 },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
    });

    pgm.createTable('life_events', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
        event_date: { type: 'date', notNull: true },
        title: { type: 'text', notNull: true },
        notes: { type: 'text' },
        emoji: { type: 'text' },
        image_path: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
    });
    pgm.createIndex('life_events', ['user_id', 'event_date']);

    pgm.createTable('life_photos', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
        source: { type: 'text', notNull: true, default: 'google_photos' },
        source_id: { type: 'text' },
        taken_at: { type: 'timestamptz', notNull: true },
        taken_on: { type: 'date', notNull: true },
        media_type: { type: 'text', notNull: true, default: 'PHOTO' },
        file_name: { type: 'text' },
        file_path: { type: 'text', notNull: true },
        width: { type: 'integer' },
        height: { type: 'integer' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
    });
    pgm.createIndex('life_photos', ['user_id', 'taken_on']);
    pgm.sql('CREATE UNIQUE INDEX life_photos_source_unique ON life_photos(user_id, source, source_id) WHERE source_id IS NOT NULL');
}

export async function down(pgm) {
    pgm.dropTable('life_photos');
    pgm.dropTable('life_events');
    pgm.dropTable('life_calendars');
    pgm.dropTable('google_connections');
    pgm.dropTable('users');
}
