# Strategic Scholars AI Sales Desk (Web)

Production-ready Next.js workspace powering the automated voice executive for Strategic Scholars Institute. The dashboard monitors lead intake, triggers Twilio voice calls, and exports CRM snapshots for the operations team.

## Quickstart

```bash
npm install
npx prisma generate
npm run dev
```

Visit http://localhost:3000 to access the command centre.

## Required Environment Variables

Set these in `.env` before running the app or deploying to Vercel:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_CALLER_ID`
- `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_FORM_IDS`, `FACEBOOK_VERIFY_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`

## Deploy to Vercel

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-deed4ef1
```

After deployment, point Twilio Programmable Voice to `/api/twilio/voice` (voice webhook) and `/api/twilio/status` (status callback), and schedule `/api/leads/sync` via Vercel Cron or any scheduler to keep ads leads fresh.
