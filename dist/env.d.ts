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
/** Logger interface for lib-1password secret-loading failures. */
interface Log {
    info(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    critical(msg: string, context?: Record<string, unknown>): void;
}
/**
 * Initialize environment from .env.template using 1Password CLI.
 * Safe to use in CI environments where lib-1password may not be installed.
 *
 * @param callerDir - Any dir inside the package; pass `import.meta.dirname`
 * @param skipIfEnvVars - Skip injection if ALL these env vars are already set
 * @param log - Logger with info/error/critical methods (defaults to a console-backed adapter)
 * @returns { parsed: Record<string, string> } - The loaded/skipped env vars
 */
export declare function initEnv(callerDir: string, skipIfEnvVars?: string[], log?: Log): DotenvConfigOutput;
export {};
