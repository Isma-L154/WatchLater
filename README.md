# 🎬 WatchLater

A fast, lightweight web app to search movies & TV shows (via [TMDB](https://www.themoviedb.org/)) and save them to a personal **watch-later** list. Built to be mobile-first, edge-deployable, and free to host.

**▶️ Live demo: [watchlater.moviesils.workers.dev](https://watchlater.moviesils.workers.dev)**

---

## ✨ Features

- 🔐 **Sign in with Google** — each watchlist is private and tied to its owner's account.
- 🔍 **Live search** of movies and TV shows (debounced, powered by TMDB multi-search).
- 🔥 **Trending this week** on the home screen (server-rendered, instant).
- 🗂️ **Watchlist management** — add, remove, and mark titles as watched.
- 📺 **Season progress for TV** — track multi-season shows season by season; finishing the last one marks the show as watched automatically ([design notes](docs/season-progress.md)).
- ⏳ **Unreleased titles are called out** — TMDB indexes films long before they open, so anything not out yet carries an amber countdown badge and an "Upcoming" filter.
- 🎛️ **Tabs, filters & sorting** — All / To Watch / Watching / Upcoming / Watched, Movie / TV filter, and sort options.
- 🎞️ **Detail view** — a modal with backdrop, embedded YouTube trailer, genres, synopsis, and cast.
- 🔔 **Toasts, skeletons, and smooth animations** for a polished feel.
- 🔒 **Secure by design** — the TMDB token and OAuth secret never reach the browser; all TMDB calls are proxied server-side.

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

| Variable               | Description                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TMDB_ACCESS_TOKEN`    | TMDB **v4 "API Read Access Token"** (Bearer). Get it at [TMDB → Settings → API](https://www.themoviedb.org/settings/api). |
| `DATABASE_URL`         | `file:local.db` for local dev, or your `libsql://…turso.io` URL in production.                                            |
| `DATABASE_AUTH_TOKEN`  | Turso auth token (leave empty for the local file DB).                                                                     |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 client ID (see [Google sign-in setup](#-google-sign-in-setup)).                                                 |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret.                                                                                                  |
| `OAUTH_ORIGIN`         | _Optional._ Public origin used to build the OAuth redirect URI. Leave unset to derive it from the request.                |

> ⚠️ `.env` is git-ignored and must **never** be committed. Only `.env.example` (without values) is tracked.

### 🔑 Google sign-in setup

1. Open the [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add one entry per environment you use:
   - `http://localhost:5173/auth/google/callback`
   - `https://<your-domain>/auth/google/callback`
4. Copy the client ID and secret into `.env`.

Only the `openid`, `profile` and `email` scopes are requested, and no Google tokens
are stored — the access token is used once, during the callback, and discarded.

> **Migrating an existing list.** The auth migration parks watchlist rows saved
> before sign-in existed under a placeholder account, and the **first** person to
> sign in inherits them. If your instance is public, sign in yourself before
> sharing the link, or those rows will end up on someone else's account.

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
├─ hooks.server.ts       # Session resolution + baseline security headers
├─ lib/
│  ├─ components/
│  │  ├─ auth/           # GoogleButton, AccountChip
│  │  ├─ media/          # Anything that renders a title: cards, modal, stepper
│  │  └─ ui/             # App chrome and generic primitives
│  ├─ domain/            # Pure business rules — no DOM, no DB, unit-tested
│  │  ├─ progress.ts     # Season tracking: state, clamping, watched invariant
│  │  ├─ release.ts      # Release-date reasoning (released / upcoming / TBA)
│  │  └─ watchlist.ts    # List filtering, sorting and status counts
│  ├─ server/            # Never reaches the browser (SvelteKit enforces this)
│  │  ├─ db/             # Drizzle client + schema
│  │  ├─ auth.ts         # Session create/validate/revoke + cookie helpers
│  │  ├─ oauth.ts        # Google OAuth client — client secret stays here
│  │  └─ tmdb.ts         # TMDB proxy (search, trending, details) — token stays here
│  ├─ stores/            # Svelte 5 rune stores (search, toasts)
│  ├─ tmdb-image.ts      # Client-safe image URL helpers
│  └─ types.ts           # Shared, client-safe types
└─ routes/
   ├─ +layout.server.ts  # Exposes the signed-in user to every page
   ├─ +page.svelte       # Home — composition only; behaviour lives in $lib
   ├─ +page.server.ts    # Loads the list; add/remove/toggle/setSeasons actions
   ├─ auth/              # /auth/google, /auth/google/callback, /auth/logout
   └─ api/               # /api/search, /api/details/[type]/[id]
```

Three rules keep this navigable as it grows:

1. **Decision logic lives in `$lib/domain` as pure functions**, next to its own
   unit tests. That is why the suite needs no DOM and no database.
2. **Components render; they don't decide.** Each owns one piece of the page.
3. **Routes only wire the two together** — `+page.svelte` is composition.

Everything in the repository root is a tool's mandated config location
(`vite.config.ts`, `wrangler.jsonc`, `eslint.config.js`, …). They cannot be
tidied into a folder without passing `--config` to every command, which trades
one kind of noise for a worse one.

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
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Remember to add the production callback URL
(`https://<your-domain>/auth/google/callback`) to the Google OAuth client.

## 🔐 Security

- The TMDB token and the Google client secret live only in server-side modules (`$lib/server/*`) — they are never exposed to the client bundle.
- Secrets are provided through environment variables (`.env` locally, Wrangler secrets in production) and never hard-coded.
- Sign-in uses OAuth 2.0 with **PKCE** plus a `state` parameter, both carried in short-lived `httpOnly` cookies.
- The session cookie holds a 256-bit random token; the database stores only its **SHA-256 hash**, so a database dump cannot be replayed as a valid session.
- Every watchlist read _and_ write is scoped by the session's user id — item ids travel through the browser, so knowing someone else's id is not enough to touch their list.
- Season targets and totals are resolved server-side; the client can only say how far it got, never redefine the bounds it is measured against.
- All form input is length- and range-checked before it reaches the database, and each account has a ceiling on how many titles it can store.
- Responses carry `frame-ancestors 'none'`, `nosniff` and a strict referrer policy. Anything user-specific is `private, no-store`; only the public TMDB proxies opt in to edge caching — which also caps how fast the shared API quota can be burned.

## 📄 License

Private project — all rights reserved (for now).
