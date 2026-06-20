/// <reference types="vitest/globals" />
import { spawnSync } from 'node:child_process';

const WRAPPER_SMOKE_TIMEOUT_MS = 10_000;

describe('_LIB-UTILS_update-dependents', () => {
  it('prints help for the shipped wrapper', () => {
    const result = spawnSync('scripts/_LIB-UTILS_update-dependents', ['--help'], { encoding: 'utf8', timeout: WRAPPER_SMOKE_TIMEOUT_MS });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('_LIB-UTILS_update-dependents');
    expect(result.stdout).toContain('AGENTS: MUST load $mdr:lib-utils before editing or for context');
  });
});
