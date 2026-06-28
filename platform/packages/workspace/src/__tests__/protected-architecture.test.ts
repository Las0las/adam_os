import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * PROTECTED ARCHITECTURAL TEST — the load-bearing layering invariant.
 *
 * The Universal Workspace may only speak to the kernel through its PUBLIC
 * surface (`@lawrence/kernel`). It must never import kernel internals
 * (`@lawrence/kernel/internal/*`, the ledger store, or any deep dist path).
 *
 * This test statically scans every source file in this package for forbidden
 * import specifiers. It fails the build if the boundary is ever crossed. The
 * same rule is enforced structurally by dependency-cruiser; this is the
 * fast, package-local guard that runs in `vitest`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, "..");

const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "kernel /internal subpath", re: /@lawrence\/kernel\/internal/ },
  { label: "kernel deep dist reach-in", re: /@lawrence\/kernel\/(dist|src)\// },
  { label: "relative reach into kernel package", re: /\.\.\/+kernel\/src\// },
  { label: "ledger-store internal module", re: /ledger-store/ },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.ts$/.test(entry) && !/protected-architecture\.test\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("workspace cannot import kernel internals", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("finds workspace source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no workspace source file imports a forbidden kernel internal", () => {
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const { label, re } of FORBIDDEN_PATTERNS) {
        if (re.test(text)) {
          violations.push(`${file}: ${label}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the kernel public surface IS allowed (sanity check the rule is not vacuous)", () => {
    const index = readFileSync(join(SRC_ROOT, "index.ts"), "utf8");
    // The workspace legitimately imports the public barrel.
    expect(index).toContain('from "@lawrence/kernel"');
    // And that public import must NOT match any forbidden pattern.
    for (const { re } of FORBIDDEN_PATTERNS) {
      expect(re.test('import { KERNEL_PUBLIC_API } from "@lawrence/kernel";')).toBe(false);
    }
  });
});
