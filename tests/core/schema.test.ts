import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PrivacyPanelSchema,
  validate,
  SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSIONS,
} from "../../src/core/schema/privacy-panel.schema";

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
  it("is 2.1.0", () => {
    expect(SCHEMA_VERSION).toBe("2.1.0");
  });
});

// ─── Fixture round-trips ──────────────────────────────────────────────────────

describe("PrivacyPanelSchema — fixture validation", () => {
  it("accepts the minimal (Signal-like) fixture", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.companyName).toBe("Signal");
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(false);
      expect(result.data.thirdPartyRecipients.categoryCount).toBe(0);
    }
  });

  it("accepts the typical-saas fixture", () => {
    const result = validate(loadFixture("typical-saas"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.companyName).toBe("TypicalSaaS");
      expect(result.data.dataSharing.sharedForAdvertising.value).toBe(true);
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(false);
      expect(result.data.thirdPartyRecipients.categoryCount).toBe(4);
      expect(result.data.thirdPartyRecipients.includesAdvertising).toBe(true);
    }
  });

  it("accepts the aggressive fixture", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataSharing.soldToThirdParties.value).toBe(true);
      expect(result.data.retention.longestStatedPeriod).toBe("indefinitely");
      expect(result.data.thirdPartyRecipients.categoryCount).toBe(15);
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
    expect(validate(broken).success).toBe(false);
  });

  it("accepts null as a valid BooleanPractice value", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const withNull = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: { value: null, confidence: 0.3, sourceQuote: "Not addressed." },
      },
    };
    expect(validate(withNull).success).toBe(true);
  });
});

// ─── quoteType (v2.1) ─────────────────────────────────────────────────────────

describe("quoteType field (v2.1)", () => {
  it("accepts a BooleanPractice with quoteType=verbatim", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: {
          value: false,
          confidence: 1,
          sourceQuote: "We do not sell your data.",
          quoteType: "verbatim",
        },
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("accepts a BooleanPractice with quoteType=silence", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: {
          value: null,
          confidence: 0.5,
          sourceQuote: "Not addressed in this policy.",
          quoteType: "silence",
        },
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("rejects an invalid quoteType value", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: {
          value: false,
          confidence: 1,
          sourceQuote: "We do not sell your data.",
          quoteType: "unknown",
        },
      },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("accepts a BooleanPractice without quoteType (v2.0 backward compat)", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const result = validate(base);
    expect(result.success).toBe(true);
  });

  it("accepts v2.0.0 schemaVersion (legacy)", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    expect((base as Record<string, unknown & { schemaVersion: string }>).metadata).toBeDefined();
    const result = validate(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.metadata.schemaVersion).toBe("2.0.0");
  });

  it("SCHEMA_VERSION is 2.1.0 and LEGACY_SCHEMA_VERSIONS contains 2.0.0", () => {
    expect(SCHEMA_VERSION).toBe("2.1.0");
    expect(LEGACY_SCHEMA_VERSIONS).toContain("2.0.0");
  });

  it("accepts a DataItem with quoteType", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataCollection: {
        ...(base.dataCollection as object),
        items: [
          {
            category: "contact_info",
            name: "Email",
            sensitive: false,
            sourceQuote: "We collect your email.",
            quoteType: "verbatim",
          },
        ],
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("accepts a verbatim BooleanPractice with sourceAnchor", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      dataSharing: {
        ...(base.dataSharing as object),
        soldToThirdParties: {
          value: false,
          confidence: 1,
          sourceQuote: "We do not sell your data.",
          quoteType: "verbatim",
          sourceAnchor: {
            policyTextHash: "a".repeat(64),
            normalizer: "norm-v1",
            position: { start: 1000, end: 1030 },
            quote: {
              exact: "We do not sell your data.",
              prefix: "under any circumstances. ",
              suffix: " We may share",
            },
          },
        },
      },
    };
    expect(validate(modified).success).toBe(true);
  });
});

// ─── dataCollection.items ──────────────────────────────────────────────────────

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
    expect(validate(broken).success).toBe(false);
  });
});

// ─── Retention (v2 structure) ─────────────────────────────────────────────────

describe("retention (v2)", () => {
  it("has longestStatedPeriod, variesByDataType, legallyMandatedRetention", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention.longestStatedPeriod).toBe("30 days");
      expect(result.data.retention.variesByDataType).toBe(false);
      expect(result.data.retention.legallyMandatedRetention).toBe(false);
    }
  });

  it("accepts 'indefinitely' as longestStatedPeriod", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention.longestStatedPeriod).toBe("indefinitely");
    }
  });

  it("rejects missing longestStatedPeriod", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      retention: {
        variesByDataType: false,
        legallyMandatedRetention: false,
        summary: "x",
        sourceQuote: "x",
        // missing longestStatedPeriod
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
      metadata: { ...(base.metadata as object), policyUrl: "not-a-url" },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects an invalid policyHash (wrong length)", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: { ...(base.metadata as object), policyHash: "abc123" },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects wrong schemaVersion", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: { ...(base.metadata as object), schemaVersion: "1.0.0" },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("rejects an invalid analyzedAt datetime", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      metadata: { ...(base.metadata as object), analyzedAt: "not-a-date" },
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
      expect(result.data.metadata.schemaVersion).toBe("2.0.0");
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

// ─── Security (v2 structured fields) ─────────────────────────────────────────

describe("security (v2)", () => {
  it("has structured BooleanPractice fields and additionalMeasures", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.encryptedInTransit.value).toBe(true);
      expect(result.data.security.encryptedAtRest.value).toBeNull();
      expect(Array.isArray(result.data.security.additionalMeasures)).toBe(true);
      expect(result.data.security.additionalMeasures.length).toBeGreaterThan(0);
    }
  });

  it("accepts all-null security fields (aggressive fixture)", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.security.encryptedInTransit.value).toBeNull();
      expect(result.data.security.additionalMeasures).toHaveLength(0);
    }
  });
});

// ─── thirdPartyRecipients ─────────────────────────────────────────────────────

describe("thirdPartyRecipients", () => {
  it("categoryCount can be 0 (minimal fixture)", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.thirdPartyRecipients.categoryCount).toBe(0);
  });

  it("categoryCount can be a positive integer (aggressive fixture)", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.thirdPartyRecipients.categoryCount).toBeGreaterThan(0);
  });

  it("categoryCount can be null", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const modified = {
      ...base,
      thirdPartyRecipients: {
        ...(base.thirdPartyRecipients as object),
        categoryCount: null,
      },
    };
    expect(validate(modified).success).toBe(true);
  });

  it("rejects negative categoryCount", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      thirdPartyRecipients: {
        ...(base.thirdPartyRecipients as object),
        categoryCount: -1,
      },
    };
    expect(validate(broken).success).toBe(false);
  });

  it("has includesAdvertising and includesLawEnforcement booleans", () => {
    const result = validate(loadFixture("aggressive"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thirdPartyRecipients.includesAdvertising).toBe(true);
      expect(result.data.thirdPartyRecipients.includesLawEnforcement).toBe(true);
    }
  });
});

// ─── signalHonoring (v2) ─────────────────────────────────────────────────────

describe("signalHonoring (v2)", () => {
  it("accepts 'yes' | 'partial' | 'no' | null for honorsBrowserPrivacySignals", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const bp = (v: boolean | null) => ({ value: v, confidence: 0.8, sourceQuote: "test" });

    for (const val of ["yes", "partial", "no", null] as const) {
      const modified = {
        ...base,
        signalHonoring: {
          ...(base.signalHonoring as object),
          honorsBrowserPrivacySignals: val,
        },
      };
      expect(validate(modified).success).toBe(true);
    }
  });

  it("rejects invalid honorsBrowserPrivacySignals value", () => {
    const base = loadFixture("minimal") as Record<string, unknown>;
    const broken = {
      ...base,
      signalHonoring: {
        ...(base.signalHonoring as object),
        honorsBrowserPrivacySignals: "maybe", // invalid
      },
    };
    expect(validate(broken).success).toBe(false);
  });
});

// ─── purposes ─────────────────────────────────────────────────────────────────

describe("purposes", () => {
  it("is present and has standard purpose fields", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.purposes.provideCoreService.value).toBe(true);
      expect(result.data.purposes.advertisingMarketing.value).toBe(false);
    }
  });
});

// ─── supplementary ────────────────────────────────────────────────────────────

describe("supplementary", () => {
  it("has independentAudits BooleanPractice", () => {
    const result = validate(loadFixture("minimal"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supplementary.independentAudits.value).toBe(true);
    }
  });
});
