# Toolchain decisions

Status: final state of branch `upgrade/ts7-model-driver`. This is a decision
record for maintainers, not a work log. The server runs on a raw-`pg` model
layer; TypeORM, its entities, and decorator emit metadata are gone.

## Final toolchain and pins

| Component | Version |
| --- | --- |
| Node runtime / images | `node:26-alpine` |
| TypeScript | `7.0.2` — exact pin in `server` and `client` |
| Express | `5.3.0` |
| pg | `8.23.1` |
| React / React DOM | `19.3.1` |
| react-router | `8.5.2` |
| Parcel | `2.16.4` |
| PostgreSQL | `postgres:18-alpine` |
| Platform | `linux/amd64` / x86-64 |

`typescript` is deliberately exact, not a caret range: the server tsconfig uses
a combination that only TS 7 accepts (see below), so a silent fallback to a 5.x
compiler must be impossible. The other runtime versions above are the versions
declared and locked in `server/package.json`, `client/package.json`, and their
lockfiles. Docker images are pinned to the tags shown.

## TypeScript configuration

The server compiles with `target: ES2022`, `module: commonjs`,
`moduleResolution: bundler`, `types: ["node"]`, `strict: true`,
`isolatedModules: true`, and `noEmitOnError: true`.

`module: commonjs` keeps the emitted server as plain `require()` code. The
Docker `node:26-alpine` images do not run that output: both server and client
images run development mode (`npm run dev`, i.e. `tsx watch` for the server).
`moduleResolution: bundler` gives the resolver the package-exports behaviour the
code was written against.

That pair is TS 7-only. On TypeScript 5.x it fails with `TS5095: Option
'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or
later.` This is exactly why `typescript` is pinned to `7.0.2` with no range on
both sides of the repo. Do not loosen the pin without re-probing the tsconfig.

## Runtime architecture: Models over a Driver

- `server/src/models/` holds `UserModel`, `ListModel`, and `ItemModel`; they own
  authorization and batched relation loading.
- Each model talks to a `Table<Row>` from `server/src/data/table.ts`, which maps
  camelCase properties to snake_case columns and validates identifiers.
- `Table` builds `SelectSpec`/`Where` objects and hands them to a `Driver`.
- `server/src/db/postgres.ts` is the only SQL compiler: it quotes identifiers,
  binds every value as `$n`, and translates pg error codes.
- `PgDriver.transaction` wraps a callback in one transaction and preserves
  application errors unchanged.
- `server/src/db/schema.ts` owns DDL and the structural `assertSchema` check.

Invariant: application SQL lives only in `server/src/db/postgres.ts` and
`server/src/db/schema.ts`. Models, routes, and scripts must go through `Table`
or the schema tooling; no controller should build a query string. This keeps
authorization testable at the model boundary and the HTTP layer free of query
construction.

## Database and Postgres 18

Compose now runs `postgres:18-alpine`. In the Postgres 18 image `PGDATA` is
`/var/lib/postgresql/18/docker`, while `/var/lib/postgresql` is the declared
mount root (`VOLUME`). The compose volume therefore mounts at
`/var/lib/postgresql`, not at the old `/var/lib/postgresql/data` path.

The dev database is recreated, not migrated. Its data is deliberately
disposable: there is no backfill, no data-transfer step, and no expectation that
an old volume keeps working across this cutover. `npm run db:sync` creates any
missing tables but does not verify structure; `npm run db:sync -- --check` runs
the structural check and proves the live schema matches.

## Cutover: migration-free by decision

The cutover is migration-free. The old TypeORM naming and the new schema do not
agree, so the old application must never run against the new database, and the
new application starts on a fresh schema. That is acceptable only because the
data is disposable.

Any environment whose data is not disposable (staging with retained data,
production, a shared demo) needs an explicit data migration before this branch
is deployed there. Do not assume `db:sync` migrates rows; it only creates
missing tables and does not verify structure. Run `npm run db:sync -- --check`
to verify it.

## Known deferred items

- `client/.parcel-cache` is still tracked in git: 7 files, about 40 MB. It
  should be removed from the index and ignored, but that is a separate cleanup.
- `JWT_SECRET` falls back to a known default, CORS is open, and tokens have no
  expiry. Acceptable for the local dev target, not for exposure.
- Both Docker images run development mode (`npm run dev`, Parcel dev server),
  not production builds.
- The client keeps `@parcel/resolver-default` with `packageExports: true`.
  Package exports are opt-in in Parcel 2.16, so this setting is what enables
  them for the client build. Removing it and rebuilding from a clean
  `.parcel-cache` fails with `Cannot load file './index' from module
  'react-router'`, which is why it is required.

## Verification

The maintained gates are `npm run typecheck`, `npm run typecheck:scripts`,
`npm run build`, `npx tsx scripts/selfcheck-table.ts`, and `npx tsx
scripts/selfcheck-models.ts` against a fresh database. The HTTP gate is `npm
run smoke` inside the compose server container. `npm run db:sync -- --check` is
the authoritative structural check; the server runs the same `assertSchema`
verification at boot.
