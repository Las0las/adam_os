import { describe, it, expect } from "vitest";
import { CONSTITUTIONAL_REQUIREMENTS } from "../constitutional-test.js";

/**
 * Phase 0 guard: the Constitutional Conformance Requirements (CCR) set is FROZEN.
 * Every kernel/runtime/host implementation built in later phases must satisfy
 * these. This test protects the set from silent drift — each entry must stay
 * well-formed and uniquely identified, and the non-negotiable governance
 * invariants must remain present.
 */
describe("Constitutional Conformance Requirements (frozen)", () => {
  it("defines at least the four baseline invariants", () => {
    expect(CONSTITUTIONAL_REQUIREMENTS.length).toBeGreaterThanOrEqual(4);
  });

  it("has globally unique requirement ids", () => {
    const ids = CONSTITUTIONAL_REQUIREMENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids follow the CCR-NNN convention", () => {
    for (const r of CONSTITUTIONAL_REQUIREMENTS) {
      expect(r.id).toMatch(/^CCR-\d{3}$/);
    }
  });

  it("every requirement is well-formed (title + non-empty expectation)", () => {
    for (const r of CONSTITUTIONAL_REQUIREMENTS) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.expectation.length).toBeGreaterThan(0);
    }
  });

  it("includes the non-negotiable governance invariants", () => {
    const ids = CONSTITUTIONAL_REQUIREMENTS.map((r) => r.id);
    // CCR-001 mutation-without-principal denial, CCR-002 replay, CCR-003 tenant
    // isolation, CCR-004 projection refresh — the load-bearing constitution.
    expect(ids).toContain("CCR-001");
    expect(ids).toContain("CCR-002");
    expect(ids).toContain("CCR-003");
    expect(ids).toContain("CCR-004");

    const corpus = CONSTITUTIONAL_REQUIREMENTS.map((r) =>
      `${r.title} ${r.expectation}`.toLowerCase(),
    ).join(" | ");
    expect(corpus).toContain("audit record"); // denial still audited
    expect(corpus).toContain("replay"); // immutable, replayable history
    expect(corpus).toContain("tenant"); // tenant isolation
    expect(corpus).toContain("projection"); // projection == event history
  });
});
