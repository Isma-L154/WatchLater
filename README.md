# 🎬 WatchLater

A fast, lightweight web app to search movies & TV shows (via [TMDB](https://www.themoviedb.org/)) and save them to a personal **watch-later** list. Built to be mobile-first, edge-deployable, and free to host.

**▶️ Live demo: [watchlater.moviesils.workers.dev](https://watchlater.moviesils.workers.dev)**

---

## ✨ Features

- 🔍 **Live search** of movies and TV shows (debounced, powered by TMDB multi-search).
- 🔥 **Trending this week** on the home screen (server-rendered, instant).
- 🗂️ **Watchlist management** — add, remove, and mark titles as watched.
- 🎛️ **Tabs, filters & sorting** — All / To Watch / Watched, Movie / TV filter, and sort options.
- 🎞️ **Detail view** — a modal with backdrop, embedded YouTube trailer, genres, synopsis, and cast.
- 🔔 **Toasts, skeletons, and smooth animations** for a polished feel.
- 🔒 **Secure by design** — the TMDB token never reaches the browser; all TMDB calls are proxied server-side.

## 🧱 Tech Stack

| Layer      | Choice                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| Framework  | [SvelteKit](https://svelte.dev/) (Svelte 5) + TypeScript                                    |
| Styling    | [Tailwind CSS v4](https://tailwindcss.com/)                                                 |
| Database   | [Turso](https://turso.tech/) (libSQL / SQLite) via [Drizzle ORM](https://orm.drizzle.team/) |
| Backend    | SvelteKit server routes (TMDB proxy + form actions)                                         |
| Hosting    | [Cloudflare](https://developers.cloudflare.com/workers/) (`@sveltejs/adapter-cloudflare`)   |
| Build tool | [Vite](https://vite.dev/)                                                                   |

## 📦 Prerequisites

- **Node.js** ≥ 22 (LTS recommended)
- A free **TMDB** account for the API token
- (For deployment) free **Turso** and **Cloudflare** accounts

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env and fill in your values (see the table below)

# 3. Create the local database schema
npm run db:migrate

# 4. Start the dev server (with hot module replacement)
npm run dev
```

The app runs at **http://localhost:5173**.

### Environment variables

| Variable              | Description                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TMDB_ACCESS_TOKEN`   | TMDB **v4 "API Read Access Token"** (Bearer). Get it at [TMDB → Settings → API](https://www.themoviedb.org/settings/api). |
| `DATABASE_URL`        | `file:local.db` for local dev, or your `libsql://…turso.io` URL in production.                                            |
| `DATABASE_AUTH_TOKEN` | Turso auth token (leave empty for the local file DB).                                                                     |

> ⚠️ `.env` is git-ignored and must **never** be committed. Only `.env.example` (without values) is tracked.

## 🛠️ Scripts

| Script                | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start the Vite dev server (HMR).                  |
| `npm run build`       | Production build (Cloudflare adapter).            |
| `npm run preview`     | Preview the production build locally.             |
| `npm run check`       | Type-check the project (svelte-check).            |
| `npm run lint`        | Prettier + ESLint checks.                         |
| `npm run format`      | Auto-format with Prettier.                        |
| `npm run test:unit`   | Run Vitest unit tests.                            |
| `npm run test:e2e`    | Run Playwright end-to-end tests.                  |
| `npm test`            | Run unit tests once, then e2e.                    |
| `npm run db:generate` | Generate a new Drizzle migration from the schema. |
| `npm run db:migrate`  | Apply pending migrations to the database.         |
| `npm run db:studio`   | Open Drizzle Studio to inspect the DB.            |

## 🧪 Testing & CI

- **Unit tests (Vitest):** cover the pure logic — image URL helpers and the watchlist filtering/sorting/search (`src/lib/*.spec.ts`). Run with `npm run test:unit`.
- **E2E (Playwright):** smoke tests that drive the running app (`e2e/*.e2e.ts`). They run against the dev server and therefore need a local `.env`, so they are a manual/local step (not part of CI). Run with `npm run test:e2e`.
- **CI (GitHub Actions):** `.github/workflows/ci.yml` runs Prettier, ESLint, `svelte-check` and the unit tests on every push and pull request to `main` / `dev`.

## 🗂️ Project Structure

```
src/
├─ lib/
│  ├─ components/        # Reusable UI (MediaCard, MediaDetailModal, Toaster, …)
│  ├─ server/
│  │  ├─ db/             # Drizzle client + schema (server-only)
│  │  └─ tmdb.ts         # TMDB proxy (search, trending, details) — token stays here
│  ├─ stores/            # Svelte 5 rune stores (toasts)
│  ├─ tmdb-image.ts      # Client-safe image URL helpers
│  └─ types.ts           # Shared, client-safe types
└─ routes/
   ├─ +page.svelte       # Home: search, trending, watchlist
   ├─ +page.server.ts    # Load watchlist + trending; add/remove/toggle actions
   └─ api/               # /api/search, /api/details/[type]/[id]
```

## ☁️ Deployment

### 1. Provision the database (Turso)

```bash
# Install the Turso CLI, then:
turso auth login
turso db create watchlater
turso db show watchlater --url            # -> DATABASE_URL
turso db tokens create watchlater         # -> DATABASE_AUTH_TOKEN
```

Apply the schema to the remote DB (with the Turso URL/token in your environment):

```bash
npm run db:migrate
```

### 2. Deploy to Cloudflare

```bash
npm run build
npx wrangler deploy
```

Then set the production secrets (they are **not** read from `.env` in production):

```bash
npx wrangler secret put TMDB_ACCESS_TOKEN
npx wrangler secret put DATABASE_URL
npx wrangler secret put DATABASE_AUTH_TOKEN
```

## 🔐 Security

- The TMDB token lives only in server-side modules (`$lib/server/*`) and is sent to TMDB via a `Bearer` header — it is never exposed to the client bundle.
- Secrets are provided through environment variables (`.env` locally, Wrangler secrets in production) and never hard-coded.

## 📄 License

Private project — all rights reserved (for now).
