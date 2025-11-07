# Strategic Scholars AI Sales Desk

Full-stack Next.js platform that orchestrates an autonomous female voice executive for the Strategic Scholars Institute. The agent syncs leads from Facebook Lead Ads and Google Ads, triggers outbound calls through Twilio, collects prospect details, schedules free demo classes, and exports every touchpoint to Excel for operations teams.

## Features

- **Unified lead intake** – Pulls fresh leads from Facebook Lead Ads & Google Ads or receives them via webhook in near real-time.
- **AI phone executive** – Twilio Programmable Voice + OpenAI generate natural Hinglish conversations that qualify parents and book demos.
- **Smart CRM workspace** – Dashboard surfaces status KPIs, latest interactions, and one-click outbound dialing.
- **Excel exports** – One tap download of the latest pipeline snapshot for offline review.
- **Task creation** – Demo confirmations automatically write a follow-up task in the CRM.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Prisma ORM (PostgreSQL)
- Twilio Programmable Voice
- OpenAI Responses API (`gpt-4o-mini`)
- Facebook Marketing API & Google Ads API connectors
- XLSX export utilities

## Setup

1. Install dependencies:

   ```bash
   cd web
   npm install
   ```

2. Configure environment variables in `web/.env`:

   - `DATABASE_URL` – PostgreSQL connection string
   - `OPENAI_API_KEY` – OpenAI Responses API key
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_CALLER_ID`
   - `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_FORM_IDS`, `FACEBOOK_VERIFY_TOKEN`
   - `GOOGLE_ADS_*` credentials (developer token, OAuth client, refresh token, customer id)

3. Generate the Prisma client and push the schema:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Run locally:

   ```bash
   npm run dev
   ```

5. Create Vercel cron or external scheduler to hit `/api/leads/sync` for background ingestion, and point Facebook/Google webhooks to the deployed URLs.

## Twilio Voice Flow

1. Outbound call is launched via `/api/calls/outbound`, creating a `CallSession` record.
2. Twilio requests `/api/twilio/voice` for TwiML each time user speech is captured.
3. The handler logs every utterance, asks OpenAI for the next reply, and returns a female Polly voice response.
4. Call disposition updates feed back into the CRM with transcripts, tasks, and statuses.

## Deployment

Deploy the `web` app to Vercel. Ensure required env vars are set in the project settings and Prisma connects to a managed Postgres instance (e.g., Vercel Postgres or Supabase). Configure the provided production domain with Twilio voice webhook URLs.

## Excel Export

`GET /api/export/excel` streams a workbook summarising all leads, perfect for offline roster management or franchise sharing.

---

Questions or improvements? Extend the Prisma schema or plug additional marketing channels using the existing webhook and sync architecture.
