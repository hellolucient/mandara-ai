# Decisions

## One application

Chat, documents, sales, the agent log and admin are one Next.js app. Separate services would cost more and would not make the proof of concept more reliable.

## Sign-in

On Grok hosting, the host signs people in and the app stores only a role for each person. On Cloudflare (`AUTH_MODE=local`, branch `cloudflare-hosting`), the app has its own usernames and PBKDF2 password hashes, so people such as Tenille need no Grok account. An administrator creates each sign-in and resets passwords. See docs/CLOUDFLARE.md.

## Models

OpenRouter is the only gateway. The model id is a setting. Sales figures, search and the daily report are ordinary code, so a model change cannot alter those numbers. If the key is missing, document answers show the stored excerpts and say that a model was not used.

## Search

Full-text search in Postgres is enough for the first document set. Embeddings can be added later without changing the citation shape.

## DSR

The published app signs in the way the DSR page does. Generate report stores the previous day's Maldives daily DSR and drops the sample sales once that extract is saved. A failed read is logged and is not stored as sales. The separate Playwright extractor still requires `config/dsr-map.json` with `ready: true`.

## Sample data

Sample documents and sales for 1–12 November 2026 make the three levels usable before credentials exist. The sample insurance note is restricted, so staff and managers see different answers. Sample locations other than Cinnamon Velifushi are placeholders, not a confirmed list of spas.

## Data split

A preview deployment writes only to the preview stage. The live workspace is the production stage. The scheduler always writes to production.
