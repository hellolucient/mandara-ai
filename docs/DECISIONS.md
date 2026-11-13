# Decisions

## One application

Chat, documents, sales, the agent log and admin are one Next.js app. Separate services would cost more and would not make the proof of concept more reliable.

## Sign-in

The published app is meant to be private or team. The host already signs people in. The app stores a role for each person and does not keep its own passwords. A public address would not identify staff, so it is not a usable mode.

## Models

OpenRouter is the only gateway. The model id is a setting. Sales figures, search and the daily report are ordinary code, so a model change cannot alter those numbers. If the key is missing, document answers show the stored excerpts and say that a model was not used.

## Search

Full-text search in Postgres is enough for the first document set. Embeddings can be added later without changing the citation shape.

## DSR

The web app never launches a browser and never invents selectors. Collection is a read-only Playwright script with an explicit page map. The map ships with `ready: false`. A local sandbox proves the script. Failed extracts are logged and are not stored as sales.

## Sample data

Sample documents and sales for 1–12 November 2026 make the three levels usable before credentials exist. The sample insurance note is restricted, so staff and managers see different answers. Sample locations other than Cinnamon Velifushi are placeholders, not a confirmed list of spas.

## Data split

A preview deployment writes only to the preview stage. The live workspace is the production stage. The scheduler always writes to production.
