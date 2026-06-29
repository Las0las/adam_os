import { test } from "@playwright/test";

/**
 * Placeholder proving the Playwright harness is wired. Real journeys arrive with
 * the Universal Workspace (Phase 3) and Studios (Phase 5). Kept out of the default
 * `pnpm test` gate so a clean clone needs no browser download to go green.
 */
test.describe("LAWRENCE platform e2e harness", () => {
  test.fixme("Universal Workspace renders a governed object (Phase 3)", async () => {
    // Intentionally unimplemented in Phase 0.
  });
});
