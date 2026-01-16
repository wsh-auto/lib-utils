---
name: lib-utils
description: >-
  CI-safe utilities for TypeScript projects. Provides logger wrapper (falls back to stub when lib-log unavailable) and env injection (skips in CI). Use for projects that need to work in both dev and CI without special setup.
---

# lib-utils

Utilities that enhance development but gracefully degrade in CI environments.

| Utility | In Dev | In CI |
|---------|--------|-------|
| `createLogger` | Full Axiom logging via lib-log | Console stub |
| `initEnv` | 1Password secret injection | No-op |

## Installation

```bash
bun add github:wsh-auto/lib-utils
```

**CRITICAL** - Consumer `package.json`:
```jsonc
"dependencies": {
  "@mdr/lib-utils": "github:wsh-auto/lib-utils",  // ALWAYS github
  "@mdr/lib-log": "file:../lib-log",              // ALWAYS local (optional)
  "@mdr/lib-1password": "file:../lib-1password"   // ALWAYS local (optional)
}
```

- **lib-utils ALWAYS via `github:`** - stable wrapper, rarely changes
- **lib-log/lib-1password ALWAYS via `file:`** - active development, `file:` = symlink (instant updates, no reinstall)
- **Graceful degradation** (lib-log/lib-1password are optional):
  - Without lib-log: `createLogger` returns console stub
  - Without lib-1password: `initEnv` is no-op
  - In CI: typically omit both (use CI secrets + console logging)

## Logger

```typescript
import { createLogger, type Logger } from '@mdr/lib-utils';

const log: Logger = createLogger('my-project');

log.info('Starting');
log.error('Failed', { code: 500 });
await log.flush();

// Child loggers inherit context
const reqLog = log.child({ requestId: 'abc123' });
reqLog.info('Processing');  // includes requestId in every message
```

- If `@mdr/lib-log` installed: full Axiom logging
- If not: console-based stub (info/warn/error only, debug silent)

## Environment Injection

```typescript
import { initEnv } from '@mdr/lib-utils';

// At startup, before reading env vars
await initEnv(import.meta.dirname);
```

Behavior:
- If `@mdr/lib-1password` installed: delegates to its `initEnv()` (handles CI detection, `.env` checks, `op` CLI)
- If not installed: logs warning and returns (common in CI where 1Password unavailable)

### Options

```typescript
// Skip if these env vars are already set
await initEnv(projectRoot, ['MY_API_KEY', 'MY_SECRET']);

// With custom error logger
await initEnv(projectRoot, undefined, { error: (msg) => myLogger.error(msg) });
```

### Project Setup

```
my-project/
├── .env.template   # Committed - contains op:// references
├── .env            # Gitignored - generated with real values
└── .gitignore      # Must include: .env
```

Example `.env.template`:
```bash
export MY_API_KEY=op://wsh/skills_my-project/API_KEY
```

## Typical Usage

```typescript
// src/index.ts
import { createLogger, initEnv } from '@mdr/lib-utils';

// Initialize env first (no-op in CI)
await initEnv(import.meta.dirname);

// Create logger (stub in CI if lib-log not installed)
const log = createLogger('my-project');

log.info('Application started');
```

This works in both:
- **Dev:** Full 1Password injection + Axiom logging
- **CI:** Env vars from CI secrets + console logging
