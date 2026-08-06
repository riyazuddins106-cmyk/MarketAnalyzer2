---
name: MLAI reasoning boundary
description: Core architecture rule for Market Language AI analysis and narration.
---

MLAI must keep deterministic market analysis separate from AI narration. The data, candle behavior, structure, evidence, replay boundary, and annotation provenance are authoritative; the model explains those structured facts in plain language.

**Why:** This protects replay mode from future-data leakage, makes explanations auditable, supports reproducible tests, reduces inference cost, and preserves useful behavior when an AI provider is unavailable.

**How to apply:** Every analysis artifact must carry dataset, visibility-boundary, and engine-version provenance. Model output must use structured schemas and cite known evidence IDs or chart ranges. Never let an LLM silently calculate or invent market facts.