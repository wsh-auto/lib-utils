---
name: lib-utils
description: >-
  CI-safe utilities for TypeScript projects. Provides logger wrapper (falls back to stub when lib-log unavailable) and env injection (skips in CI). Use for projects that need to work in both dev and CI without special setup.
---

# lib-utils

Utilities that enhance development but gracefully degrade in CI environments.

| Optional Dep | Export | With Dep | Without Dep |
|--------------|--------|----------|-------------|
| lib-log | `createLogger` | Axiom logging | Console stub |
| lib-1password | `initEnv` | 1Password injection | No-op |

## Installation

```bash
bun add github:wsh-auto/lib-utils
```

**Consumer `package.json`:**
```json
"dependencies": {
  "@mdr/lib-utils": "github:wsh-auto/lib-utils"
},
"optionalDependencies": {
  "@mdr/lib-log": "file:../lib-log",
  "@mdr/lib-1password": "file:../lib-1password"
}
```

- **lib-utils**: always `github:` in dependencies - stable wrapper, rarely changes
- **lib-log/lib-1password**: always `file:` in **optionalDependencies** - installs locally (NFS), fails silently in CI
- **Graceful degradation**: without lib-log → console stub; without lib-1password → no-op

**For 1Password env injection**, create `.env.template` (committed) with `op://` refs:
```bash
export MY_API_KEY=op://wsh/skills_my-project/API_KEY
```
Add `.env` to `.gitignore` - it's generated with real values at runtime.

## lib-log / logger.ts - createLogger(project-name)

```typescript
import { createLogger } from '@mdr/lib-utils';

const log = createLogger('my-project');

log.info('Starting');
log.error('Failed', { code: 500 });
await log.flush();

// Child loggers inherit context
const reqLog = log.child({ requestId: 'abc123' });
reqLog.info('Processing');  // includes requestId in every message
```

- If `@mdr/lib-log` installed: full Axiom logging
- If not: console-based stub (info/warn/error only, debug silent)

## lib-1password / env.ts - initEnv(projectRoot, skipIfEnvVars?, log?)

```typescript
import { initEnv } from '@mdr/lib-utils';

await initEnv(import.meta.dirname);                          // basic
await initEnv(projectRoot, ['MY_API_KEY']);                  // skip if env vars set
await initEnv(projectRoot, undefined, { error: myLogger });  // custom logger
```

- If `@mdr/lib-1password` installed: delegates to its `initEnv()` (CI detection, `.env` checks, `op` CLI)
- If not: logs warning and returns (common in CI where 1Password unavailable)

## Scripts
`scripts/_LIB-UTILS_update-dependents` - Updates all lib-utils dependents. Run with `--help` for usage.
