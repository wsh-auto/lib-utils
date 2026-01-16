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

No CI configuration needed - utilities auto-detect environment and degrade gracefully.

## Logger

```typescript
import { createLogger } from '@mdr/lib-utils';

const log = createLogger('my-project');

log.info('Starting');
log.error('Failed', { code: 500 });
await log.flush();
```

- If `@mdr/lib-log` is installed: full Axiom logging
- If not (CI): console-based stub (info/warn/error only, debug silent)

To get full logging in dev, also install lib-log:
```bash
bun add file:../lib-log  # Local for instant updates
```

## Environment Injection

```typescript
import { initEnv } from '@mdr/lib-utils';

// At startup, before reading env vars
await initEnv(import.meta.dirname);
```

Behavior:
- **CI (`process.env.CI` set):** Skips entirely
- **`.env` exists:** Skips (already initialized)
- **No `.env.template`:** Skips
- **No `op` CLI:** Skips
- **Otherwise:** Runs `op inject -i .env.template -o .env`

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
