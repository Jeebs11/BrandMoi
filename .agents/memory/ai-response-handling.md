---
name: AI response handling
description: Provider response-block ordering and freshness safeguards for BrandMoi AI and news flows.
---

Anthropic responses are not guaranteed to put the final text at content[0]. AI routes must locate the first valid text block, because reasoning or tool-related blocks can precede it.

**Why:** The content-generation model returned valid text after a non-text block, and routes that assumed content[0] was text surfaced user-visible 500 errors.

**How to apply:** Reuse the shared text-block extractor in every Anthropic-backed route rather than reading a positional content block directly.

News search can return an older article while explaining that no result met the requested freshness window. That prose is not a valid current-news anchor.

**Why:** A tie-to-news generation once surfaced a months-old URL despite asking for the last 48 hours.

**How to apply:** Treat explicit no-fresh-result/stale-result signals as empty news context and use the evergreen fallback; keep stronger freshness and relevance coverage in automated tests.