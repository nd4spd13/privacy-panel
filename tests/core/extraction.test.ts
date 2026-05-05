import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Module mocks (must be hoisted before imports of extractor) ───────────────

vi.mock("../../src/lib/anthropic", () => ({
  MODEL: "claude-sonnet-4-20250514",
  getAnthropicClient: vi.fn(),
}));

import { extract } from "../../src/core/extraction/extractor";
import { validateExtractionOutput } from "../../src/core/extraction/validator";
import { chunkPolicy, requiresChunking, MAX_CHUNK_CHARS } from "../../src/core/extraction/chunker";
import { buildSystemPrompt, buildSystemPromptEvalVariantB } from "../../src/core/extraction/prompts";
import { getAnthropicClient } from "../../src/lib/anthropic";
import type { PrivacyPanel } from "../../src/core/schema/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadPolicy(name: string): string {
  return readFileSync(join(__dirname, "../fixtures/policies", `${name}.txt`), "utf-8");
}

function loadExtractionFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, "../fixtures/extractions", `${name}.json`), "utf-8")
  );
}

function makeMockClient(responseJson: unknown) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(responseJson) }],
        usage: { input_tokens: 1000, output_tokens: 500 },
      }),
    },
  };
}

// ─── validator.ts tests ───────────────────────────────────────────────────────

describe("validateExtractionOutput()", () => {
  it("accepts a valid JSON extraction", () => {
    const fixture = loadExtractionFixture("minimal");
    const result = validateExtractionOutput(JSON.stringify(fixture));
    expect(result.success).toBe(true);
  });

  it("strips ```json ... ``` code fences", () => {
    const fixture = loadExtractionFixture("minimal");
    const wrapped = "```json\n" + JSON.stringify(fixture) + "\n```";
    const result = validateExtractionOutput(wrapped);
    expect(result.success).toBe(true);
  });

  it("strips plain ``` ... ``` code fences", () => {
    const fixture = loadExtractionFixture("minimal");
    const wrapped = "```\n" + JSON.stringify(fixture) + "\n```";
    const result = validateExtractionOutput(wrapped);
    expect(result.success).toBe(true);
  });

  it("returns failure for malformed JSON", () => {
    const result = validateExtractionOutput("{ not valid json }");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/JSON parse error/);
      expect(result.rawOutput).toBe("{ not valid json }");
    }
  });

  it("returns failure for valid JSON that fails schema", () => {
    const result = validateExtractionOutput(JSON.stringify({ bad: "data" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Schema validation failed/);
    }
  });

  it("returns failure for wrong schemaVersion", () => {
    const fixture = loadExtractionFixture("minimal") as Record<string, unknown>;
    const bad = { ...fixture, metadata: { ...(fixture.metadata as object), schemaVersion: "99.0.0" } };
    const result = validateExtractionOutput(JSON.stringify(bad));
    expect(result.success).toBe(false);
  });

  it("strips leading/trailing whitespace before parsing", () => {
    const fixture = loadExtractionFixture("minimal");
    const padded = "\n\n   " + JSON.stringify(fixture) + "   \n";
    expect(validateExtractionOutput(padded).success).toBe(true);
  });
});

// ─── chunker.ts tests ─────────────────────────────────────────────────────────

describe("chunkPolicy()", () => {
  it("returns a single chunk for short text", () => {
    const text = "Short policy.";
    const chunks = chunkPolicy(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe(text.length);
  });

  it("splits long text into multiple chunks", () => {
    const text = "a".repeat(MAX_CHUNK_CHARS + 1000);
    const chunks = chunkPolicy(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("chunks together cover the entire input (no dropped characters)", () => {
    const text = "word ".repeat(40_000); // ~200K chars
    const chunks = chunkPolicy(text);
    expect(chunks.length).toBeGreaterThan(1);
    const rejoined = chunks.map((c) => c.text).join("");
    expect(rejoined).toBe(text);
  });

  it("chunk indices are sequential starting at 0", () => {
    const text = "x".repeat(MAX_CHUNK_CHARS * 3);
    const chunks = chunkPolicy(text);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("chunk charStart/charEnd are contiguous and correct", () => {
    const text = "hello world\n\n".repeat(15_000);
    const chunks = chunkPolicy(text);
    expect(chunks[0].charStart).toBe(0);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].charStart).toBe(chunks[i - 1].charEnd);
    }
    expect(chunks[chunks.length - 1].charEnd).toBe(text.length);
  });

  it("respects custom maxChars parameter", () => {
    const text = "abc".repeat(100);
    const chunks = chunkPolicy(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(50));
  });
});

describe("requiresChunking()", () => {
  it("returns false for short text", () => {
    expect(requiresChunking("short")).toBe(false);
  });

  it("returns true for text exceeding MAX_CHUNK_CHARS", () => {
    expect(requiresChunking("x".repeat(MAX_CHUNK_CHARS + 1))).toBe(true);
  });

  it("returns false for text exactly at MAX_CHUNK_CHARS", () => {
    expect(requiresChunking("x".repeat(MAX_CHUNK_CHARS))).toBe(false);
  });
});

// ─── prompts.ts tests ─────────────────────────────────────────────────────────

describe("buildSystemPrompt()", () => {
  it("includes the schema version", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("2.0.0");
  });

  it("includes the company name when provided", () => {
    const prompt = buildSystemPrompt("Acme Corp");
    expect(prompt).toContain("Acme Corp");
  });

  it("does not inject undefined or null as a company name", () => {
    const prompt = buildSystemPrompt();
    // "null" and "undefined" as standalone strings (not as JSON schema keywords)
    expect(prompt).not.toMatch(/The company is "undefined"\./);
    expect(prompt).not.toMatch(/The company is "null"\./);
  });

  it("instructs to return ONLY JSON", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/only valid json/i);
  });

  it("includes detection guide phrases for key practices", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("sell");
    expect(prompt).toContain("advertising");
    expect(prompt).toContain("train our");
    expect(prompt).toContain("GPC");
    expect(prompt).toContain("DNT");
  });
});

describe("buildSystemPromptEvalVariantB()", () => {
  it("extends the baseline prompt with the eval-only A/B addendum", () => {
    const base = buildSystemPrompt("Acme");
    const variant = buildSystemPromptEvalVariantB("Acme");
    expect(variant.startsWith(base)).toBe(true);
    expect(variant).toContain("A/B ADDENDUM");
    expect(variant).toContain("sharedForAdvertising");
  });
});

// ─── extract() tests (mocked API) ────────────────────────────────────────────

describe("extract() — mocked Claude API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns extraction success with valid mock response", async () => {
    const fixture = loadExtractionFixture("minimal") as PrivacyPanel;
    vi.mocked(getAnthropicClient).mockReturnValue(makeMockClient(fixture) as never);

    const result = await extract(loadPolicy("minimal"), "Signal", "https://signal.org/legal/privacy-policy/");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.meta.model).toBe("claude-sonnet-4-20250514");
      expect(result.meta.inputTokens).toBe(1000);
      expect(result.meta.outputTokens).toBe(500);
      expect(result.meta.chunked).toBe(false);
      expect(result.meta.chunkCount).toBe(1);
    }
  });

  it("returns correct extraction data from mock response", async () => {
    const fixture = loadExtractionFixture("minimal") as PrivacyPanel;
    vi.mocked(getAnthropicClient).mockReturnValue(makeMockClient(fixture) as never);

    const result = await extract(loadPolicy("minimal"), "Signal");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(false);
      expect(result.data.metadata.companyName).toBe("Signal");
    }
  });

  it("returns failure when API returns invalid JSON", async () => {
    const badClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Sorry, I cannot help with that." }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      },
    };
    vi.mocked(getAnthropicClient).mockReturnValue(badClient as never);

    const result = await extract("Some policy text.");
    expect(result.success).toBe(false);
  });

  it("handles code-fenced response (strips fences)", async () => {
    const fixture = loadExtractionFixture("typical-saas") as PrivacyPanel;
    const fencedClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "```json\n" + JSON.stringify(fixture) + "\n```" }],
          usage: { input_tokens: 2000, output_tokens: 800 },
        }),
      },
    };
    vi.mocked(getAnthropicClient).mockReturnValue(fencedClient as never);

    const result = await extract(loadPolicy("typical-saas"), "TypicalSaaS");
    expect(result.success).toBe(true);
  });

  it("returns failure on auth error without retrying", async () => {
    const authErrorClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("401 invalid_api_key")),
      },
    };
    vi.mocked(getAnthropicClient).mockReturnValue(authErrorClient as never);

    const result = await extract("Some policy.");
    expect(result.success).toBe(false);
    // Should not have retried — called only once
    expect(authErrorClient.messages.create).toHaveBeenCalledTimes(1);
  });

  it("retries on transient server errors", async () => {
    const fixture = loadExtractionFixture("minimal") as PrivacyPanel;
    const flakyClient = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValueOnce(new Error("500 internal server error"))
          .mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify(fixture) }],
            usage: { input_tokens: 1000, output_tokens: 500 },
          }),
      },
    };
    vi.mocked(getAnthropicClient).mockReturnValue(flakyClient as never);

    // Use short delay for tests by faking timers
    vi.useFakeTimers();
    const promise = extract("Some policy text.", "Test Corp");
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.success).toBe(true);
    expect(flakyClient.messages.create).toHaveBeenCalledTimes(2);
    if (result.success) {
      expect(result.meta.retried).toBe(true);
    }
  });

  it("includes latencyMs in metadata", async () => {
    const fixture = loadExtractionFixture("minimal") as PrivacyPanel;
    vi.mocked(getAnthropicClient).mockReturnValue(makeMockClient(fixture) as never);

    const result = await extract("Policy text.");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.meta.latencyMs).toBe("number");
      expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("aggressive fixture mock produces correct booleans", async () => {
    const fixture = loadExtractionFixture("aggressive") as PrivacyPanel;
    vi.mocked(getAnthropicClient).mockReturnValue(makeMockClient(fixture) as never);

    const result = await extract(loadPolicy("aggressive"), "AggressiveCollector");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(true);
      expect(result.data.dataSharing.usedToTrainAI.value).toBe(true);
      expect(result.data.retention.longestStatedPeriod).toBe("indefinitely");
    }
  });
});

// ─── Chunked path smoke test ───────────────────────────────────────────────────

describe("extract() — chunked path", () => {
  it("invokes the API once per chunk for long policies", async () => {
    const fixture = loadExtractionFixture("minimal") as PrivacyPanel;
    const mockClient = makeMockClient(fixture);
    vi.mocked(getAnthropicClient).mockReturnValue(mockClient as never);

    // 2× the chunk limit to force splitting
    const longPolicy = loadPolicy("minimal").repeat(
      Math.ceil((MAX_CHUNK_CHARS * 2) / loadPolicy("minimal").length) + 1
    );
    expect(requiresChunking(longPolicy)).toBe(true);

    const result = await extract(longPolicy, "Signal");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.meta.chunked).toBe(true);
      expect(result.meta.chunkCount).toBeGreaterThan(1);
      // API called once per chunk
      expect(mockClient.messages.create).toHaveBeenCalledTimes(result.meta.chunkCount);
    }
  });
});
