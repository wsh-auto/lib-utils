---
name: lib-utils
description: >-
  CI-safe utilities for TypeScript projects. Provides logger wrapper (falls back to stub when lib-log unavailable) and env injection (skips in CI). Use for projects that need to work in both dev and CI without special setup.
hackmd: https://hackmd.io/l07wsxmXQBiIND0y36i2Ig
---
# lib-utils

Utilities that enhance development but gracefully degrade in CI environments.

| Import Path | Optional Dep | With Dep | Without Dep (CI) | Without Dep (not CI) |
|-------------|--------------|----------|------------------|----------------------|
| `@mdr/lib-utils/logger` | lib-log | Axiom logging | Console stub | **exit(1)** |
| `@mdr/lib-utils/env` | lib-1password | 1Password injection | No-op stub | **exit(1)** |
| `@mdr/lib-utils/browser` | lib-log | Console-only browser logger | Console stub | Console stub |

## TABLE OF CONTENTS
- Installation
- lib-log / Logging
  - logger.ts - createLogger(project-name)
  - Logging Policy
  - Browser - createLogger(project-name)
  - Querying Logs: `ax` CLI
- lib-1password / env.ts - initEnv(projectRoot, skipIfEnvVars?, log?)
- Scripts

## Installation

```bash
bun add github:wsh-auto/lib-utils
```

**Consumer `package.json` (only include optionalDeps you use):**
```json
"dependencies": {
  "@mdr/lib-utils": "github:wsh-auto/lib-utils"
},
"optionalDependencies": {
  "@mdr/lib-log": "link:@mdr/lib-log"
}
```

- **Separate exports**: Import from `/logger` or `/env` - each loads only its optional dep
- **lib-utils**: always `github:` in dependencies
- **lib-log/lib-1password**: always `link:` in **optionalDependencies** - only include what you use
- **CI**: graceful degradation (console stub / no-op)
- **Not CI**: fatal exit if optional dep missing for the export you import

**For 1Password env injection**, create `.env.template` (committed) with `op://` refs:
```bash
export MY_API_KEY=op://wsh/skills_my-project/API_KEY
```
Add `.env` to `.gitignore` - it's generated with real values at runtime.

## lib-log / Logging
### logger.ts - createLogger(project-name)

```typescript
import { createLogger } from '@mdr/lib-utils/logger';

const log = createLogger('my-project');

log.critical('Build failed', { taskId: 'abc123' });
log.info('Starting');
log.error('Failed', { code: 500 });
log.telemetry('Queue sample', { depth: 3 });
log.trace('Polling tick');
await log.flush();
```

- If `@mdr/lib-log` installed: full Axiom logging (Winston-backed TypeScript; Python available via direct lib-log import)
- If not + CI: console-based stub (`telemetry()` becomes a no-op; the other levels stay local)
- If not + not CI: exit(1) with instructions to add to optionalDependencies

**TypeScript levels:** `critical` (stderr+Axiom+Telegram escalation), `error`/`warn`/`info`/`debug` (stderr+Axiom), `telemetry` (Axiom-only), `trace` (stderr-only). Python stays on `debug`/`info`/`warn`/`error`.

**CLI commands must `await shutdown()`** before exit - flushes pending logs, drains stdout (prevents Bun's `process.exit()` from truncating piped output >64KB), and releases the Axiom handle. Long-running daemons don't need `shutdown()`. `flush()` sends pending writes but keeps transports alive; `shutdown()` also resets the registry. One `flush()`/`shutdown()` drains every logger in the process. 5s safety timeout.

**Output destinations:** With lib-log, logs go to both stderr and Axiom (cloud persistence). Runtime logs may hide debug-level entries, so validate with Axiom queries (`ax`) instead of relying only on service logs.

**Querying Axiom from TypeScript:** Use `query()` from `@mdr/lib-log`, not `exec('ax', ...)`. See `$lib-log` SKILL.md for the env isolation failure mode.

**See `$mdr:lib-log` for:**
- Python usage (`from lib_log import create_logger`)
- log.critical escalation (Telegram routing and agentic spawn via `chat-telegram`, 5min default cooldown)
- Axiom schema (8 columns: `_time`, `level`, `message`, `project`, `env`, `hostname`, `context`, `error`)
- Token auto-load from `~/mnt/mdr/skills/lib-log/.env`; 3-token least-privilege split (ingest / frontend / query)
- Logger naming: `{org}:{project}[:{subsystem}]` - name must match code location
- Error objects: pass directly (any key name) → auto-serialized to `error` column with `name`/`message`/`stack`/`code`/`cause`
- Large values: no write-time truncation, but keep under ~100KB/10s; `ax` read-time truncates to 200 chars (`ax --full` to override)
- Runtime defaults in `assets/config.yml` (cooldown, flush timeout, dataset, console level)

### Logging Policy
**CLI logging policy:**
- `stdout` - composable data only (JSON, IDs, paths, tables). Must contain nothing that wouldn't make sense piped to another program. Banned: `console.log` for progress/status messages.
- `stderr` - everything useful for debugging later (state, status, progress, decisions, errors). MUST go through lib-log (`log.info`/`log.debug`/etc.), never via raw `console.error`. `log.*()` already writes to stderr via `StderrTransport` and also ships to Axiom, so `console.error` double-prints locally while bypassing structured logging and cloud persistence. For CLI catch blocks, use `log.warn()` for handled exits and `log.error()` for bug paths; see `$mdr:dev-core` for the single-exit pattern.
- `--help`/`--version` - no need for logging
- "CLI invoked" / argv dumps - `log.debug()` only, never on `--help`/`--version`, never include secrets
- If per-item status is already printed, log per-item at `debug` and keep `info` for summaries and durable side effects

**Required logging (add these to your code):**
- `log.info()` - MUST log: state changes (create/update/delete), external interactions (send email, API calls), recovery actions
- `log.warn()` - MUST log: degraded state, potential issues
- `log.error()` - MUST log: failures, exceptions
- `log.debug()` - SHOULD log: internal function calls useful for debugging (on by default, suppress with `LOG_LEVEL=info`)

**Don't log** high-volume operations at info level (>45/min: e.g. polling loops).

**Log messages should be single-line.** No `\n` in log strings. Use the structured context object for multi-field data instead of formatting a multi-line string. Multi-line log messages break `ax` queries, `grep`, and Axiom dashboard rendering.

The shared `install-on-missing-deps` wrapper (`$dev-typescript`) sets `LOG_LEVEL=info` for all CLIs automatically. Daemons managed by `pmm` get `LOG_LEVEL=debug` via `overmind.env`. All levels still ship to Axiom.

### Browser - createLogger(project-name)

For frontend/browser environments (e.g., React apps bundled with Vite):

```typescript
import { createLogger } from '@mdr/lib-utils/browser';

const log = createLogger('wsh:frontend');
log.info('Page loaded');
```

**Key differences from `/logger`:**
- No Node.js APIs (works in browsers)
- Never exits fatally - always graceful degradation
- Uses lazy initialization (no top-level await for Vite compatibility)
- Current runtime is console-only even when `lib-log` is available; browser -> Axiom shipping is planned, not implemented

### Querying Logs: `ax` CLI

**Naming convention:** Logger name = folder name. If you're in `cli-tt/`, logs are at `--project cli-tt` (auto-catches subsystems like `cli-tt:daemon`, `cli-tt:pool`).

```bash
ax                          # Logs for current folder (auto-detects)
ax projects                 # List all project names
ax --project '*cli-tt*'     # All cli-tt subsystems (glob pattern)
ax --level error            # Filter by level
ax --json                   # JSON output for agents
```

**Glob patterns:** Use `*foo*` (contains) - most useful since logger names have org prefix (e.g., `mdr:cli-tt`).

**Filtering by metadata:** Use APL passthrough for field filtering (`ax "['wsh-logs'] | extend ctx = parse_json(context) | where ctx.field == 'value'" --project '*foo*'`). Do NOT use `--json | python3` - APL is faster and wastes less context.

**Debugging:** When investigating issues, query `ax` while reading source code (spawn a subagent for one while you do the other). Load `$mdr:dev-debug` for the full Axiom-first debugging workflow.

See `$mdr:lib-log` for full ax documentation including APL passthrough.

## lib-1password / env.ts - initEnv(projectRoot, skipIfEnvVars?, log?)

```typescript
import { resolve } from 'path';
import { initEnv } from '@mdr/lib-utils/env';

// When .env.template is in same directory as calling file:
initEnv(import.meta.dirname);

// When .env.template is in parent directory (e.g., src/index.ts → project root):
initEnv(resolve(import.meta.dirname, '..'));              // CORRECT: canonical path
// initEnv(import.meta.dirname + '/..');                  // WRONG: leaves '..' unresolved

// Optional parameters:
initEnv(projectRoot, ['MY_API_KEY']);                     // skip if env vars already set
initEnv(projectRoot, [], customLogger);                   // custom logger (must have info/error)
```

- Returns `DotenvConfigOutput` with `{ parsed: Record<string, string> }`
- If `@mdr/lib-1password` installed: delegates to lib1p.initEnv() (1Password injection)
- If not + CI: returns `{ parsed: {} }` (empty stub)
- If not + not CI: exit(1) with instructions to add to optionalDependencies

## Scripts
`scripts/_LIB-UTILS_update-dependents` - Updates all lib-utils dependents. Run with `--help` for usage.
