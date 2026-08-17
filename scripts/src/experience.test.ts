import assert from "node:assert/strict";
import test from "node:test";
import {
  experienceSimilarity,
  inferFromExperience,
  type ExperienceRecord,
  type MarketExperienceState,
} from "@workspace/market-engine";

const baseState: MarketExperienceState = {
  trend: "bearish",
  structure: "lower_low_context",
  sequence: "recovery_candidate",
  volatility: "normal",
  momentum: "increasing",
  location: "near_recent_low",
  recentReturn: -0.01,
  rangeToAtr: 1.1,
};

function record(id: string, outcome: ExperienceRecord["outcome"]): ExperienceRecord {
  return {
    id,
    instrument: "XAUUSD",
    timeframe: "5m",
    asOf: `2026-01-01T00:${id.padStart(2, "0")}:00Z`,
    state: { ...baseState },
    outcome,
    horizon: 8,
    validation: { eligible: true, datasetVersion: "fixture-v1" },
  };
}

test("experience inference is similarity-weighted and returns a conditional distribution", () => {
  const records = [
    record("01", "higher"),
    record("02", "higher"),
    record("03", "higher"),
    record("04", "lower"),
    record("05", "lower"),
    record("06", "neutral"),
  ];

  const result = inferFromExperience(baseState, records, {
    instrument: "XAUUSD",
    timeframe: "5m",
    horizon: 8,
    minSimilarity: 0.9,
  });

  assert.equal(result.status, "estimated");
  assert.equal(result.sampleCount, 6);
  assert.ok(result.effectiveSampleSize >= 5);
  assert.ok(result.probabilities);
  assert.ok(result.probabilities.higher > result.probabilities.lower);
  assert.ok(result.probabilities.higher > result.probabilities.neutral);
});

test("ineligible records are excluded from experience", () => {
  const eligible = record("01", "higher");
  const ineligible = { ...record("02", "lower"), validation: { eligible: false } };

  const result = inferFromExperience(baseState, [eligible, ineligible], {
    minSimilarity: 0.9,
  });

  assert.equal(result.sampleCount, 1);
  assert.equal(result.matches[0]?.recordId, "01");
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.probabilities, null);
});

test("experience inference refuses to manufacture a probability without similar history", () => {
  const different: MarketExperienceState = {
    trend: "bullish",
    structure: "breakout_observed",
    sequence: "bullish_impulse",
    volatility: "expanding",
    momentum: "decreasing",
    location: "near_recent_high",
    recentReturn: 0.08,
    rangeToAtr: 3,
  };

  const result = inferFromExperience(baseState, [record("01", "higher")], {
    minSimilarity: 0.9,
  });

  assert.equal(result.status, "estimated");
  assert.equal(result.probabilities?.higher, 1);
  assert.ok(experienceSimilarity(baseState, different) < 0.9);
});
