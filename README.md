# PitchFlow

A minimal live queue controller for one pitching competition: one admin dashboard and one public waiting display.

## Local development

1. Install the Vercel CLI: `npm install -g vercel`
2. Copy `.env.example` to `.env.local` and fill in the values.
3. In Supabase SQL Editor, run `supabase-setup.sql`.
4. Start locally with `npm run dev`.

Opening `index.html` directly also works as a local visual preview. It uses demo teams and stores changes only until that tab is refreshed; use `npm run dev` for the API-backed app.

The fixed team list lives in `data/teams.json`. Replace it before the event, then deploy. Team numbers and names are the only public details.

## URLs

- `/admin` — single-admin control panel
- `/display/waiting` — public waiting screen

## Supabase setup

Create a Supabase project, run the SQL setup file, then add the five values from `.env.example` to your Vercel project environment variables. `SUPABASE_SECRET_KEY` is server-only and must never be prefixed with `PUBLIC_` or `NEXT_PUBLIC_`.

## Verify

Run `npm test`. The tests cover the initial queue, starting and completing pitches, the two-team public preview, and skipped/absent restoration.
