import { defineConfig } from "@playwright/test";

/**
 * Phase 0 ships the Playwright HARNESS, not product E2E. There are no Studios to
 * drive yet, so e2e is intentionally excluded from the `pnpm test` gate (which is
 * unit/contract only) and run on demand via `pnpm test:e2e`. Specs land here as the
 * Universal Workspace (Phase 3) and Studios (Phase 5) come online.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
  },
});
