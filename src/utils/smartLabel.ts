import type { SmartLabelBehavior, SmartLabelRule, SmartLabelDefault } from "../types";

// ─── Transform registry ───────────────────────────────────────────────────────
// To add a new transform: add one entry here. No other changes required.

type TransformFn = (segment: string) => string;

const LABEL_EXTRACTION_BEHAVIORS = new Set<SmartLabelBehavior>([
  "asis", "titlecase", "uppercase", "lowercase", "prefixonly",
]);

const TRANSFORMS: Partial<Record<SmartLabelBehavior, TransformFn>> = {
  asis: (s) => s,
  titlecase: (s) => (isIdLike(s) ? s : toTitleCase(s)),
  uppercase: (s) => s.toUpperCase(),
  lowercase: (s) => s.toLowerCase(),
  prefixonly: (_s) => "",   // segment ignored; caller uses prefix as full label
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True for ticket IDs (AA-123, PROJ-456) and ALL-CAPS tokens — skip title-casing. */
export function isIdLike(segment: string): boolean {
  if (/^[A-Za-z]{1,6}-\d+$/.test(segment)) return true;
  if (/^[A-Z0-9][A-Z0-9_-]{2,}$/.test(segment)) return true;
  return false;
}

/** Convert a hyphen/underscore slug to Title Case. */
export function toTitleCase(segment: string): string {
  return segment
    .split(/[-_]/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Extract the final non-empty path segment from a URL string. */
export function getLastPathSegment(rawUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.split("?")[0].split("#")[0];
  }
  const segments = pathname.split("/").filter((s) => s.length > 0);
  return segments[segments.length - 1] ?? "";
}

/**
 * Convert a user-entered wildcard pattern to a RegExp.
 * `*` matches any characters except `/` (within-segment only).
 * All other special characters are treated as literals.
 */
export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcard = escaped.replace(/\*/g, "[^/]*");
  return new RegExp(withWildcard, "i");
}

/** Return true if behavior requires label extraction (prefix active). */
export function isExtractionBehavior(behavior: SmartLabelBehavior): boolean {
  return LABEL_EXTRACTION_BEHAVIORS.has(behavior);
}

/** True if pattern meets the minimum domain format: 1+ chars, literal dot, 2+ chars. */
export function isValidPattern(pattern: string): boolean {
  return /^.+\..{2,}$/.test(pattern.trim());
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/** Find first rule whose pattern matches the full URL. Returns null if none match. */
export function findMatchingRule(url: string, rules: SmartLabelRule[]): SmartLabelRule | null {
  for (const rule of rules) {
    if (!isValidPattern(rule.pattern)) continue;
    if (patternToRegex(rule.pattern).test(url)) return rule;
  }
  return null;
}

/**
 * Build the link label `[LABEL]` content for a matched rule or the default config.
 * Returns an empty string when the segment is missing (caller falls back to [](url)).
 */
export function buildSmartLabel(url: string, rule: SmartLabelRule | SmartLabelDefault): string {
  if (rule.behavior === "prefixonly") return rule.prefix;
  const segment = getLastPathSegment(url);
  if (!segment) return "";
  const transform = TRANSFORMS[rule.behavior] ?? ((s) => s);
  return rule.prefix + transform(segment);
}
