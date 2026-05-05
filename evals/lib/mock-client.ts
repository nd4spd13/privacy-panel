import type Anthropic from "@anthropic-ai/sdk";
import type { PrivacyFacts } from "../../src/core/schema/types";

/** Minimal Anthropic client stub that returns fixed JSON extraction text. */
export function makeAnthropicFixtureClient(fixture: PrivacyFacts): Anthropic {
  const text = JSON.stringify(fixture);
  return {
    messages: {
      create: async () => ({
        id: "eval-mock",
        type: "message" as const,
        role: "assistant" as const,
        content: [{ type: "text" as const, text }],
        model: "eval-mock",
        stop_reason: "end_turn" as const,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    },
  } as unknown as Anthropic;
}
