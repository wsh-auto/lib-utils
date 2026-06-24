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

/** Runtime logger options forwarded to lib-log when available. */
export interface LoggerOptions {
  level?: string;
  axiom?: { enabled?: boolean };
  critical?: Record<string, unknown>;
  caller?: 'human' | 'claude' | 'codex' | 'gemini' | 'ssh' | 'service' | 'automation';
  timing?: 'cli' | 'worker';
}

/** Logger contract exposed by lib-log and the CI stub. */
interface Logger {
  readonly name: string;
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

/** Type matching lib-log's createLogger signature. */
type CreateLoggerFn = (name: string, options?: LoggerOptions) => Logger;
type LibLogModule = { createLogger: CreateLoggerFn; shutdown?: () => Promise<void> };
type LogMethod = 'critical' | 'debug' | 'info' | 'warn' | 'error' | 'telemetry' | 'trace';

/** Create a console-based stub logger for CI environments */
function _createStubLogger(name: string, parentFields: Record<string, unknown> = {}): Logger {
  /** Format one stub log line with inherited child fields. */
  const _format = (level: string, message: string, fields?: Record<string, unknown>) => {
    const allFields = { ...parentFields, ...fields };
    const fieldsStr = Object.keys(allFields).length > 0 ? ` ${JSON.stringify(allFields)}` : '';
    return `${level} - [${name}] ${message}${fieldsStr}`;
  };

  return {
    name,
    critical: (msg, fields) => console.error(_format('critical', msg, fields)),
    debug: (msg, fields) => console.log(_format('debug', msg, fields)),
    info: (msg, fields) => console.log(_format('info', msg, fields)),
    warn: (msg, fields) => console.warn(_format('warn', msg, fields)),
    error: (msg, fields) => console.error(_format('error', msg, fields)),
    telemetry: () => {},
    trace: (msg, fields) => console.debug(_format('trace', msg, fields)),
    child: (fields) => _createStubLogger(name, { ...parentFields, ...fields }),
    flush: async () => {},
  };
}

let libLog: LibLogModule | undefined;
let libLogPromise: Promise<LibLogModule> | undefined;
const pendingLoggerPromises = new Set<Promise<Logger>>();

function _loadLibLog(): Promise<LibLogModule> {
  if (libLog) return Promise.resolve(libLog);
  if (!libLogPromise) {
    libLogPromise = import('@mdr/lib-log')
      .then(mod => {
        libLog = mod;
        return mod;
      })
      .catch(err => {
        // Only treat as "lib-log missing" when the error clearly identifies
        // @mdr/lib-log itself as the missing target. Transitive-dep failures
        // inside lib-log (e.g. a missing peer of lib-log) re-throw so the
        // real root cause is visible instead of the misleading FATAL below.
        if (!isOptionalDepMissing(err, '@mdr/lib-log')) throw err;
        const caller = process.argv[1] || 'unknown';
        if (process.env.CI) {
          // CI: lib-log not needed, use console-based stub
          console.log(`[lib-utils] lib-log not available, using stub (caller: ${caller})`);
          libLog = { createLogger: (name: string) => _createStubLogger(name) };
          return libLog;
        }
        // Development: lib-log is required, fail loudly
        console.error(
          `[lib-utils] FATAL: lib-log not available.\n` +
            `Add to optionalDependencies:\n` +
            `  "@mdr/lib-log": "link:@mdr/lib-log"\n` +
            `Then run: bun link @mdr/lib-log && bun install\n` +
            `(caller: ${caller})`
        );
        process.exit(1);
      });
  }
  return libLogPromise;
}

function _createDeferredLogger(name: string, ready: Promise<Logger>): Logger {
  let realLogger: Logger | undefined;
  const pendingCalls: Array<(logger: Logger) => void> = [];
  const trackedReady = ready
    .then(logger => {
      realLogger = logger;
      for (const call of pendingCalls.splice(0)) call(logger);
      return logger;
    })
    .finally(() => pendingLoggerPromises.delete(trackedReady));
  pendingLoggerPromises.add(trackedReady);

  const _call = (method: LogMethod, message: string, fields?: Record<string, unknown>) => {
    if (realLogger) {
      realLogger[method](message, fields);
    } else {
      pendingCalls.push(logger => logger[method](message, fields));
    }
  };

  return {
    name,
    critical: (message, fields) => _call('critical', message, fields),
    debug: (message, fields) => _call('debug', message, fields),
    info: (message, fields) => _call('info', message, fields),
    warn: (message, fields) => _call('warn', message, fields),
    error: (message, fields) => _call('error', message, fields),
    telemetry: (message, fields) => _call('telemetry', message, fields),
    trace: (message, fields) => _call('trace', message, fields),
    child: fields => _createDeferredLogger(name, trackedReady.then(logger => logger.child?.(fields) ?? logger)),
    flush: async () => {
      const logger = await trackedReady;
      await logger.flush();
    },
  };
}

/**
 * Create a logger that uses @mdr/lib-log if available, otherwise falls back to a stub.
 * Safe to use in CI environments where lib-log may not be installed.
 *
 * @param name - Logger name (appears in log output)
 * @param options - Optional lib-log runtime configuration
 * @returns Logger instance with critical/debug/info/warn/error/telemetry/trace/child/flush methods
 */
export function createLogger(name: string, options?: LoggerOptions): Logger {
  if (libLog) return libLog.createLogger(name, options);
  return _createDeferredLogger(name, _loadLibLog().then(mod => mod.createLogger(name, options)));
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
 *
 * @returns Resolves after available logger and stdout drains complete.
 */
export async function shutdown(): Promise<void> {
  if (libLogPromise) {
    await libLogPromise;
  }
  if (pendingLoggerPromises.size > 0) {
    await Promise.all([...pendingLoggerPromises]);
  }
  if (libLog?.shutdown) {
    await libLog.shutdown();
  }
  if (!process.stdout.destroyed && !process.stdout.writableEnded) {
    while (process.stdout.writableNeedDrain) {
      await new Promise<void>(resolve => {
        const _done = () => {
          process.stdout.off('drain', _done);
          process.stdout.off('error', _done);
          process.stdout.off('close', _done);
          resolve();
        };
        process.stdout.once('drain', _done);
        process.stdout.once('error', _done);
        process.stdout.once('close', _done);
      });
      if (process.stdout.destroyed || process.stdout.writableEnded) return;
    }
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
  }
}
