export type VolumeType = "base" | "quote" | "unknown";

export interface CandleRow {
  [key: string]: unknown;
}

export interface NormalizedCandle {
  instrument: string;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  volumeType: VolumeType;
  source: string;
}

export interface QualityIssue {
  code:
    | "missing_field"
    | "invalid_number"
    | "invalid_timestamp"
    | "invalid_ohlc"
    | "duplicate_timestamp";
  row: number;
  field?: string;
  message: string;
}

export interface TimeGap {
  from: string;
  to: string;
  expectedSeconds: number;
  actualSeconds: number;
}

export interface DatasetQuality {
  inputRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  missingFieldCount: number;
  invalidOhlcCount: number;
  duplicateTimestampCount: number;
  outOfOrderCount: number;
  timeGaps: TimeGap[];
  issues: QualityIssue[];
}

export interface NormalizationResult {
  candles: NormalizedCandle[];
  quality: DatasetQuality;
}

export interface NormalizeOptions {
  instrument: string;
  timeframe: string;
  source?: string;
}

export interface CandleAnatomy {
  timestamp: string;
  direction: "up" | "down" | "neutral";
  body: number;
  absoluteBody: number;
  upperWick: number;
  lowerWick: number;
  range: number;
  bodyToRange: number;
  closeLocation: number;
  atr: number | null;
  rangeToAtr: number | null;
}

export type MarketTrend =
  | "bullish"
  | "bearish"
  | "neutral"
  | "insufficient_data";

export type SequenceState =
  | "bullish_impulse"
  | "bearish_impulse"
  | "recovery_candidate"
  | "rejection"
  | "consolidation"
  | "mixed_transition"
  | "insufficient_data";

export type VolatilityState =
  | "expanding"
  | "contracting"
  | "normal"
  | "insufficient_data";

export interface MarketState {
  instrument: string;
  timeframe: string;
  asOf: string;
  trend: MarketTrend;
  structure:
    | "higher_high_context"
    | "lower_low_context"
    | "range_context"
    | "breakout_observed"
    | "breakdown_observed"
    | "insufficient_data";
  sequence: SequenceState;
  volatility: VolatilityState;
  momentum: "increasing" | "decreasing" | "mixed" | "insufficient_data";
  location: "near_recent_high" | "near_recent_low" | "middle_of_range" | "insufficient_data";
  recentReturn: number | null;
  atr: number | null;
  candle: CandleAnatomy;
}

export interface Evidence {
  id: string;
  statement: string;
  timestamp: string;
  candleOffset: number;
}

export interface Scenario {
  name: "recovery_continuation" | "bearish_continuation" | "range_continuation";
  behavior: "higher" | "lower" | "neutral";
  supportingEvidence: string[];
  contradictingEvidence: string[];
  historicalProbability: null;
  confidence: "not_estimated";
  confirmationConditions: string[];
  invalidationConditions: string[];
  expectedPath: string;
  timeHorizon: string;
  missingEvidence: string[];
}

export interface MarketAnalysis {
  asOf: string;
  input: {
    instrument: string;
    timeframe: string;
    candleCount: number;
    firstCandle: string;
    lastCandle: string;
  };
  quality: DatasetQuality;
  state: MarketState;
  evidence: Evidence[];
  historicalEvidence: {
    status: "unavailable";
    reason: string;
  };
  scenarios: Scenario[];
  causality: {
    feature: string;
    classification: "causal_input" | "delayed_causal_input" | "future_target";
    firstAvailable: string;
    candlesUsed: string;
  }[];
  explanation: string;
}