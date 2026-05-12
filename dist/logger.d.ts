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
 * Flush pending Axiom transports, release lib-log handles, and best-effort
 * drain Node-stream stdout backpressure before process.exit().
 *
 * IMPORTANT — does NOT rescue Bun-truncated console.log output. Once anything
 * touches `process.stdout` listeners (including `import('winston')`), Bun
 * switches `console.log` to a buffered path that drops bytes >64KB on
 * `process.exit()`. The bytes are dropped at write-time and shutdown() cannot
 * recover them. For piped output >64KB, callers MUST use `bunWrite()` from
 * `@mdr/lib-utils/helpers` at the write site instead of `console.log` —
 * see `$mdr:lib-utils` SKILL.md `## lib-log / Logging` and the original
 * investigation at `~/mnt/plans/tidy-weaving-hellman.md`.
 *
 * The Node-stream drain loop below remains useful in the Node-runtime fallback
 * and for in-flight buffered writes that Bun exposes through the Node-compat
 * stream shim.
 */
export declare function shutdown(): Promise<void>;
export {};
