# Toolchain decisions (TS 7.0.2 emit probe)

Status: WP0 + WP1 complete on branch `upgrade/ts7-model-driver` (base `4a199ed`). Nothing committed.

## Baseline observed

| Item | Value |
| --- | --- |
| node | v26.13.1 |
| npm | 12.2.3 |
| tsc (probe project) | Version 7.0.2 |
| docker / compose | 29.10.0 / 5.8.0, host `x86_64` |
| postgres (compose) | still pinned to `postgres:15` → server_version `15.20` |
| scratch DB | `christmasdb_upgrade` on `localhost:5432`, user `user` |
| probe dir | `/tmp/opencode/ts7-probe` (throwaway) |

## Chosen config: A (`module: commonjs` + `moduleResolution: bundler`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "bundler",
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmitOnError": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

## Gate matrix (exit codes)

| # | Gate | A: commonjs+bundler | B: nodenext+nodenext |
| --- | --- | --- | --- |
| 1 | `npx tsc --version` | 0 · `Version 7.0.2` | 0 |
| 2 | `npx tsc -p tsconfig.{a,b}.json` | 0 · flat `dist/` (probe.js, errors.js, db/types.js) | 0 · same |
| 3 | emit is CJS | 7× `require(`, 0 ESM `import`/`export` | same shape |
| 4 | `node dist/probe.js` | 0 · `probe ok` | 0 · `probe ok` |
| 5 | `npx tsx src/probe.ts` | 0 · `probe ok` | (not needed) |
| 6 | `noEmitOnError` (bad `const bad: number = 'x'`) | 1 · TS2322 · dist sha + mtime unchanged ✅ | — |
| 7 | top-level await | 1 · TS1378 (not allowed) ✅ | 1 · TS1309 ✅ |
| 8 | `--noEmit` clean | 0 | 0 |
| 9 | `types: []` expecting TS2591 | **0 — see deviation 1** | 0 (same cause) |
| 10 | `return res.json(...)` expecting TS2322 | **0 — see deviation 2** | 0 (same) |

Cross-check on the old compiler: `typescript@5.9.3` with config **A** exits **2** with `error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.` TS 5.9.3 accepts config B (exit 0). So A is a TS 7-only config: `typescript` must be pinned to exactly `7.0.2` in `server/package.json`, or CI/dev boxes silently fall back to `TS5095`.

## Real surface exercised by the probe

- `AppError extends Error` + subclass: emit is a native `class ... extends Error` with `status;` field declaration, no `_super`/`setPrototypeOf` hack; `instanceof`, `name`, `status`, `stack` all verified at runtime.
- Closed `Scalar | Cond | Where | SelectSpec | Row | Store | Driver | DriverErrorCode | DriverError` declarations compile and are implementable (in-memory `Driver` with `transaction<T>` callback).
- Interop: `import express from 'express'`, `import { Pool } from 'pg'`, default imports of `bcryptjs`/`jsonwebtoken`/`cors` all emit `__importDefault(require(...))`; `pool.query('select 1')` ran against the scratch DB.
- `express.RequestHandler` with `req.body ?? {}` typechecks; Express 5 error middleware takes `unknown`.

## `server/tsconfig.json` to use in the next work package (verbatim)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "bundler",
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmitOnError": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`experimentalDecorators` + `emitDecoratorMetadata` are TEMPORARY: required only by the existing TypeORM entities, and must be dropped when the raw-`pg` model driver replaces TypeORM.

## Deviations and surprises

1. **`types: ["node"]` is not load-bearing in this project.** With `types: []` the probe still exits 0 because `@types/express`/`@types/pg` import `@types/node` transitively (confirmed via `--listFiles`). The option is genuinely honoured (`types: ["definitely-not-a-types-pkg"]` → TS2688), and in a project that does not import express, `types: []` does fail with `TS2591: Cannot find name 'process'`. Keep `"types": ["node"]` for standalone scripts, but do not expect it to gate anything once express types are in the program. TS 5.9.3 behaves identically.
2. **`return res.json(...)` typechecks.** TS allows returning a value from a function contextually typed as `void`, so the plan's expected TS2322 never appears — `RequestHandler` returns `void`, and this rule predates TS 7 (verified: TS 5.9.3 also exits 0). Enforcing `res.json(...); return;` needs a lint rule (`no-confusing-void-expression`), not the type system.
3. Compose still runs `postgres:15` (server_version 15.20), not the target `postgres:18-alpine`; compose was deliberately left untouched. Both target image tags exist with `linux/amd64`.
4. Base image tags verified via `docker manifest inspect`: `node:26-alpine` and `postgres:18-alpine` both resolve for amd64.
5. `target: ES2022` flips `useDefineForClassFields` to `true` (the old config used ES2020, i.e. `false`). Class fields now emit as `status;` own-property defines. Verified harmless for the `Error` subclasses; if a remaining TypeORM entity misbehaves before removal, set `"useDefineForClassFields": false` rather than lowering the target.

## WP2 transitional state — do not deploy

WP2 introduces the raw-`pg` `Store`/`Driver` contract and `db:sync`, but it is not
yet a deployable state. The following are intentional, time-boxed risks:

- **Entities still use TypeORM's default table names** (`user`, `christmas_list`,
  `item`, `list_share`) until WP5 rewrites them against the new driver. Until
  then, the TypeORM app and the new schema do not agree.
- **The old app must never run against `christmasdb_upgrade`.** Its TypeORM
  naming and the WP2 schema would diverge and could silently write to the wrong
  tables.
- **The dev database is reset rather than migrated.** This is approved; the data
  is disposable. There is no migration path from the old TypeORM schema.
- **`db:sync` is wired into the start path in WP8**, not before. Until then it is
  a manual command (`npm run db:sync`).
- **`assertSchema` becomes the boot-time guard in WP5** and is the authoritative
  structural check from then on. `db:sync --check` already uses it, and it
  verifies columns, primary keys, the `list_shares` UNIQUE constraint, foreign
  keys with `ON DELETE CASCADE`, and the two indexes.
