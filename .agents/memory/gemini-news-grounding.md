---
name: Gemini news grounding
description: Provider behavior and validation rules for BrandMoi's Gemini-only current-news retrieval.
---

Gemini Google Search grounding can return valid JSON article records with very long `vertexaisearch.cloud.google.com` redirect URLs, and downstream Claude synthesis may omit optional news metadata even when context is present.

**Why:** Freshness and citation correctness are product requirements, while model output formatting is not reliable enough to be the source of truth for the brief UI.

**How to apply:** Validate publication timestamps against the server's seven-day window and require HTTPS URLs before accepting an article. Keep the verified Gemini article metadata authoritative in the server response; use Claude only for synthesis and writing.