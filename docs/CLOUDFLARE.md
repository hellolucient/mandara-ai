# Mandara AI on Cloudflare

Branch `cloudflare-hosting`. Nothing here is live until Trent says yes.

## Design

| Piece | Choice | Why |
| --- | --- | --- |
| App | Next.js 15 on **Cloudflare Workers** through **OpenNext** (`@opennextjs/cloudflare`) | Runs the existing app as is (server components, API routes, middleware). Pages is the older path for Next.js. |
| Database | **Postgres on Neon** (free plan) reached through **Cloudflare Hyperdrive** | Same Postgres and SQL as today, so no query rewrite. Hyperdrive pools connections near the Worker. D1 (SQLite) would mean rewriting full-text search, `jsonb`, `interval`, `to_char` and every migration. |
| Sign-in | Mandara's own usernames and passwords (`AUTH_MODE=local`) | No Grok account needed. PBKDF2-SHA256 (100,000 iterations, the Workers maximum) with a per-password salt. Sessions are 32 random bytes in an `__Host-` cookie (HttpOnly, Secure, SameSite=Lax, 30 days); only the SHA-256 of the token is stored. Eight wrong passwords lock the account for 15 minutes. |
| Secrets | `wrangler secret put` | Never in the repo or the config file. |
| Schedules | The box keeps pushing the daily DSR to `POST /api/cron/sales` with the schedule secret | The DSR pull needs a browser sign-in to Steiners, which a Worker cannot do. A Cloudflare Cron Trigger can be added later if a job moves fully into the app. |
| Files | Chat photos and document text are stored in Postgres, as today | Nothing needs R2 yet. |

The code still runs on Grok hosting when `AUTH_MODE` is not `local`, so main keeps working while the move is prepared.

## Access levels

Stored role names stay as they were, shown with new labels:

- **Admin** (`admin`): everything, including Prospects and Admin.
- **Management** (`manager`): contracts, restricted documents, sales and resort data. No Prospects, no Admin.
- **Spa** (`staff`): no contracts (they are left out of the chat's company profile too) and no restricted documents. `members.spa_location_id` is reserved for "only their own spa".
- **Chat only** (a switch on any non-admin person): only `/chat` and `/account`, and only the chat, conversation, memory and sign-in APIs. Everything else redirects to `/chat` or returns 403.

The chat uses the same rules: restricted documents and contracts depend on the role, and prospects never reach the chat.

## Costs (per month)

- Workers **Paid**: US$5. Recommended over Free because Free allows 10 ms of CPU per request, which page rendering and password hashing exceed, and only 50 subrequests per request. Paid includes 10 million requests and 30 million CPU-ms.
- Hyperdrive: included (unlimited queries on Paid, 100,000 a day on Free).
- Neon Free: US$0 (1 GB storage per project, 100 CU-hours a month, which is about 400 hours at the smallest size, and it scales to zero after 5 idle minutes). Neon Launch is pay-as-you-go ($0.106 per CU-hour, $0.35 per GB-month), probably under US$10 at our size, and only needed if Free is outgrown. Watch storage: chat photos are kept in the database.
- Custom domain on the existing Cloudflare zone: US$0.
- OpenRouter: unchanged.

## Go-live runbook

Every step needs Trent's yes first.

1. **Neon**: create project `mandara-ai` in Singapore (`aws-ap-southeast-1`, the closest to the Maldives and Bangkok). Copy the pooled and the direct connection strings into the box secrets file, never into chat.
2. **Schema**: `DATABASE_URL=<direct> npm run db:migrate`.
3. **Data**: see "Data migration" below.
4. **Hyperdrive**: `npx wrangler hyperdrive create mandara-db --connection-string="<direct>"`, then put the printed id in `wrangler.jsonc`.
5. **Secrets**: `npx wrangler secret put OPENROUTER_API_KEY`, `CRON_SECRET`, and `DSR_BASE_URL`, `DSR_USERNAME` and `DSR_PASSWORD` if the in-app DSR read is wanted.
6. **First admin**: `DATABASE_URL=<direct> npm run user:create -- --username trent --name "Trent Munday" --role admin --sub <Trent's Grok member id>`. The `--sub` keeps his chats and memories. The temporary password goes to a mode-600 file.
7. **Deploy**: `npm run cf:deploy`. Check it on the `*.workers.dev` address.
8. **Domain**: uncomment the `routes` custom domain in `wrangler.jsonc` (`ai.mandaraspamaldives.com`) and deploy again. Cloudflare creates the DNS record and certificate.
9. **Box jobs**: point the daily DSR push at the new address with the new `CRON_SECRET`.
10. **Switch over**: Trent signs in and checks Home against the DSR. Tenille gets a Management, chat-only sign-in. The Grok app stays up, read-only, for a week.

## Data migration

The preferred path is a full copy with nothing re-keyed:

1. `GET /api/admin/export` is admin-only and returns every table for the live workspace as JSON. Postgres serialises the rows, so dates and amounts stay exact. Sign-in tables are never exported. It is a separate commit that can go to main and be published to the Grok app.
2. Trent opens `https://mandara-5770.apps.grok.bot/api/admin/export` while signed in and saves the file to the box.
3. Load it with `DATABASE_URL=<direct> npm run db:import -- <file>`. Only matching columns are written and existing rows are kept, so the import can be run again safely.
4. Check that Home matches the DSR (month to date and latest day), and check the prospect count, conversation count and settings.

The fallback, if the export cannot be published, is to rebuild from box sources through the app's own import screens. Use the DSR JSONs in `/workspace/mandara/dsr-nov-2026/extracts-v2` and `/workspace/mandara/dsr-daily/import`, and Cleo's reconciled prospects JSON. Chat history, memories, uploaded documents and Admin edits would then not carry over.

## Local proof

`npm run cf:preview` runs the real Workers runtime (workerd) on `http://localhost:8787`. `wrangler.jsonc` points it at a local Postgres on port 55432.
