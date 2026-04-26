/**
 * Logger wrapper for lib-log.
 *
 * lib-log is an optional dependency that may not be installed in CI.
 * This wrapper provides graceful degradation:
 * - Development: full Axiom logging via lib-log
 * - CI: console-based stub logger
 * - Missing dep outside CI: fatal error (forces proper setup)
 */

import { isOptionalDepMissing } from './optional-dep.js';

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

// Type matches lib-log's createLogger signature
type CreateLoggerFn = (name: string) => Logger;

/** Create a console-based stub logger for CI environments */
function _createStubLogger(name: string, parentFields: Record<string, unknown> = {}): Logger {
  const format = (level: string, message: string, fields?: Record<string, unknown>) => {
    const allFields = { ...parentFields, ...fields };
    const fieldsStr = Object.keys(allFields).length > 0 ? ` ${JSON.stringify(allFields)}` : '';
    return `${level} - [${name}] ${message}${fieldsStr}`;
  };

  return {
    critical: (msg, fields) => console.error(format('critical', msg, fields)),
    debug: (msg, fields) => console.log(format('debug', msg, fields)),
    info: (msg, fields) => console.log(format('info', msg, fields)),
    warn: (msg, fields) => console.warn(format('warn', msg, fields)),
    error: (msg, fields) => console.error(format('error', msg, fields)),
    telemetry: () => {},
    trace: (msg, fields) => console.debug(format('trace', msg, fields)),
    child: (fields) => _createStubLogger(name, { ...parentFields, ...fields }),
    flush: async () => {},
  };
}

// Try to load lib-log at module init. Will be either:
// - The real lib-log module (normal case)
// - A stub creator function (CI case)
// - Never assigned (non-CI failure → process.exit before reaching here)
let libLog: { createLogger: CreateLoggerFn; shutdown?: () => Promise<void> };
try {
  libLog = await import('@mdr/lib-log');
} catch (err) {
  // Only treat as "lib-log missing" when the error clearly identifies
  // @mdr/lib-log itself as the missing target. Transitive-dep failures
  // inside lib-log (e.g. a missing peer of lib-log) re-throw so the
  // real root cause is visible instead of the misleading FATAL below.
  if (!isOptionalDepMissing(err, '@mdr/lib-log')) throw err;
  const caller = process.argv[1] || 'unknown';
  if (process.env.CI) {
    // CI: lib-log not needed, use console-based stub
    console.log(`[lib-utils] lib-log not available, using stub (caller: ${caller})`);
    libLog = { createLogger: _createStubLogger };
  } else {
    // Development: lib-log is required, fail loudly
    console.error(
      `[lib-utils] FATAL: lib-log not available.\n` +
        `Add to optionalDependencies:\n` +
        `  "@mdr/lib-log": "link:@mdr/lib-log"\n` +
        `Then run: bun link @mdr/lib-log && bun install\n` +
        `(caller: ${caller})`
    );
    process.exit(1);
  }
}

/**
 * Create a logger that uses @mdr/lib-log if available, otherwise falls back to a stub.
 * Safe to use in CI environments where lib-log may not be installed.
 *
 * @param name - Logger name (appears in log output)
 * @returns Logger instance with critical/debug/info/warn/error/telemetry/trace/child/flush methods
 */
export function createLogger(name: string): Logger {
  return libLog.createLogger(name);
}

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
export async function shutdown(): Promise<void> {
  if (libLog.shutdown) {
    await libLog.shutdown();
  }
  if (!process.stdout.writableEnded) {
    while (process.stdout.writableNeedDrain) {
      await new Promise<void>(resolve => process.stdout.once('drain', resolve));
    }
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
  }
}
