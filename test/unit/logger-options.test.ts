import { describe, expect, it } from 'vitest';
import { createLogger } from '@mdr/lib-utils/logger';
import type { LoggerOptions } from '@mdr/lib-utils/logger';

describe('logger option type surface', () => {
  it('accepts automation caller overrides through the package subpath', () => {
    const options: LoggerOptions = { axiom: { enabled: false }, caller: 'automation' };
    const log = createLogger('mdr:lib-utils:type-surface', options);
    expect(options.caller).toBe('automation');
    expect(typeof log.info).toBe('function');
  });

  it('preserves the logger name for daemon guard consumers', () => {
    const log = createLogger('mdr:lib-utils:daemon', { axiom: { enabled: false } });
    expect(log.name).toBe('mdr:lib-utils:daemon');
  });
});
