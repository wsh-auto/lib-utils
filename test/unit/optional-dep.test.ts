/// <reference types="vitest/globals" />
import { isOptionalDepMissing } from '../../src/optional-dep.js';

describe('isOptionalDepMissing', () => {
  describe('missing-dep shapes (returns true)', () => {
    it('matches "Cannot find package \'@mdr/lib-log\'"', () => {
      const err = new Error("Cannot find package '@mdr/lib-log' imported from /foo/bar.ts");
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(true);
    });

    it('matches "Cannot find module \'@mdr/lib-log\'"', () => {
      const err = new Error(`Cannot find module '@mdr/lib-log'`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(true);
    });

    it('matches double-quoted variant', () => {
      const err = new Error(`Cannot find module "@mdr/lib-log"`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(true);
    });

    it('matches ENOENT on optional\'s own package.json', () => {
      const err = new Error(`ENOENT reading "/path/to/node_modules/@mdr/lib-log/package.json"`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(true);
    });

    it('matches ENOENT on optional\'s own dir', () => {
      const err = new Error(`ENOENT reading "/path/to/node_modules/@mdr/lib-log"`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(true);
    });

    it('works for env.ts optional (@mdr/lib-1password)', () => {
      const err = new Error(`Cannot find package '@mdr/lib-1password'`);
      expect(isOptionalDepMissing(err, '@mdr/lib-1password')).toBe(true);
    });

    it('accepts string errors (not Error instances)', () => {
      expect(isOptionalDepMissing(`Cannot find package '@mdr/lib-log'`, '@mdr/lib-log')).toBe(true);
    });
  });

  describe('transitive-failure shapes (returns false)', () => {
    it('rejects real observed error: ENOENT on a DIFFERENT @mdr package', () => {
      // Observed on m3 2026-04-24: watch -> lib-utils -> lib-log -> lib-tmux
      const err = new Error(
        `BuildMessage: ENOENT reading "/Users/eshao/mnt/tt/cli-tt/node_modules/@mdr/lib-tmux"`
      );
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(false);
    });

    it('rejects "Cannot find" on a DIFFERENT package', () => {
      const err = new Error(`Cannot find package '@mdr/lib-tmux'`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(false);
    });

    it('rejects a generic SyntaxError during lib-log evaluation', () => {
      const err = new Error('SyntaxError: unexpected token at lib-log/dist/index.js:42');
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(false);
    });

    it('rejects when optional appears as context but DIFFERENT pkg is missing target', () => {
      // "While loading @mdr/lib-log, could not resolve @mdr/lib-tmux"
      const err = new Error(`while loading @mdr/lib-log: Cannot find package '@mdr/lib-tmux'`);
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(false);
    });

    it('rejects empty / unrelated error messages', () => {
      expect(isOptionalDepMissing(new Error(''), '@mdr/lib-log')).toBe(false);
      expect(isOptionalDepMissing(new Error('EPERM: permission denied'), '@mdr/lib-log')).toBe(false);
    });

    it('rejects ENOENT on a different package even if optional appears elsewhere', () => {
      const err = new Error(
        `ENOENT reading "/x/node_modules/@mdr/lib-tmux" (while resolving @mdr/lib-log)`
      );
      expect(isOptionalDepMissing(err, '@mdr/lib-log')).toBe(false);
    });
  });
});
