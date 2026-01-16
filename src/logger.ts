/**
 * Logger wrapper that gracefully falls back to a stub when @mdr/lib-log is unavailable.
 * In development: full Axiom logging via lib-log
 * In CI/production without lib-log: console-based stub
 */

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
  flush(): Promise<void>;
}

function createStubLogger(name: string, parentFields: Record<string, unknown> = {}): Logger {
  const format = (level: string, message: string, fields?: Record<string, unknown>) => {
    const allFields = { ...parentFields, ...fields };
    const fieldsStr = Object.keys(allFields).length > 0 ? ` ${JSON.stringify(allFields)}` : '';
    return `${level} - [${name}] ${message}${fieldsStr}`;
  };

  const stub: Logger = {
    debug: () => {}, // Silent in stub mode
    info: (msg, fields) => console.log(format('info', msg, fields)),
    warn: (msg, fields) => console.warn(format('warn', msg, fields)),
    error: (msg, fields) => console.error(format('error', msg, fields)),
    child: (fields) => createStubLogger(name, { ...parentFields, ...fields }),
    flush: async () => {},
  };
  return stub;
}

// Load lib-log once at module init (top-level await)
let libLog: { createLogger: (name: string) => Logger } | undefined;
try {
  libLog = await import('@mdr/lib-log');
} catch {
  const msg = `[lib-utils] lib-log not available, using stub. Consider running: cd ${process.cwd()} && bun add file:../lib-log`;
  process.env.CI ? console.log(msg) : console.error(msg);
}

/**
 * Create a logger that uses @mdr/lib-log if available, otherwise falls back to a stub.
 * Safe to use in CI environments where lib-log may not be installed.
 */
export function createLogger(name: string): Logger {
  return libLog ? libLog.createLogger(name) : createStubLogger(name);
}
