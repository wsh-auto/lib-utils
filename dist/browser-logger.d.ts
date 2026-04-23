/**
 * Browser-compatible logger wrapper for lib-log.
 *
 * lib-log is an optional dependency, but the browser runtime is still console-only today.
 * This wrapper provides graceful degradation for browsers:
 * - With lib-log: console-only browser logger (browser -> Axiom is not implemented yet)
 * - Without lib-log: console-only fallback (CI environments)
 *
 * Unlike the Node logger.ts, this module:
 * - Uses no Node.js APIs (no process.env, process.argv, process.exit)
 * - Uses lazy initialization (no top-level await for browser compatibility)
 * - Never exits fatally (browsers can't exit)
 */
interface Logger {
    critical(message: string, fields?: Record<string, unknown>): void;
    debug(message: string, fields?: Record<string, unknown>): void;
    info(message: string, fields?: Record<string, unknown>): void;
    warn(message: string, fields?: Record<string, unknown>): void;
    error(message: string, fields?: Record<string, unknown>): void;
    telemetry(message: string, fields?: Record<string, unknown>): void;
    trace(message: string, fields?: Record<string, unknown>): void;
    child(fields: Record<string, unknown>): Logger;
    flush(): Promise<void>;
}
/**
 * Create a logger for browser environments.
 * Uses @mdr/lib-log if available (still console-only in the browser runtime), otherwise console-only.
 *
 * @param name - Logger name (appears in log output, e.g., 'wsh:frontend')
 * @returns Logger instance with critical/debug/info/warn/error/telemetry/trace/child/flush methods
 */
export declare function createLogger(name: string): Logger;
export {};
