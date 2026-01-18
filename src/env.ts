/**
 * Environment initialization wrapper.
 * - If lib-1password available: initEnv() -> lib1p.initEnv() (1Password injection)
 * - If unavailable + CI: initEnv() -> createStubInitEnv() (no-op)
 * - If unavailable + not CI: process.exit(1) (add lib-1password to optionalDependencies)
 */

function createStubInitEnv(): (root: string, skip?: string[], log?: unknown) => void {
  return () => {};  // No-op stub for CI
}

let lib1p: { initEnv: (root: string, skip?: string[], log?: unknown) => void } | undefined;
try {
  // @ts-ignore - optional peer dependency
  lib1p = await import('@mdr/lib-1password');
} catch {
  const caller = process.argv[1] || 'unknown';
  if (process.env.CI) {
    console.log(`[lib-utils] lib-1password not available, using stub (caller: ${caller})`);
  } else {
    console.error(
      `[lib-utils] FATAL: lib-1password not available.\n` +
      `Add to optionalDependencies:\n` +
      `  "@mdr/lib-1password": "file:../lib-1password"\n` +
      `Then run: bun install\n` +
      `(caller: ${caller})`
    );
    process.exit(1);
  }
}

export function initEnv(projectRoot: string, skipIfEnvVars?: string[], log?: unknown): void {
  (lib1p ? lib1p.initEnv : createStubInitEnv())(projectRoot, skipIfEnvVars, log);
}
