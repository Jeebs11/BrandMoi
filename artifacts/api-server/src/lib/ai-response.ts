/**
 * Anthropic can return multiple content blocks, including non-text reasoning
 * blocks before the final answer. AI routes should consume the first text
 * block rather than assuming content[0] is always text.
 */
export type AiTextBlock = {
  type: "text";
  text: string;
  citations?: unknown;
};

export function getAiTextBlock(message: { content: unknown[] }): AiTextBlock | null {
  const block = message.content.find((candidate): candidate is AiTextBlock => {
    if (!candidate || typeof candidate !== "object") return false;
    const value = candidate as { type?: unknown; text?: unknown };
    return value.type === "text" && typeof value.text === "string";
  });

  return block ?? null;
}