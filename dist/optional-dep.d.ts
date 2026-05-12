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
export declare function isOptionalDepMissing(err: unknown, optionalPkg: string): boolean;
