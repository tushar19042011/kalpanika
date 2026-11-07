# New-product newsletter setup

The homepage signup is double opt-in. Only verified subscribers receive automatic announcements for newly created, active products. Product edits and reactivations do not create new announcement events.

## Required environment

Configure these values in local development and in the production deployment environment:

- `RESEND_API_KEY`: server-side Resend API key.
- `NEWSLETTER_FROM_EMAIL`: sender address verified for the Resend account.
- `NEWSLETTER_FROM_NAME`: optional display name (defaults to `Kalpanika`).
- `NEWSLETTER_TOKEN_SECRET`: stable cryptographically random secret with at least 32 characters. Keep it unchanged to preserve unsubscribe links.
- `NEXT_PUBLIC_APP_URL`: canonical site origin. Use the deployed HTTPS origin in production.
- `CRON_SECRET`: stable random secret with at least 32 characters for the scheduled worker.
- `NEWSLETTER_ENABLE_REAL_DELIVERY=true`: required to send real email in production. Leave disabled until the sender/domain and templates are verified.

Generate a secret locally with Node.js using `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; use a different value for each secret and environment.

In non-production environments, all email is redirected to `NEWSLETTER_TEST_RECIPIENT`. Set it to a controlled test inbox. Without that setting, delivery is blocked. Do not configure production subscriber data in a development database or real recipient addresses as test inboxes.

## Scheduled worker

`vercel.json` schedules `/api/cron/newsletter` once per minute. Configure `CRON_SECRET` in Vercel so scheduled requests include `Authorization: Bearer <CRON_SECRET>`. The worker writes durable announcement and per-recipient delivery records to MongoDB, sends a small batch per run, retries transient failures with backoff, and uses Resend idempotency keys to avoid duplicate accepted emails on retries.

For non-Vercel hosting, configure an equivalent authenticated scheduler to call `GET /api/cron/newsletter` at least once per minute with the bearer secret. Do not run this endpoint publicly without the secret.

MongoDB indexes for subscribers, announcements, deliveries, and public form rate limits are created by the existing `getDatabase()` initialization. Existing newsletter records created before double opt-in have no verified timestamp and are intentionally excluded from delivery; those users must submit their email again and confirm ownership.

The email sender must be verified in Resend before the provider will accept messages. Provider acceptance is recorded as a successful send; it does not assert inbox delivery.
