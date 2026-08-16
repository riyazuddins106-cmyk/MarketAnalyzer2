import type {
  CandleAnatomy,
  Evidence,
  MarketAnalysis,
  MarketState,
  NormalizedCandle,
  Scenario,
  SequenceState,
} from "./types";
import type { DatasetQuality } from "./types";

const EPSILON = 1e-12;
const LOOKBACK = 20;
const ATR_PERIOD = 14;

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function trueRange(candle: NormalizedCandle, previous: NormalizedCandle | undefined): number {
  if (!previous) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close),
  );
}

function atrAt(candles: NormalizedCandle[], endIndex: number, period: number): number | null {
  const start = Math.max(0, endIndex - period + 1);
  const ranges = candles
    .slice(start, endIndex + 1)
    .map((candle, offset) => trueRange(candle, candles[start + offset - 1]));
  return mean(ranges);
}

function anatomyAt(candles: NormalizedCandle[], index: number): CandleAnatomy {
  const candle = candles[index];
  const range = candle.high - candle.low;
  const absoluteBody = Math.abs(candle.close - candle.open);
  const atr = atrAt(candles, index, ATR_PERIOD);
  return {
    timestamp: candle.timestamp,
    direction: candle.close > candle.open ? "up" : candle.close < candle.open ? "down" : "neutral",
    body: candle.close - candle.open,
    absoluteBody,
    upperWick: candle.high - Math.max(candle.open, candle.close),
    lowerWick: Math.min(candle.open, candle.close) - candle.low,
    range,
    bodyToRange: range > EPSILON ? absoluteBody / range : 0,
    closeLocation: range > EPSILON ? (candle.close - candle.low) / range : 0.5,
    atr,
    rangeToAtr: atr && atr > EPSILON ? range / atr : null,
  };
}

function sequenceAt(candles: NormalizedCandle[], lastIndex: number, atr: number | null): SequenceState {
  if (lastIndex < 3) return "insufficient_data";
  const recent = candles.slice(Math.max(0, lastIndex - 4), lastIndex + 1);
  const directions = recent.map((candle) => Math.sign(candle.close - candle.open));
  const bullish = directions.filter((direction) => direction > 0).length;
  const bearish = directions.filter((direction) => direction < 0).length;
  const latest = anatomyAt(candles, lastIndex);
  const prior = anatomyAt(candles, lastIndex - 1);
  const latestStrong = atr !== null && latest.absoluteBody >= atr * 0.6;

  if (bullish >= 4 && latestStrong) return "bullish_impulse";
  if (bearish >= 4 && latestStrong) return "bearish_impulse";
  if (latest.direction === "up" && latest.lowerWick > latest.absoluteBody * 1.5 && bearish >= 2) {
    return "recovery_candidate";
  }
  if (latest.direction === "down" && latest.upperWick > latest.absoluteBody * 1.5 && bullish >= 2) {
    return "rejection";
  }
  if (recent.every((candle) => {
    const anatomy = anatomyAt(candles, candles.indexOf(candle));
    return anatomy.rangeToAtr !== null && anatomy.rangeToAtr < 0.8;
  })) {
    return "consolidation";
  }
  if (prior.direction !== latest.direction || bullish === bearish) return "mixed_transition";
  return latest.direction === "up" ? "recovery_candidate" : "rejection";
}

function createScenarios(
  state: MarketState,
  evidence: Evidence[],
): Scenario[] {
  const evidenceText = evidence.map((item) => item.statement);
  const scenarios: Scenario[] = [
    {
      name: "recovery_continuation",
      behavior: "higher",
      supportingEvidence: [],
      contradictingEvidence: [],
      historicalProbability: null,
      confidence: "not_estimated",
      confirmationConditions: ["A completed candle must sustain a close above the recent range high."],
      invalidationConditions: ["A completed candle must close below the recent range low."],
      expectedPath: "A recovery could extend toward the recent high if follow-through persists.",
      timeHorizon: "short-term; no historical horizon supplied",
      missingEvidence: ["Historical experience records and calibrated outcomes."],
    },
    {
      name: "bearish_continuation",
      behavior: "lower",
      supportingEvidence: [],
      contradictingEvidence: [],
      historicalProbability: null,
      confidence: "not_estimated",
      confirmationConditions: ["A completed candle must close below the recent range low."],
      invalidationConditions: ["A completed candle must sustain a close above the recent range high."],
      expectedPath: "Weak recovery followed by a break below recent support would keep lower prices in view.",
      timeHorizon: "short-term; no historical horizon supplied",
      missingEvidence: ["Historical experience records and calibrated outcomes."],
    },
    {
      name: "range_continuation",
      behavior: "neutral",
      supportingEvidence: [],
      contradictingEvidence: [],
      historicalProbability: null,
      confidence: "not_estimated",
      confirmationConditions: ["Price continues rejecting both recent range boundaries."],
      invalidationConditions: ["A sustained close outside the recent range."],
      expectedPath: "Mixed evidence could keep price rotating inside the recent range.",
      timeHorizon: "short-term; no historical horizon supplied",
      missingEvidence: ["Historical experience records and calibrated outcomes."],
    },
  ];

  if (state.trend === "bullish" || state.sequence === "recovery_candidate") {
    scenarios[0].supportingEvidence.push(...evidenceText.slice(0, 2));
    scenarios[1].contradictingEvidence.push(...evidenceText.slice(0, 2));
  } else if (state.trend === "bearish" || state.sequence === "rejection") {
    scenarios[1].supportingEvidence.push(...evidenceText.slice(0, 2));
    scenarios[0].contradictingEvidence.push(...evidenceText.slice(0, 2));
  } else {
    scenarios[2].supportingEvidence.push(...evidenceText.slice(0, 2));
    scenarios[0].contradictingEvidence.push(...evidenceText.slice(0, 1));
    scenarios[1].contradictingEvidence.push(...evidenceText.slice(0, 1));
  }

  return scenarios;
}

function locationFor(close: number, recentLow: number, recentHigh: number): MarketState["location"] {
  const range = recentHigh - recentLow;
  if (range <= EPSILON) return "middle_of_range";
  const position = (close - recentLow) / range;
  if (position >= 0.8) return "near_recent_high";
  if (position <= 0.2) return "near_recent_low";
  return "middle_of_range";
}

export function analyzeMarket(candles: NormalizedCandle[], quality: DatasetQuality): MarketAnalysis {
  if (candles.length === 0) {
    throw new Error("At least one valid candle is required for analysis.");
  }

  const lastIndex = candles.length - 1;
  const latest = candles[lastIndex];
  const latestAnatomy = anatomyAt(candles, lastIndex);
  const lookbackStart = Math.max(0, lastIndex - LOOKBACK);
  const priorCandles = candles.slice(lookbackStart, lastIndex);
  const recentHigh = Math.max(...priorCandles.map((candle) => candle.high), latest.high);
  const recentLow = Math.min(...priorCandles.map((candle) => candle.low), latest.low);
  const priorClose = candles[Math.max(0, lastIndex - 5)].close;
  const recentReturn = priorClose === 0 ? null : (latest.close - priorClose) / priorClose;
  const atr = latestAnatomy.atr;
  const trendStrength = atr && atr > EPSILON ? Math.abs(latest.close - priorClose) / atr : 0;
  const trend: MarketState["trend"] =
    candles.length < 4 ? "insufficient_data" : trendStrength < 0.75 ? "neutral" : latest.close >= priorClose ? "bullish" : "bearish";
  const olderAtr = candles.length > ATR_PERIOD ? atrAt(candles, Math.max(0, lastIndex - 5), ATR_PERIOD) : null;
  const volatility: MarketState["volatility"] =
    atr === null || olderAtr === null
      ? "insufficient_data"
      : atr > olderAtr * 1.15
        ? "expanding"
        : atr < olderAtr * 0.85
          ? "contracting"
          : "normal";
  const momentum: MarketState["momentum"] =
    candles.length < 6
      ? "insufficient_data"
      : Math.abs(latest.close - candles[lastIndex - 2].close) >
          Math.abs(candles[lastIndex - 2].close - candles[lastIndex - 5].close)
        ? "increasing"
        : Math.abs(latest.close - candles[lastIndex - 2].close) <
            Math.abs(candles[lastIndex - 2].close - candles[lastIndex - 5].close)
          ? "decreasing"
          : "mixed";
  const structure: MarketState["structure"] =
    priorCandles.length < 3
      ? "insufficient_data"
      : latest.close > Math.max(...priorCandles.map((candle) => candle.high))
        ? "breakout_observed"
        : latest.close < Math.min(...priorCandles.map((candle) => candle.low))
          ? "breakdown_observed"
          : trend === "bullish"
            ? "higher_high_context"
            : trend === "bearish"
              ? "lower_low_context"
              : "range_context";
  const state: MarketState = {
    instrument: latest.instrument,
    timeframe: latest.timeframe,
    asOf: latest.timestamp,
    trend,
    structure,
    sequence: sequenceAt(candles, lastIndex, atr),
    volatility,
    momentum,
    location: locationFor(latest.close, recentLow, recentHigh),
    recentReturn,
    atr,
    candle: latestAnatomy,
  };

  const evidence: Evidence[] = [
    {
      id: "latest-candle",
      statement: `The latest completed candle closed ${latest.close >= latest.open ? "higher" : "lower"} than it opened, with a ${(latestAnatomy.bodyToRange * 100).toFixed(1)}% body-to-range ratio.`,
      timestamp: latest.timestamp,
      candleOffset: 0,
    },
    {
      id: "structure",
      statement: `The current close is located ${state.location.replaceAll("_", " ")} and the causal structure context is ${state.structure.replaceAll("_", " ")}.`,
      timestamp: latest.timestamp,
      candleOffset: 0,
    },
    {
      id: "sequence",
      statement: `The recent candle sequence is classified as ${state.sequence.replaceAll("_", " ")} using only candles completed by ${latest.timestamp}.`,
      timestamp: latest.timestamp,
      candleOffset: 0,
    },
  ];
  if (state.volatility !== "insufficient_data") {
    evidence.push({
      id: "volatility",
      statement: `Recent volatility is ${state.volatility}; the latest ATR is ${state.atr?.toFixed(6) ?? "unavailable"}.`,
      timestamp: latest.timestamp,
      candleOffset: 0,
    });
  }

  const scenarios = createScenarios(state, evidence);
  const explanation = [
    `As of ${latest.timestamp}, ${latest.instrument} on ${latest.timeframe} shows a ${state.sequence.replaceAll("_", " ")} sequence inside a ${state.structure.replaceAll("_", " ")} context.`,
    `Price is ${state.location.replaceAll("_", " ")} and momentum is ${state.momentum}.`,
    `This is an observation of completed OHLCV candles, not a claim about hidden orders or trader intent.`,
    `Historical probability is not estimated because no historical experience dataset was supplied; scenarios remain competing interpretations with uncalibrated confidence.`,
  ].join(" ");

  return {
    asOf: latest.timestamp,
    input: {
      instrument: latest.instrument,
      timeframe: latest.timeframe,
      candleCount: candles.length,
      firstCandle: candles[0].timestamp,
      lastCandle: latest.timestamp,
    },
    quality,
    state,
    evidence,
    historicalEvidence: {
      status: "unavailable",
      reason: "No historical experience memory was supplied to this command.",
    },
    scenarios,
    causality: [
      {
        feature: "candle anatomy",
        classification: "causal_input",
        firstAvailable: "current candle close",
        candlesUsed: "current candle only",
      },
      {
        feature: "ATR",
        classification: "causal_input",
        firstAvailable: "current candle close",
        candlesUsed: `current and prior ${ATR_PERIOD - 1} candles when available`,
      },
      {
        feature: "recent range and location",
        classification: "causal_input",
        firstAvailable: "current candle close",
        candlesUsed: `current and prior ${LOOKBACK} candles when available`,
      },
      {
        feature: "future outcomes",
        classification: "future_target",
        firstAvailable: "after a predeclared evaluation horizon completes",
        candlesUsed: "not used in this analysis",
      },
    ],
    explanation,
  };
}