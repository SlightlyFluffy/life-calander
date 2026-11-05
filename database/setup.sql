-- One-time setup for a fresh database. Same result as `npm run migrate`.
-- Paste into the Neon SQL Editor and run it once.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  google_sub text UNIQUE NOT NULL,
  email text,
  name text,
  picture text,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_login_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE google_connections (
  user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  has_photos_scope boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE life_calendars (
  user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  birth_date date NOT NULL,
  lifespan_years integer DEFAULT 90 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE life_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  event_date date NOT NULL,
  title text NOT NULL,
  notes text,
  emoji text,
  image_path text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX life_events_user_id_event_date_index ON life_events (user_id, event_date);

CREATE TABLE life_photos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  source text DEFAULT 'google_photos' NOT NULL,
  source_id text,
  taken_at timestamptz NOT NULL,
  taken_on date NOT NULL,
  media_type text DEFAULT 'PHOTO' NOT NULL,
  file_name text,
  file_path text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX life_photos_user_id_taken_on_index ON life_photos (user_id, taken_on);
CREATE UNIQUE INDEX life_photos_source_unique ON life_photos (user_id, source, source_id) WHERE source_id IS NOT NULL;

-- Record the migration so a later `npm run migrate` doesn't try to run it again.
CREATE TABLE IF NOT EXISTS pgmigrations (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  run_on timestamp NOT NULL
);
INSERT INTO pgmigrations (name, run_on) VALUES ('001_create-life-calendar', NOW());

COMMIT;
