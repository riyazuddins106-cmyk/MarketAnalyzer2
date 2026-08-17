import type { MarketState, SequenceState, VolatilityState } from "./types";

export interface MarketExperienceState {
  trend: MarketState["trend"];
  structure: MarketState["structure"];
  sequence: SequenceState;
  volatility: VolatilityState;
  momentum: MarketState["momentum"];
  location: MarketState["location"];
  recentReturn: number | null;
  rangeToAtr: number | null;
}

export interface ExperienceRecord {
  id: string;
  instrument: string;
  timeframe: string;
  asOf: string;
  state: MarketExperienceState;
  outcome: "higher" | "lower" | "neutral";
  horizon: number;
  regime?: string;
  validation?: {
    eligible: boolean;
    evaluatedAt?: string;
    datasetVersion?: string;
  };
}

export interface ExperienceMatch {
  recordId: string;
  similarity: number;
  outcome: ExperienceRecord["outcome"];
  asOf: string;
  horizon: number;
}

export interface ExperienceInference {
  status: "estimated" | "insufficient_evidence" | "unavailable";
  sampleCount: number;
  effectiveSampleSize: number;
  probabilities: {
    higher: number;
    lower: number;
    neutral: number;
  } | null;
  matches: ExperienceMatch[];
  evidenceQuality: "none" | "weak" | "moderate" | "strong";
  reason?: string;
}

function categoricalSimilarity(a: string | null, b: string | null): number {
  if (a === null || b === null) return 0;
  return a === b ? 1 : 0;
}

function numericSimilarity(a: number | null, b: number | null, scale: number): number {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const distance = Math.abs(a - b) / Math.max(scale, 1e-9);
  return Math.max(0, 1 - Math.min(distance, 1));
}

export function experienceSimilarity(a: MarketExperienceState, b: MarketExperienceState): number {
  const categorical = [
    categoricalSimilarity(a.trend, b.trend),
    categoricalSimilarity(a.structure, b.structure),
    categoricalSimilarity(a.sequence, b.sequence),
    categoricalSimilarity(a.volatility, b.volatility),
    categoricalSimilarity(a.momentum, b.momentum),
    categoricalSimilarity(a.location, b.location),
  ];
  const numeric = [
    numericSimilarity(a.recentReturn, b.recentReturn, 0.02),
    numericSimilarity(a.rangeToAtr, b.rangeToAtr, 1),
  ];
  return [...categorical, ...numeric].reduce((sum, value) => sum + value, 0) / 8;
}

function evidenceQuality(effectiveSampleSize: number): ExperienceInference["evidenceQuality"] {
  if (effectiveSampleSize < 5) return "weak";
  if (effectiveSampleSize < 20) return "moderate";
  return "strong";
}

export function inferFromExperience(
  current: MarketExperienceState,
  records: ExperienceRecord[],
  options?: {
    instrument?: string;
    timeframe?: string;
    horizon?: number;
    minSimilarity?: number;
    maxMatches?: number;
  },
): ExperienceInference {
  const eligible = records.filter((record) => {
    if (record.validation?.eligible === false) return false;
    if (options?.instrument && record.instrument !== options.instrument) return false;
    if (options?.timeframe && record.timeframe !== options.timeframe) return false;
    if (options?.horizon !== undefined && record.horizon !== options.horizon) return false;
    return true;
  });

  if (eligible.length === 0) {
    return {
      status: "unavailable",
      sampleCount: 0,
      effectiveSampleSize: 0,
      probabilities: null,
      matches: [],
      evidenceQuality: "none",
      reason: "No validated historical experience records were supplied.",
    };
  }

  const minSimilarity = options?.minSimilarity ?? 0.65;
  const maxMatches = options?.maxMatches ?? 100;
  const matches = eligible
    .map((record) => ({ record, similarity: experienceSimilarity(current, record.state) }))
    .filter((item) => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxMatches);

  if (matches.length === 0) {
    return {
      status: "insufficient_evidence",
      sampleCount: 0,
      effectiveSampleSize: 0,
      probabilities: null,
      matches: [],
      evidenceQuality: "none",
      reason: "No historical states met the minimum similarity threshold.",
    };
  }

  const outcomeWeights = { higher: 0, lower: 0, neutral: 0 };
  let totalWeight = 0;
  let squaredWeight = 0;

  for (const match of matches) {
    const weight = Math.max(match.similarity, 0);
    outcomeWeights[match.record.outcome] += weight;
    totalWeight += weight;
    squaredWeight += weight * weight;
  }

  const effectiveSampleSize = (totalWeight * totalWeight) / Math.max(squaredWeight, 1e-12);
  const probabilities = {
    higher: outcomeWeights.higher / totalWeight,
    lower: outcomeWeights.lower / totalWeight,
    neutral: outcomeWeights.neutral / totalWeight,
  };

  return {
    status: effectiveSampleSize >= 5 ? "estimated" : "insufficient_evidence",
    sampleCount: matches.length,
    effectiveSampleSize,
    probabilities: effectiveSampleSize >= 5 ? probabilities : null,
    matches: matches.map((match) => ({
      recordId: match.record.id,
      similarity: match.similarity,
      outcome: match.record.outcome,
      asOf: match.record.asOf,
      horizon: match.record.horizon,
    })),
    evidenceQuality: evidenceQuality(effectiveSampleSize),
    reason:
      effectiveSampleSize >= 5
        ? undefined
        : "Historical evidence exists, but the effective sample size is too small for a probability estimate.",
  };
}

export function experienceStateFromMarketState(state: MarketState): MarketExperienceState {
  return {
    trend: state.trend,
    structure: state.structure,
    sequence: state.sequence,
    volatility: state.volatility,
    momentum: state.momentum,
    location: state.location,
    recentReturn: state.recentReturn,
    rangeToAtr: state.candle.rangeToAtr,
  };
}
