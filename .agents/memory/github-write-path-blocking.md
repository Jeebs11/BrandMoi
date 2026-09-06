---
name: GitHub write-path blocking
description: Safe handling when GitHub reads work but repository updates are blocked by remote authentication or an edge challenge.
---

When GitHub writes fail despite a readable, authorized connection, keep the validated changes committed locally and leave the remote branch untouched. The Replit GitHub connector can be healthy for reads while the terminal Git credential is invalid; a fine-grained GitHub token stored through Replit Secrets may be needed for a non-force push.

**Why:** A successful read proves neither the local Git credential nor the provider's write path is available. Repeated retries cannot safely establish that the remote still has the expected base; an expired token can produce an authentication failure, while a token without repository Contents write access is rejected as a 403.

**How to apply:** Check whether the PAT is expired before repeated troubleshooting; if so, replace it through Replit Secrets. Compare the remote branch head with the local base first. If a remote bootstrap commit is a separate history, merge it without force-pushing. Use a secure repository-scoped token only after the user provides it through Replit Secrets, then push normally and verify the remote SHA equals the local SHA.