/**
 * Shared classifier for optional-dep import failures.
 *
 * `logger.ts` and `env.ts` do `await import('@mdr/lib-log')` /
 * `await import('@mdr/lib-1password')` at module init. A bare catch
 * would swallow ANY failure -- including transitive-dep failures
 * inside the loaded package -- and misreport them as "optional dep
 * not available". This classifier distinguishes the two so the
 * graceful-degradation path only fires when the optional package
 * itself is actually missing.
 */

/**
 * Return true only when the error clearly identifies `optionalPkg` as
 * the missing target. Transitive-dep failures (where a different
 * package is the missing target) return false so the caller re-throws.
 */
export function isOptionalDepMissing(err: unknown, optionalPkg: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const escaped = optionalPkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Case 1: "Cannot find package|module '@mdr/lib-log'" (Node / Bun resolve error).
  const namedMissing = new RegExp(`cannot find (?:package|module) ['"\`]?${escaped}['"\`]?`, 'i');
  if (namedMissing.test(msg)) {
    return !_mentionsOtherPackageAsMissing(msg, optionalPkg);
  }

  // Case 2: ENOENT on the optional's own `node_modules/<pkg>` path or its
  // `package.json`. Bun surfaces transitive failures as ENOENT on the
  // MISSING package's path (e.g. `.../node_modules/@mdr/lib-tmux`), not
  // on the package we're trying to load -- so a path match that names
  // a different package is the transitive case.
  const pathMatch = new RegExp(`node_modules/${escaped}(?:/package\\.json)?(?=["'\\s]|$)`, 'i');
  if (pathMatch.test(msg)) {
    return !_mentionsOtherPackageAsMissing(msg, optionalPkg);
  }

  return false;
}

/**
 * Does the message name a scoped package OTHER than `optionalPkg`?
 * Used to catch "while loading @mdr/lib-log: Cannot find package
 * '@mdr/lib-tmux'" shapes where the optional appears for context but
 * a different package is the actual missing target.
 */
function _mentionsOtherPackageAsMissing(msg: string, optionalPkg: string): boolean {
  const matches = msg.match(/@[\w.-]+\/[\w.-]+/g) || [];
  const target = optionalPkg.toLowerCase();
  return matches.some(m => m.toLowerCase() !== target);
}
