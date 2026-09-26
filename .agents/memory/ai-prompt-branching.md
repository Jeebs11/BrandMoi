---
name: AI prompt branching
description: Reliable structure for multi-mode provider requests with long system instructions.
---

Keep each mode's instruction branch complete and keep shared request context and metadata separate from that mode selection.

**Why:** Long prompt strings are easy to edit across conditional boundaries; malformed boundaries can surface as misleading syntax errors far below the prompt.

**How to apply:** When adding an AI mode, isolate the mode selection and typecheck the complete provider request before wiring it to the UI.