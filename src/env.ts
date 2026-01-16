/**
 * Environment initialization wrapper that gracefully degrades when lib-1password is unavailable.
 */

let lib1p: { initEnv: (root: string, skip?: string[], log?: unknown) => void } | undefined;
let loadAttempted = false;

async function loadLib1p() {
  if (loadAttempted) return lib1p;
  loadAttempted = true;
  try {
    // @ts-ignore - optional peer dependency
    lib1p = await import('@mdr/lib-1password');
  } catch {
    const msg = `[lib-utils] lib-1password not available, skipping env injection. Consider running: cd ${process.cwd()} && bun add file:../lib-1password`;
    process.env.CI ? console.log(msg) : console.error(msg);
  }
  return lib1p;
}

export async function initEnv(projectRoot: string, skipIfEnvVars?: string[], log?: unknown): Promise<void> {
  const mod = await loadLib1p();
  mod?.initEnv(projectRoot, skipIfEnvVars, log);
}
