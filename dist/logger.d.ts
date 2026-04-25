/**
 * Logger wrapper for lib-log.
 *
 * lib-log is an optional dependency that may not be installed in CI.
 * This wrapper provides graceful degradation:
 * - Development: full Axiom logging via lib-log
 * - CI: console-based stub logger
 * - Missing dep outside CI: fatal error (forces proper setup)
 */
interface Logger {
    critical(message: string, fields?: Record<string, unknown>): void;
    debug(message: string, fields?: Record<string, unknown>): void;
    info(message: string, fields?: Record<string, unknown>): void;
    warn(message: string, fields?: Record<string, unknown>): void;
    error(message: string, fields?: Record<string, unknown>): void;
    telemetry(message: string, fields?: Record<string, unknown>): void;
    trace(message: string, fields?: Record<string, unknown>): void;
    child?(fields: Record<string, unknown>): Logger;
    flush(): Promise<void>;
}
/**
 * Create a logger that uses @mdr/lib-log if available, otherwise falls back to a stub.
 * Safe to use in CI environments where lib-log may not be installed.
 *
 * @param name - Logger name (appears in log output)
 * @returns Logger instance with critical/debug/info/warn/error/telemetry/trace/child/flush methods
 */
export declare function createLogger(name: string): Logger;
/**
 * Flush all pending logs, drain stdout, and reset the shared Axiom transport registry.
 * Call before process.exit() to ensure piped stdout is fully written.
 * Bun's process.exit() does not wait for pending stdout writes; without
 * this drain, large piped output (>64KB) gets silently truncated.
 *
 * Loops on `writableNeedDrain` because a payload larger than the stream's
 * highWaterMark (Node default 16KB) needs multiple drain cycles; one 'drain'
 * event only clears one cycle. The trailing sentinel `write('', cb)` flushes
 * anything still in-flight — necessary because the empty-write callback can
 * fire out-of-order relative to earlier writes under Bun pipe backpressure.
 */
export declare function shutdown(): Promise<void>;
export {};
