# DribbleTrack

DribbleTrack is a playful dribble-practice tracker for a 4-week challenge. It keeps the daily checkoff simple, highlights weekly progress toward a 4-session average, and shows a live leaderboard for the top finisher.

## What it does

- Shared passcode gate for low-friction access
- Parent-led "add your child" onboarding
- One-tap daily session checkoff
- Weekly progress toward 4 sessions
- 4-week challenge progress toward 16 total sessions
- Leaderboard for the top total across the challenge
- Suggested daily dribbling routine built into the app

## Challenge rules in the app

- Challenge start: March 23, 2026
- Challenge end: April 19, 2026
- Consistency prize target: 16 total sessions across the 4 weeks
- Leaderboard prize: most total sessions during the challenge
- One session per player per day counts

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open the local URL printed by Vite.

Node 20 is the smoothest match for the current dependency set, though the app also built locally here on Node 18.

If Supabase variables are not configured, the app uses `localStorage` so it still works right away on one device.

## Optional Supabase setup for a shared leaderboard

Use Supabase if you want players and sessions to sync across devices while still keeping the app simple.

1. Create a Supabase project.
2. Run the SQL in [supabase/schema.sql](/Users/matthewbailey/Documents/dribbletrack/supabase/schema.sql).
3. Copy `.env.example` to `.env`.
4. Fill in:

   ```bash
   VITE_APP_PASSCODE=highhoops
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

5. Restart the dev server.

This setup intentionally favors ease over security. The shared passcode is a casual gate, and the sample Supabase policies allow public access from the app.

## GitHub Pages deploy

The workflow in [.github/workflows/deploy.yml](/Users/matthewbailey/Documents/dribbletrack/.github/workflows/deploy.yml) deploys on pushes to `main`.

Add these GitHub repository secrets if you want the deployed site to connect to Supabase:

- `VITE_APP_PASSCODE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

If you skip the Supabase secrets, the deployed app will still load, but data will only live in that browser.
