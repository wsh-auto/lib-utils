/// <reference types="vitest/globals" />
import { execFileSync } from 'node:child_process';

describe('_LIB-UTILS_update-dependents', () => {
  it('prints help for the shipped wrapper', () => {
    const output = execFileSync('scripts/_LIB-UTILS_update-dependents', ['--help'], { encoding: 'utf8' });
    expect(output).toContain('_LIB-UTILS_update-dependents');
    expect(output).toContain('AGENTS: MUST load $mdr:lib-utils before editing or for context');
  });
});
