# ChristmasLS

ChristmasLS is a full-stack Christmas wishlist app. Users keep their own gift
lists, share them with other people, and mark items as purchased when they buy
something for someone else.

## Features

- Register and log in with a username and password (JWT bearer tokens).
- Create, rename, and delete your own Christmas lists.
- Add items to a list with a name, description, and price.
- Share a list with a specific user, or with everyone.
- See lists shared with you and tick items off as purchased.
- Browse the design-system showcase at `/dev/ui`.

List owners cannot mark items on their own lists as purchased — only people the
list has been shared with can.

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime | Node.js 26 (`node:26-alpine` in Docker) |
| Language | TypeScript 7.0.2 (exact pin in both packages) |
| API | Express 5.3.0 |
| Database | PostgreSQL 18, raw `pg` 8.23.1 |
| Client | React 19.3.1, react-router 8.5.2 |
| Bundler | Parcel 2.16.4 |
| Package manager | npm |

## Architecture

`client/` is a React single-page app built by Parcel; it proxies `/api` requests
to `server/`, an Express API that talks to PostgreSQL through a small
model/driver layer (`server/src/models`, `server/src/data/table.ts`). All
application SQL lives in `server/src/db/postgres.ts` and the schema DDL in
`server/src/db/schema.ts`; models own authorization. See
[`docs/toolchain-decisions.md`](docs/toolchain-decisions.md) for the reasoning.

## Prerequisites

- Node.js 26 and npm. There is no `engines` field, so the version comes from the
  Docker images and convention.
- PostgreSQL 18, either installed locally or run via Docker.
- Docker and Docker Compose if you want the integrated stack.

## Getting started

### Option A: Docker Compose (recommended)

```bash
docker compose up --build
```

This starts PostgreSQL 18, the API, and the client:

| Service | URL |
| --- | --- |
| Client | http://localhost:3000 |
| API | http://localhost:3001 |
| PostgreSQL | `localhost:5432` |

The server container runs `npm run db:sync` before starting, so a fresh database
is created automatically.

### Option B: local processes

1. Install dependencies:

   ```bash
   npm run install-all
   ```

2. Create your environment file and export it. The server does **not** read
   `.env` files itself, so the variables must be present in the shell:

   ```bash
   cp .env.example .env
   set -a; source .env; set +a
   ```

3. Start PostgreSQL 18. With Docker, `docker compose up -d postgres` provides
   the `christmasdb` database and the credentials used in `.env.example`.

4. Create the schema, then start the servers:

   ```bash
   cd server && npm run db:sync && cd ..
   npm run dev
   ```

   `npm run dev` starts the API on port 3001 and the Parcel dev server on port
   3000. It uses `&`, so it needs a POSIX shell. You can also run
   `npm run dev-server` and `npm run dev-client` in separate terminals.

5. Open http://localhost:3000.

When running the client outside Compose, fix the API proxy first — see
[Gotchas](#gotchas).

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/christmasdb` |
| `JWT_SECRET` | Signing secret for auth tokens | `secret` (dev only) |
| `PORT` | API port | `3001` |
| `BASE_URL` | Target for the smoke script | `http://localhost:3001` |

## Scripts

Root (`package.json`):

| Script | Description |
| --- | --- |
| `npm run install-all` | Install server and client dependencies |
| `npm run dev` | Run API and client dev servers together |
| `npm run dev-server` / `npm run dev-client` | Run one side only |
| `npm run build-server` / `npm run build-client` | Type-check and build |
| `npm run preview-client` | Preview the built client |

Server (`server/package.json`):

| Script | Description |
| --- | --- |
| `npm run dev` | `tsx watch` on `src/index.ts` |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` / `npm run typecheck:scripts` | Type-check sources / scripts |
| `npm run db:sync` | Create missing tables (`-- --check` verifies structure) |
| `npm run add-user -- <user> <password>` | Create a user without the API |
| `npm run smoke` | Black-box HTTP checks against a running server |

Client (`client/package.json`):

| Script | Description |
| --- | --- |
| `npm run dev` | Parcel dev server on port 3000 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright tests (mocked API, own server on port 3111) |

## Verification

```bash
cd server
npx tsx scripts/selfcheck-table.ts          # no database needed
npx tsx scripts/selfcheck-models.ts         # needs DATABASE_URL
npm run smoke                               # needs a running server
npm run db:sync -- --check                  # structural schema check

cd ../client
npm run typecheck && npm run build
npm run test:e2e
```

There is no linter configured and no unit-test runner on the server.

## Project layout

```
client/            React SPA (Parcel)
  src/             pages, components, styles, API calls
  e2e/             Playwright specs with mocked API
server/            Express API
  src/index.ts     app setup and all routes
  src/models/      UserModel, ListModel, ItemModel
  src/db/          pg driver, schema DDL, tooling
  scripts/         selfchecks and smoke test
docs/              maintainer decision record
docker-compose.yml postgres + server + client
```

## Gotchas

- **Client proxy hostname.** `client/.proxyrc.json` targets `http://server:3001`,
  which only resolves inside Compose. For local development, change the target
  to `http://localhost:3001`, or add a hosts entry mapping `server` to
  `127.0.0.1`.
- **Schema must match at boot.** The server verifies the schema before listening
  and exits if it differs. Run `npm run db:sync` against a fresh database first.
- **No migrations or seeding.** `db:sync` only creates missing tables; it does
  not alter existing columns or move data. The dev database is meant to be
  disposable.
- **No registration UI.** `/api/register` exists, but the client only has a
  login page. Create accounts with `npm run add-user` or the API.
- **Dev-only security defaults.** The JWT secret falls back to a known value,
  CORS is open, and tokens do not expire. Do not expose this setup as-is.
- **Docker images run dev mode**, not production builds.
- **Parcel package exports.** Keep `@parcel/resolver-default` with
  `packageExports: true` in `client/package.json`; removing it breaks the client
  build with `Cannot load file './index' from module 'react-router'`.

## Documentation

[`docs/toolchain-decisions.md`](docs/toolchain-decisions.md) covers the
toolchain pins, the model/driver layer, and the migration-free cutover.
