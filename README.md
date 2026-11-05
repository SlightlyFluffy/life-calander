# Life in Weeks

A web app that draws your life as a grid with one box per week (one row per year of age) and fills it with your Google Photos and the moments you add yourself.

- **Hover** over a week to preview its moments and photos.
- **Click** a week to open it: see all its photos, step to the previous or next week, and add, edit or delete moments (title, date, emoji, notes, optional photo).
- **Import from Google Photos:** choose photos in Google's picker. Each one lands on the week it was taken.

Built with Next.js 15 (App Router), Postgres, Vercel Blob and Tailwind. You sign in with Google.

## How Google Photos works

Since March 2025, Google doesn't let apps read a whole Google Photos library. This app uses the **Google Photos Picker API**: you pick photos (up to 2,000 at a time) in a Google window, and the app copies a resized version of each (800 px on the long side, about 80 KB) into Vercel Blob. To keep storage bounded, at most 10 photos are kept per week; extra picks for a full week are skipped. Both limits are constants in `lib/life.js`. It keeps copies because Google's links to picked photos stop working after about an hour. Videos are stored as a still frame. Removing a photo from the calendar never touches the original in Google Photos.

## Setup

### 1. Google Cloud

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **Photos Picker API**.
2. Configure the **OAuth consent screen** with the scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. While the app is in "Testing", add yourself (and anyone else) as a test user.
3. Create an **OAuth client ID** (type: Web application) with these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://<your-deployment>/api/auth/callback`

### 2. Environment variables

| Name | Value |
|------|-------|
| `DATABASE_URL` | Postgres connection string (e.g. Neon via the Vercel Marketplace) |
| `BLOB_STORE_ID` | Added automatically when you connect a Blob store. On Vercel, the app authenticates to Blob through Vercel's built-in OIDC token. Older stores give `BLOB_READ_WRITE_TOKEN` instead, which also works. |
| `JWT_SECRET` | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (encrypts stored Google tokens) |
| `APP_URL` | `http://localhost:3000` locally, your deployment URL in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From the OAuth client above |

### 3. Run

```bash
npm install
npx vercel link && npx vercel env pull .env.local   # or copy .env.example and fill it in
npm run migrate              # needs DATABASE_URL in the environment
npm run dev
```

Open http://localhost:3000, sign in with Google and enter your birth date.

## Tests

```bash
npm test
```
