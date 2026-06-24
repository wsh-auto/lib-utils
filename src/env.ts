/**
 * Environment initialization wrapper for lib-1password.
 *
 * lib-1password is an optional dependency that may not be installed in CI.
 * This wrapper provides graceful degradation:
 * - Development: delegates to lib-1password for 1Password injection
 * - CI: returns empty stub (no secrets needed in CI)
 * - Missing dep outside CI: fatal error (forces proper setup)
 */

import type { DotenvConfigOutput } from 'dotenv';
import { createRequire } from 'node:module';
import { isOptionalDepMissing } from './optional-dep.js';

/** Logger interface for lib-1password secret-loading failures. */
interface Log {
  info(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  critical(msg: string, context?: Record<string, unknown>): void;
}

/** Type matching lib-1password's initEnv signature. */
type InitEnvFn = (callerDir: string, skip: string[], log: Log) => DotenvConfigOutput;

const require = createRequire(import.meta.url);
let lib1p: { initEnv: InitEnvFn } | undefined;

function _loadLib1p(): { initEnv: InitEnvFn } {
  if (lib1p) return lib1p;
  try {
    lib1p = require('@mdr/lib-1password') as { initEnv: InitEnvFn };
    return lib1p;
  } catch (err) {
    // Only treat as "lib-1password missing" when the error clearly
    // identifies @mdr/lib-1password itself as the missing target.
    // Transitive-dep failures re-throw so the real root cause surfaces
    // instead of the misleading FATAL below.
    if (!isOptionalDepMissing(err, '@mdr/lib-1password')) throw err;
    const caller = process.argv[1] || 'unknown';
    if (process.env.CI) {
      // CI: lib-1password not needed, use stub that returns empty result
      console.log(`[lib-utils] lib-1password not available, using stub (caller: ${caller})`);
      lib1p = { initEnv: () => ({ parsed: {} }) };
      return lib1p;
    }
    // Development: lib-1password is required, fail loudly
    console.error(
      `[lib-utils] FATAL: lib-1password not available.\n` +
        `Add to optionalDependencies:\n` +
        `  "@mdr/lib-1password": "link:@mdr/lib-1password"\n` +
        `Then run: bun link @mdr/lib-1password && bun install\n` +
        `(caller: ${caller})`
    );
    process.exit(1);
  }
}

const consoleLog: Log = {
  info: (msg, ...args) => console.info(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
  critical: (msg, context) => console.error(msg, context ?? ''),
};

/**
 * Initialize environment from .env.template using 1Password CLI.
 * Safe to use in CI environments where lib-1password may not be installed.
 *
 * @param callerDir - Any dir inside the package; pass `import.meta.dirname`
 * @param skipIfEnvVars - Skip injection if ALL these env vars are already set
 * @param log - Logger with info/error/critical methods (defaults to a console-backed adapter)
 * @returns { parsed: Record<string, string> } - The loaded/skipped env vars
 */
export function initEnv(callerDir: string, skipIfEnvVars: string[] = [], log: Log = consoleLog): DotenvConfigOutput {
  return _loadLib1p().initEnv(callerDir, skipIfEnvVars, log);
}
