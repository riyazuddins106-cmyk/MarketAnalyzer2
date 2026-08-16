# Market Language AI

Deterministic, evidence-traceable market-state analysis from completed OHLCV candles. The current interface is command-line output only; no UI or live-data connector is required.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --silent --filter @workspace/scripts run analyze -- --file <candles.csv|candles.json> --instrument <name> --timeframe <interval> [--dataset-id <id>] [--dataset-version <version>] [--visible-through <ISO timestamp>]` — normalize and analyze completed candles, printing structured JSON with dataset provenance and optional replay boundary
- `pnpm --filter @workspace/scripts run test` — deterministic market-engine contract tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The CLI does not require a database or external service.
- The API scaffold still requires `DATABASE_URL` when database-backed routes are added.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/market-engine/src/normalize.ts` — canonical candle normalization and quality checks
- `lib/market-engine/src/analyze.ts` — causal candle anatomy, sequence, structure, context, and scenario analysis
- `scripts/src/analyze.ts` — terminal entry point for CSV/JSON input
- `attached_assets/Pasted-MLAI-Market-Language-Brain-Detailed-Architecture-and-De_1786885441152.txt` — roadmap and scientific constraints

## Architecture decisions

- Deterministic OHLCV evidence is the authority; language output is derived from measured state.
- The CLI sorts accepted candles chronologically but reports source-order violations rather than hiding them.
- Future outcomes are represented as targets only and are explicitly excluded from current analysis.
- Historical probabilities remain unavailable until a validated experience dataset is supplied.

## Product

The first vertical slice validates and explains completed OHLCV candle data. It reports data quality, causal feature availability, market-state evidence, competing scenarios, and the missing historical evidence needed for calibration.

## User preferences

- The user wants command output only; do not add a UI unless explicitly requested.

## Gotchas

- This slice does not make trading recommendations, infer hidden orders, or estimate probabilities without historical experience data.
- Run the CLI with `--file`, `--instrument`, and `--timeframe`; supported timeframe gap checks use formats such as `5m`, `1h`, and `1d`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
