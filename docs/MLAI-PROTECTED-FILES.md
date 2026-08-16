# MLAI Protected-File Baseline

Status: Initial baseline recorded before the canonical data-foundation phase.

## Protection policy

The files below are the current analysis foundation. Changes to them must:

1. Preserve the evidence-first and non-signal boundary.
2. Include or update deterministic fixtures and acceptance checks.
3. Keep future outcomes separate from current-state inputs.
4. Update the relevant architecture or contract documentation when behavior
   changes.
5. Recompute this baseline when a milestone intentionally changes a protected
   contract.

These hashes are change-detection anchors, not a replacement for version
control, review, or testing.

## Baseline hashes

| File | SHA-256 |
|---|---|
| `lib/market-engine/src/types.ts` | `20e9983d8c90bc8f24e0d47dab63ea9d59f2a6c6208fa28bba4f5778750486ca` |
| `lib/market-engine/src/normalize.ts` | `d532dbc28cef12e75eceb2090ec52a7af625ceffcc1593ba2eede40afdbbe1a9` |
| `lib/market-engine/src/analyze.ts` | `33e347b999839a0c1518a00d66137aa5a59775dced34f476e0f5cd30a521c1a5` |
| `lib/market-engine/src/index.ts` | `d9f1aa773ce9a74880f4b97fce30af1d162847f37e8c05ea20986fcf83eddbe0` |
| `scripts/src/analyze.ts` | `ded12a31bd601bcee302e4bd7d3074959b762cb056e6b56908224604831f0557` |
| `docs/MLAI-ARCHITECTURE.md` | `16202b934783435615e7c04d564d1dd82ae4624e2d7b470782119af2a3f43585` |
| `lib/api-spec/openapi.yaml` | `f9ab7c42c1b0ac5c937994943e70ffce6bb728d22ccb7fe7af963939264a82be` |
| `lib/db/src/schema/index.ts` | `459c09e0be1c1e28c794ee70e838f55d0c3d225fa6614fe2d4182a86fbf5e115` |
| `package.json` | `70cea0f4dad2fe6eac92d937b9f09dea474c1f2372d747950885b0875e59d601` |
| `pnpm-lock.yaml` | `017bed96c0e53ad82f5968ac090fe825b672c6ecc687f63d7de0b1620fdcd50d` |

## Reference-document hash

The uploaded planning document is also anchored so that future implementation
work can be compared against the exact roadmap version used for this audit:

| File | SHA-256 |
|---|---|
| `attached_assets/Pasted-MLAI-Market-Language-Brain-Detailed-Architecture-and-De_1786886094881.txt` | `08887b97c0cb486d0b5768074535b7ea9148fc436d91f215915d42990211c8e5` |

## Intentional omissions

Generated `dist/` output, dependency directories, caches, and workflow state are
not protected source-of-truth files. They should be regenerated from the
protected source and lockfile.