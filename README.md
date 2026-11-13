# Mandara AI

Private assistant for Mandara Spa Maldives. Staff can talk to an OpenRouter model, ask questions grounded in company documents, and read a daily sales report. One autonomous agent, Maldives Daily Sales, keeps that report. It is read-only toward the existing Daily Sales Reporting system (DSR).

## What works in this proof of concept

- Sign-in is the host's sign-in for a private or team deployment. The app then gives each person a role: staff, manager, or administrator.
- Conversations are private to the person who started them.
- Documents can be uploaded as PDF, Word, text, Markdown or CSV. Answers cite the document. Restricted documents are hidden from staff.
- Sales figures are calculated in the application. A missing figure stays missing, and a budget is used only when one was stored.
- The sales agent can be run by a manager, or by a scheduler. Every run is logged. A failed collection does not invent numbers.
- Sample documents and sample sales for 1–12 November 2026 are loaded so the workspace can be tried before real files and DSR are connected. They are labeled sample.

The live DSR site is not connected. Its pages have not been inspected, and this repo does not guess them. A local sandbox proves the browser extractor. See [DSR](#dsr).

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://127.0.0.1:4327. On this machine the viewer is an invented administrator named Dev Viewer. That is not a real sign-in.

If a shell already has `DATABASE_URL` set for some other database, start the app with `env -u DATABASE_URL npm run dev`. Local runs then use an in-memory database. The published app uses its own Postgres, which is created at publish time.

## Architecture

One Next.js application. Postgres when `DATABASE_URL` is set, and PGlite otherwise. OpenRouter is the only model gateway, called from the server. Document search is Postgres full-text search, so retrieval does not need an embedding API. Sales maths, the daily report and the agent log do not call a model.

| Piece | Where it lives |
| --- | --- |
| Chat, knowledge, sales, agents, admin | This web app |
| Model calls | `OPENROUTER_API_KEY`, server only |
| Document and sales records | Postgres |
| DSR collection | `scripts/dsr-extract.ts` on a machine that can run a browser |
| Daily schedule | `POST /api/cron/sales` with `CRON_SECRET` |

Preview deployments keep a separate copy of the records from the live workspace.

## Cost

Fixed infrastructure for this proof of concept is the published app and its Postgres. There is no separate server, vector database or GPU.

Model spend happens only when someone uses open conversation, or when a document answer is rewritten by the model. Sales answers and the daily report do not call a model. A small team on a flash-class model is typically a few dollars a month. The admin page shows the cost the gateway reports. Prices change, and an estimate is labeled when the gateway does not report one.

The default model id is `openrouter/auto`. Each question is routed on the middle tier, and the reply records the model that actually answered. An administrator can set a specific model id without a code change. A request for a picture or concept drawing is sent to an image model and shown in the chat.

## DSR

Check DSR sign-in submits the saved username and password the way the DSR page does, and records whether the account was accepted. Generate report signs in and stores the previous day's Maldives daily DSR: total revenue, that day's forecast, and treatment guests for each spa. It does not change anything in DSR.

The separate extractor is also read-only. It signs in, reads one table, and prints JSON. It does not click anything that would edit DSR.

The extractor refuses to run until:

1. `DSR_BASE_URL`, `DSR_USERNAME` and `DSR_PASSWORD` are set in the environment, not in the repo.
2. `config/dsr-map.json` has `ready: true` and selectors that were confirmed on the real site.

Until that inspection happens, the map stays `ready: false`. The sandbox is a stand-in, not DSR:

```bash
npm run dsr:sandbox
DSR_BASE_URL=http://127.0.0.1:8765 DSR_USERNAME=sandbox DSR_PASSWORD=sandbox \
  DSR_MAP=config/dsr-map.sandbox.json npm run dsr:extract
```

The username and password above are for the local sandbox only. Any non-empty pair is accepted there. They are not DSR credentials.

A scheduler can post the printed JSON to `/api/cron/sales` with `Authorization: Bearer <CRON_SECRET>`. An empty body rebuilds the report from records already stored. A body of `{ "ok": false, "error": "..." }` is stored as a failed run and does not overwrite sales.

Managers can also import a CSV with the columns `business_date,location,net_sales,treatments,budget`.

## Roles

| | Staff | Manager | Administrator |
| --- | --- | --- | --- |
| Own conversations | yes | yes | yes |
| Company documents | yes | yes | yes |
| Restricted documents | no | yes | yes |
| Sales figures | yes | yes | yes |
| Import sales, run the agent | no | yes | yes |
| People, model, company name | no | no | yes |

The first person to open a workspace becomes the administrator.

## Publish

Publish as **private**, or **team** if that choice is offered, so only invited people can open it. A public address does not receive a person identity, and the app will stay on the signed-out screen.

## Still needed from Mandara

- An OpenRouter key, stored as a secret named `OPENROUTER_API_KEY`.
- A schedule secret, `CRON_SECRET`, if the daily run should fire without someone pressing the button.
- The real DSR address and a read-only login: `DSR_BASE_URL`, `DSR_USERNAME`, `DSR_PASSWORD`. After those exist, the live pages still have to be inspected once so `config/dsr-map.json` can be filled from the real screens.
- The company documents that should replace the samples. Upload them in Knowledge.
- The names of the people who should be managers. They can be set by email in Admin before those people sign in.

Do not paste passwords or API keys into the chat.
