/// <reference types="vitest/globals" />

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOGGER_URL = pathToFileURL(join(PROJECT_ROOT, 'src/logger.ts')).href;
const ENV_URL = pathToFileURL(join(PROJECT_ROOT, 'src/env.ts')).href;

const tempDirs: string[] = [];

function _makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function _runBunEval(code: string, env: NodeJS.ProcessEnv = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scriptDir = _makeTempDir('lib-utils-test-');
  const scriptPath = join(scriptDir, 'runner.mjs');
  writeFileSync(scriptPath, code);

  const proc = spawn('bun', [scriptPath], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (chunk) => { stdout += String(chunk); });
  proc.stderr.on('data', (chunk) => { stderr += String(chunk); });

  const exitCode = await new Promise<number>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => resolve(code ?? 1));
  });

  return { stdout, stderr, exitCode };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('lib-utils wrappers', () => {
  it('uses CI stub logger and shutdown resolves', async () => {
    const { stdout, exitCode } = await _runBunEval(
      `
        import { createLogger, shutdown } from '${LOGGER_URL}';
        const logger = createLogger('test:ci');
        logger.info('hello', { mode: 'ci' });
        await shutdown();
        console.log(JSON.stringify({
          hasMethods: ['debug', 'info', 'warn', 'error', 'child', 'flush'].every((key) => typeof logger[key] === 'function')
        }));
      `,
      { CI: 'true' }
    );

    expect(exitCode).toBe(0);
    const lines = stdout.trim().split('\n');
    expect(lines.at(-1)).toBeDefined();
    const payload = JSON.parse(lines.at(-1) as string) as { hasMethods: boolean };
    expect(payload.hasMethods).toBe(true);
  });

  it('uses CI stub env wrapper and returns parsed config', async () => {
    const fixtureRoot = _makeTempDir('lib-utils-env-');
    const { stdout, exitCode } = await _runBunEval(
      `
        import { initEnv } from '${ENV_URL}';
        const result = initEnv(${JSON.stringify(fixtureRoot)});
        console.log(JSON.stringify(result));
      `,
      { CI: 'true' }
    );

    expect(exitCode).toBe(0);
    const lines = stdout.trim().split('\n');
    expect(JSON.parse(lines.at(-1) as string)).toEqual({ parsed: {} });
  });

  it('fails loudly outside CI when lib-log is unavailable', async () => {
    const { stderr, exitCode } = await _runBunEval(`import '${LOGGER_URL}';`, { CI: '' });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FATAL: lib-log not available');
  });

  it('fails loudly outside CI when lib-1password is unavailable', async () => {
    const { stderr, exitCode } = await _runBunEval(`import '${ENV_URL}';`, { CI: '' });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FATAL: lib-1password not available');
  });
});
