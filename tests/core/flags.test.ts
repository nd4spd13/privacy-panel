import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";

// We need to re-import scoresEnabled after setting env vars.
// Use dynamic imports + vi.resetModules() to get a fresh module each time.

describe("scoresEnabled()", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.resetModules();
    tmpDir = mkdtempSync(join(tmpdir(), "privacy-panel-test-"));
    // Point DATABASE_URL at a fake path inside the temp dir so scoresEnabled()
    // resolves the sentinel to the same temp dir.
    process.env.DATABASE_URL = join(tmpDir, "fake.db");
    delete process.env.SHOW_SCORES;
  });

  afterEach(() => {
    delete process.env.SHOW_SCORES;
    delete process.env.DATABASE_URL;
    try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  });

  it("returns true by default (no env var, no sentinel)", async () => {
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(true);
  });

  it("returns false when SHOW_SCORES=false", async () => {
    process.env.SHOW_SCORES = "false";
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(false);
  });

  it("returns true when SHOW_SCORES=true", async () => {
    process.env.SHOW_SCORES = "true";
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(true);
  });

  it("returns true when SHOW_SCORES is an unrecognized value", async () => {
    process.env.SHOW_SCORES = "yes";
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(true);
  });

  it("returns false when SCORES_DISABLED sentinel file exists", async () => {
    writeFileSync(join(tmpDir, "SCORES_DISABLED"), "");
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(false);
  });

  it("returns false when both env var and sentinel are set", async () => {
    process.env.SHOW_SCORES = "false";
    writeFileSync(join(tmpDir, "SCORES_DISABLED"), "");
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(false);
  });

  it("returns true when sentinel is absent even if env var is not set", async () => {
    const { scoresEnabled } = await import("@/lib/flags");
    expect(scoresEnabled()).toBe(true);
  });
});
