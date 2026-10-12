import Anthropic from "@anthropic-ai/sdk";

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const missingConfig = [
  !baseURL ? "AI_INTEGRATIONS_ANTHROPIC_BASE_URL" : null,
  !apiKey ? "AI_INTEGRATIONS_ANTHROPIC_API_KEY" : null,
].filter(Boolean);

function throwMissingAnthropicConfig(): never {
  const error = new Error(
    `Anthropic AI is not configured. Missing: ${missingConfig.join(", ")}.`,
  );
  (error as Error & { status?: number }).status = 503;
  throw error;
}

export const isAnthropicConfigured = missingConfig.length === 0;

export const anthropic: Anthropic = isAnthropicConfigured
  ? new Anthropic({
      apiKey: apiKey!,
      baseURL: baseURL!,
    })
  : ({
      messages: {
        create: async () => throwMissingAnthropicConfig(),
        stream: () => throwMissingAnthropicConfig(),
      },
    } as unknown as Anthropic);
