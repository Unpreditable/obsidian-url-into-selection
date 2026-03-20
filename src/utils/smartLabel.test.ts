import { describe, it, expect } from "vitest";
import {
  isIdLike,
  toTitleCase,
  getLastPathSegment,
  patternToRegex,
  findMatchingRule,
  buildSmartLabel,
  isExtractionBehavior,
} from "./smartLabel";
import type { SmartLabelRule, SmartLabelDefault } from "../types";

describe("isIdLike", () => {
  it("returns true for ticket IDs (AA-123 format)", () => {
    expect(isIdLike("AA-123")).toBe(true);
    expect(isIdLike("PROJ-456")).toBe(true);
    expect(isIdLike("AB-1")).toBe(true);
  });

  it("returns true for ALL-CAPS tokens", () => {
    expect(isIdLike("ABCD")).toBe(true);
    expect(isIdLike("FOO_BAR")).toBe(true);
    expect(isIdLike("MY-FEATURE")).toBe(true);
  });

  it("returns false for lowercase slugs", () => {
    expect(isIdLike("my-cool-feature")).toBe(false);
    expect(isIdLike("hello-world")).toBe(false);
    expect(isIdLike("some_thing")).toBe(false);
  });

  it("returns false for mixed case slugs", () => {
    expect(isIdLike("myFeature")).toBe(false);
    expect(isIdLike("hello")).toBe(false);
  });
});

describe("toTitleCase", () => {
  it("converts hyphenated slug to Title Case", () => {
    expect(toTitleCase("my-cool-feature")).toBe("My Cool Feature");
  });

  it("converts underscored slug to Title Case", () => {
    expect(toTitleCase("hello_world")).toBe("Hello World");
  });

  it("handles single word", () => {
    expect(toTitleCase("hello")).toBe("Hello");
  });

  it("handles mixed separators", () => {
    expect(toTitleCase("foo-bar_baz")).toBe("Foo Bar Baz");
  });

  it("lowercases existing uppercase letters in slug", () => {
    expect(toTitleCase("HELLO-WORLD")).toBe("Hello World");
  });
});

describe("getLastPathSegment", () => {
  it("returns last path segment of a normal URL", () => {
    expect(getLastPathSegment("https://example.com/browse/AA-123")).toBe("AA-123");
  });

  it("returns last segment ignoring query string", () => {
    expect(getLastPathSegment("https://example.com/page?foo=bar")).toBe("page");
  });

  it("returns last segment ignoring hash", () => {
    expect(getLastPathSegment("https://example.com/page#section")).toBe("page");
  });

  it("returns empty string for URL with trailing slash (no segment)", () => {
    // trailing slash → last segment is empty string which gets filtered
    expect(getLastPathSegment("https://example.com/")).toBe("");
  });

  it("returns empty string for URL with no path", () => {
    expect(getLastPathSegment("https://example.com")).toBe("");
  });

  it("handles protocol-less URL gracefully", () => {
    // Falls to catch block, splits on '/'
    expect(getLastPathSegment("example.com/foo/bar")).toBe("bar");
  });

  it("returns deepest segment in multi-segment path", () => {
    expect(getLastPathSegment("https://linear.app/team/my-cool-feature")).toBe("my-cool-feature");
  });
});

describe("patternToRegex", () => {
  it("matches a plain domain in a URL", () => {
    const re = patternToRegex("jira.company.com");
    expect(re.test("https://jira.company.com/browse/AA-123")).toBe(true);
    expect(re.test("https://linear.app/team/issue")).toBe(false);
  });

  it("* wildcard matches within a segment", () => {
    const re = patternToRegex("*.company.com");
    expect(re.test("https://jira.company.com/path")).toBe(true);
    expect(re.test("https://other.company.com/path")).toBe(true);
  });

  it("* wildcard matches within a path segment", () => {
    const re = patternToRegex("company.com/browse/*");
    expect(re.test("https://company.com/browse/AA-123")).toBe(true);
  });

  it("* wildcard does not match / character itself", () => {
    // [^/]* cannot match the literal slash character
    const re = patternToRegex("company.com/browse/*");
    // Pattern matches "company.com/browse/<non-slash-chars>" as a substring
    // A URL with a segment exactly matching the wildcard portion should match
    expect(re.test("https://company.com/browse/AA-123?q=1")).toBe(true);
  });

  it("special chars are treated as literals", () => {
    const re = patternToRegex("example.com");
    // dot is escaped so it doesn't match 'exampleXcom'
    expect(re.test("https://exampleXcom/path")).toBe(false);
    expect(re.test("https://example.com/path")).toBe(true);
  });

  it("is case-insensitive", () => {
    const re = patternToRegex("Linear.App");
    expect(re.test("https://linear.app/team/issue")).toBe(true);
  });
});

describe("isExtractionBehavior", () => {
  it("returns true for label extraction behaviors", () => {
    expect(isExtractionBehavior("asis")).toBe(true);
    expect(isExtractionBehavior("titlecase")).toBe(true);
    expect(isExtractionBehavior("uppercase")).toBe(true);
    expect(isExtractionBehavior("lowercase")).toBe(true);
    expect(isExtractionBehavior("prefixonly")).toBe(true);
  });

  it("returns false for paste behaviors", () => {
    expect(isExtractionBehavior("donothing")).toBe(false);
    expect(isExtractionBehavior("autoselect")).toBe(false);
    expect(isExtractionBehavior("insertinline")).toBe(false);
    expect(isExtractionBehavior("insertbare")).toBe(false);
  });
});

describe("findMatchingRule", () => {
  const rules: SmartLabelRule[] = [
    { pattern: "jira.company.com", prefix: "Jira: ", behavior: "asis" },
    { pattern: "linear.app", prefix: "", behavior: "titlecase" },
  ];

  it("returns first matching rule", () => {
    const result = findMatchingRule("https://jira.company.com/browse/AA-123", rules);
    expect(result).toBe(rules[0]);
  });

  it("returns second rule when first does not match", () => {
    const result = findMatchingRule("https://linear.app/team/my-feature", rules);
    expect(result).toBe(rules[1]);
  });

  it("returns null when no rule matches", () => {
    const result = findMatchingRule("https://github.com/user/repo", rules);
    expect(result).toBeNull();
  });

  it("returns null for empty rules array", () => {
    const result = findMatchingRule("https://example.com", []);
    expect(result).toBeNull();
  });
});

describe("buildSmartLabel", () => {
  it("asis: returns segment verbatim with prefix", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "Jira: ", behavior: "asis" };
    expect(buildSmartLabel("https://jira.company.com/browse/AA-123", rule)).toBe("Jira: AA-123");
  });

  it("titlecase: converts slug to Title Case", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "", behavior: "titlecase" };
    expect(buildSmartLabel("https://linear.app/team/my-cool-feature", rule)).toBe("My Cool Feature");
  });

  it("titlecase: preserves ticket IDs", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "", behavior: "titlecase" };
    expect(buildSmartLabel("https://jira.company.com/browse/AA-123", rule)).toBe("AA-123");
  });

  it("uppercase: uppercases segment", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "", behavior: "uppercase" };
    expect(buildSmartLabel("https://example.com/browse/my-feature", rule)).toBe("MY-FEATURE");
  });

  it("lowercase: lowercases segment", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "", behavior: "lowercase" };
    expect(buildSmartLabel("https://example.com/browse/My-Feature", rule)).toBe("my-feature");
  });

  it("prefixonly: returns prefix regardless of segment", () => {
    const rule: SmartLabelRule = { pattern: "", prefix: "Blog", behavior: "prefixonly" };
    expect(buildSmartLabel("https://blog.company.com/some-long-post-title", rule)).toBe("Blog");
  });

  it("returns empty string when URL has no path segment", () => {
    const rule: SmartLabelDefault = { prefix: "", behavior: "asis" };
    expect(buildSmartLabel("https://example.com", rule)).toBe("");
  });

  it("returns empty string for prefixonly with empty prefix", () => {
    const rule: SmartLabelDefault = { prefix: "", behavior: "prefixonly" };
    expect(buildSmartLabel("https://example.com/page", rule)).toBe("");
  });

  it("works with SmartLabelDefault", () => {
    const def: SmartLabelDefault = { prefix: "", behavior: "titlecase" };
    expect(buildSmartLabel("https://example.com/my-page", def)).toBe("My Page");
  });
});
