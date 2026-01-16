/**
 * Environment initialization wrapper that gracefully degrades when lib-1password is unavailable.
 */

let lib1p: { initEnv: (root: string, skip?: string[], log?: unknown) => void } | undefined;
try {
  // @ts-expect-error - lib-1password is an optional peer dependency
  lib1p = await import('@mdr/lib-1password');
} catch {
  const msg = '[lib-utils] lib-1password not available, skipping env injection';
  process.env.CI ? console.log(msg) : console.error(msg);
}

export function initEnv(projectRoot: string, skipIfEnvVars?: string[], log?: unknown): void {
  lib1p?.initEnv(projectRoot, skipIfEnvVars, log);
}
