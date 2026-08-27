---
name: GitHub write-path blocking
description: Safe handling when GitHub reads work but repository updates are blocked by remote authentication or an edge challenge.
---

When GitHub writes fail despite a readable, authorized connection, keep the validated changes committed locally and leave the remote branch untouched. Do not force-push or attempt to bypass an edge-security challenge.

**Why:** A successful read proves neither the local Git credential nor the provider's write path is available. Repeated retries cannot safely establish that the remote still has the expected base.

**How to apply:** Compare the remote branch head with the local base through the authorized connection first. If a write fails, report that no branch update occurred, retain the local commit, and retry only after the credential or provider-side block is resolved.