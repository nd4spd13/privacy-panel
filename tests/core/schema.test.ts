import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PrivacyFactsSchema,
  validate,
  SCHEMA_VERSION,
} from "../../src/core/schema/privacy-facts.schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(name: string): unknown {
  const raw = readFileSync(
    join(__dirname, "../fixtures/extractions", `${name}.json`),
    "utf-8"
  );
  return JSON.parse(raw);
}

// ─── SCHEMA_VERSION ───────────────────────────────────────────────────────────

describe("SCHEMA_VERSION", () => {
  it("is 1.0.0", () => {
    expect(SCHEMA_VERSION).toBe("1.0.0");
  });
});

// ─── Fixture round-trips ──────────────────────────────────────────────────────

describe("PrivacyFactsSchema — fixture validation", () => {
  it("accepts the minimal (Signal-like) fixture", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.companyName).toBe("Signal");
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(false);
    }
  });

  it("accepts the typical-saas fixture", () => {
    const result = validate(loadFixture("typical-saas"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.companyName).toBe("TypicalSaaS");
      expect(result.data.dataSharing.sharedForAdvertising.value).toBe(true);
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(false);
    }
  });

  it("accepts the aggressive fixture", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(true);
      expect(result.data.retention.indefinite).toBe(true);
      expect(result.data.retention.retentionDays).toBeNull();
    }
  });
});

// ─── BooleanPractice shape ────────────────────────────────────────────────────

describe("BooleanPractice fields", () => {
  it("requires value, confidence, sourceQuote", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: { value: false }, // missing confidence + sourceQuote
      },
    };
    const result = validate(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("confidence"))).toBe(true);
      expect(paths.some((p) => p.includes("sourceQuote"))).toBe(true);
    }
  });

  it("rejects confidence outside 0-1", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: {
          value: false,
          confidence: 1.5, // out of range
          sourceQuote: "test",
        },
      },
    };
    const result = validate(broken);
    expect(result.success).toBe(false);
  });
});

// ─── dataCollected items ──────────────────────────────────────────────────────

describe("dataCollection.items", () => {
  it("accepts an empty items array", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataCollection: {
        ...(base.dataCollection as object),
        items: [],
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("requires name, sensitive, sourceQuote on each item", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      dataCollection: {
        ...(base.dataCollection as object),
        items: [{ name: "Email" }], // missing sensitive + sourceQuote
      },
    };
    const result = validate(broken);
    expect(result.success).toBe(false);
  });
});

// ─── Retention ────────────────────────────────────────────────────────────────

describe("retention", () => {
  it("allows retentionDays to be null (indefinite)", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention.retentionDays).toBeNull();
      expect(result.data.retention.indefinite).toBe(true);
    }
  });

  it("rejects negative retentionDays", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      retention: {
        ...(base.retention as object),
        retentionDays: -1,
      },
    };
    expect(validate(broken).success).toBe(false);
  });
});

// ─── Metadata validations ─────────────────────────────────────────────────────

describe("metadata", () => {
  it("rejects an invalid policyUrl", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: {
        ...(base.metadata as object),
        policyUrl: "not-a-url",
      },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects an invalid policyHash (wrong length)", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: {
        ...(base.metadata as object),
        policyHash: "abc123", // too short
      },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects wrong schemaVersion", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: {
        ...(base.metadata as object),
        schemaVersion: "2.0.0",
      },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects an invalid analyzedAt datetime", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: {
        ...(base.metadata as object),
        analyzedAt: "not-a-date",
      },
    };
    expect(validate(broken).success).toBe(false);
  });
});

// ─── validate() return shape ──────────────────────────────────────────────────

describe("validate()", () => {
  it("returns { success: true, data } on valid input", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      // TypeScript should narrow to PrivacyFacts here
      expect(result.data.metadata.schemaVersion).toBe("1.0.0");
    }
  });

  it("returns { success: false, error, issues } on invalid input", () => {
    const result = validate({ bad: "data" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns { success: false } on null", () => {
    expect(validate(null).success).toBe(false);
  });

  it("returns { success: false } on a primitive", () => {
    expect(validate(42).success).toBe(false);
  });
});

// ─── Security measures ────────────────────────────────────────────────────────

describe("security.measures", () => {
  it("accepts an empty measures array (aggressive fixture)", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.measures).toHaveLength(0);
    }
  });

  it("accepts multiple measures (minimal fixture)", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.measures.length).toBeGreaterThan(0);
      result.data.security.measures.forEach((m) => {
        expect(typeof m.name).toBe("string");
        expect(typeof m.sourceQuote).toBe("string");
      });
    }
  });
});

// ─── thirdPartyCount ─────────────────────────────────────────────────────────

describe("dataSharing.thirdPartyCount", () => {
  it("can be 0 (minimal fixture)", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dataSharing.thirdPartyCount).toBe(0);
  });

  it("can be a positive integer (aggressive fixture)", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.dataSharing.thirdPartyCount).toBeGreaterThan(0);
  });

  it("can be null", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        thirdPartyCount: null,
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("rejects negative values", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        thirdPartyCount: -1,
      },
    };
    expect(validate(broken).success).toBe(false);
  });
});
