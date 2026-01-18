---
name: lib-utils
description: >-
  CI-safe utilities for TypeScript projects. Provides logger wrapper (falls back to stub when lib-log unavailable) and env injection (skips in CI). Use for projects that need to work in both dev and CI without special setup.
---

# lib-utils

Utilities that enhance development but gracefully degrade in CI environments.

| Import Path | Optional Dep | With Dep | Without Dep (CI) | Without Dep (not CI) |
|-------------|--------------|----------|------------------|----------------------|
| `@mdr/lib-utils/logger` | lib-log | Axiom logging | Console stub | **exit(1)** |
| `@mdr/lib-utils/env` | lib-1password | 1Password injection | No-op stub | **exit(1)** |

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
  "@mdr/lib-log": "file:../lib-log"
}
```

- **Separate exports**: Import from `/logger` or `/env` - each loads only its optional dep
- **lib-utils**: always `github:` in dependencies
- **lib-log/lib-1password**: always `file:` in **optionalDependencies** - only include what you use
- **CI**: graceful degradation (console stub / no-op)
- **Not CI**: fatal exit if optional dep missing for the export you import

**For 1Password env injection**, create `.env.template` (committed) with `op://` refs:
```bash
export MY_API_KEY=op://wsh/skills_my-project/API_KEY
```
Add `.env` to `.gitignore` - it's generated with real values at runtime.

## lib-log / logger.ts - createLogger(project-name)

```typescript
import { createLogger } from '@mdr/lib-utils/logger';

const log = createLogger('my-project');

log.info('Starting');
log.error('Failed', { code: 500 });
await log.flush();

// Child loggers inherit context
const reqLog = log.child({ requestId: 'abc123' });
reqLog.info('Processing');  // includes requestId in every message
```

- If `@mdr/lib-log` installed: full Axiom logging
- If not + CI: console-based stub (debug/info/warn/error all log)
- If not + not CI: exit(1) with instructions to add to optionalDependencies

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
