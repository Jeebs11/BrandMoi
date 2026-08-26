---
name: Voice signal precedence
description: Durable rules for combining author voice evidence with performance and LinkedIn feedback.
---

Direct author feedback, pinned writing samples, authenticated voice samples, and current manual profile settings must outrank accepted suggestions, published-post patterns, performance data, external LinkedIn feedback, and automated inference.

**Why:** A LinkedIn member-feedback label such as “Seems like AI slop” is a distribution-risk signal for one post, not proof of authorship and not evidence that the creator's authentic voice should be rewritten.

**How to apply:** Keep external outcomes scoped to the post that produced them. Surface performance patterns only as strategy and structure guidance in the canonical context. An accepted suggestion becomes stale when the author later changes that preference. If a LinkedIn export does not include a feedback field, represent the result as unknown rather than assuming no feedback was reported.

For structured AI responses, size the output budget for the full requested collection—not just one item—and parse balanced JSON candidates rather than assuming a clean object wrapper.

**Why:** A multi-item Best Posts response was truncated at its output limit, so the client only saw a generic invalid-response error even though the AI call itself completed.

**How to apply:** Recalculate token needs when changing item counts, explanation lengths, or nested fields. Keep strict shape checks after parsing; parser hardening should recover formatting noise, not accept incomplete data.