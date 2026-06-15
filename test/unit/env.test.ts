import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initEnv } from '@mdr/lib-utils/env';

describe('env initEnv wrapper', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('default logger has a critical method for lib-1password failures', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'lib-utils-env-'));
    tempDirs.push(tempDir);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => initEnv(tempDir)).toThrow(/No .env or .env.template found/);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No .env or .env.template found'),
      expect.objectContaining({ reproducer: expect.any(String), relevantFiles: expect.any(Array) })
    );
  });
});
