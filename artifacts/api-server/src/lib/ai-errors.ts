// Shared AI-call error responder. Anthropic errors carry a `status` and a
// nested `error.error.message` — this distinguishes the cases a user can
// actually act on (rate limit, provider account out of credit) from
// everything else, instead of collapsing all of them into one generic
// "Failed to generate X" string the user has no way to interpret.
function anthropicMessage(err: unknown): string | undefined {
  const msg = (err as { error?: { error?: { message?: unknown } } })?.error?.error?.message;
  return typeof msg === "string" ? msg : undefined;
}

export function respondAiError(
  res: { status: (n: number) => { json: (b: unknown) => void } },
  err: unknown,
  fallback: string,
): void {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 529) {
    res.status(429).json({ error: "The AI is at its rate limit right now — try again in a minute or two." });
    return;
  }

  const anthMsg = anthropicMessage(err);
  if (anthMsg && /credit balance/i.test(anthMsg)) {
    res.status(503).json({
      error: "The AI provider account is out of credit, so this feature can't run right now. This needs the account owner to add billing credit — it isn't something retrying will fix.",
    });
    return;
  }

  res.status(500).json({ error: fallback });
}
