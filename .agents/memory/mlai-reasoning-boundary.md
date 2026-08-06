---
name: MLAI reasoning boundary
description: Core architecture rule for Market Language AI analysis and narration.
---

MLAI is a Market Reasoning Engine, not an indicator or signal generator. Its canonical cycle is: Observe → Understand → Collect Evidence → Build Market Story → Reason → Explain → Update Memory → Wait for New Evidence. Deterministic market analysis is authoritative; AI narrates those facts.

**Why:** This protects replay mode from future-data leakage, makes explanations auditable, supports reproducible tests, reduces inference cost, and preserves useful behavior when an AI provider is unavailable.

**How to apply:** Every analysis artifact must carry dataset, visibility-boundary, and engine-version provenance. Model output must use structured schemas and cite known evidence IDs or chart ranges. Never let an LLM silently calculate or invent market facts, skip a reasoning stage, or turn insufficient evidence into certainty.

Enterprise scaling should preserve these boundaries as logical modules first and extract physical services only after measured load or ownership needs justify it.

**Why:** Premature microservices would make the evolving market domain harder to change, while explicit ports, versioned events, immutable artifacts, and idempotent workers preserve a safe path to independent scaling later.

**How to apply:** Start with a modular monolith plus workers. Treat API gateway, market data, reasoning, replay, user, admin, notification, and research capabilities as bounded contexts; split them into deployables only when latency, throughput, team ownership, or fault isolation requires it.

Avoid presenting a single confidence percentage as a prediction or signal. Separate observation confidence, evidence sufficiency, interpretation support, alternative interpretations, and future-outcome uncertainty.

**Why:** A system can be highly confident about an observed rejection while remaining uncertain about what price will do next. One percentage would collapse these different claims and encourage signal-like use.

**How to apply:** Store structured confidence dimensions with evidence provenance. If evidence is weak or conflicting, publish an explicit waiting state instead of manufacturing a low or medium directional score.

Evidence must distinguish observable facts from derived interpretations. Facts may be immutable observations; interpretations are versioned assessments that can weaken or become invalidated without deleting the underlying facts.

**Why:** Labels such as “higher high” or “long lower wick” are chart observations, while “buyers are stronger,” “accumulation,” and “liquidity sweep” depend on context and data quality. Mixing them makes provenance and replay validation unreliable.

**How to apply:** Require evidence IDs, chart ranges, dataset/revision, visibility boundary, source, engine version, quality flags, and supporting/contradicting links. Treat invalidation as an append-only status transition. Do not double-count correlated evidence or use future historical outcomes in replay.