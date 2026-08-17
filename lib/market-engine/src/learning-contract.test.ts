import { describe, expect, it } from "vitest";
import { checkLearningEligibility, classifyCausalOutcome } from "./learning-contract";

describe("MLAI causal learning contract", () => {
  it("does not create a target when the future horizon is unavailable", () => {
    expect(checkLearningEligibility(9, 4, 12)).toEqual({
      observedThroughIndex: 9,
      outcomeExitIndex: 13,
      eligible: false,
      reason: "future_outcome_not_available",
    });
  });

  it("classifies an ATR-scaled positive outcome", () => {
    const outcome = classifyCausalOutcome(100, 102, 1, 1000, 1100, {
      horizonBars: 4,
      neutralAtrThreshold: 0.5,
      atrLookback: 14,
    });

    expect(outcome.eligible).toBe(true);
    expect(outcome.direction).toBe("UP");
    expect(outcome.atrReturn).toBe(2);
  });

  it("classifies small movement as neutral when ATR is available", () => {
    const outcome = classifyCausalOutcome(100, 100.2, 1, 1000, 1100, {
      horizonBars: 4,
      neutralAtrThreshold: 0.5,
      atrLookback: 14,
    });

    expect(outcome.direction).toBe("NEUTRAL");
  });

  it("rejects invalid prices instead of silently learning from them", () => {
    const outcome = classifyCausalOutcome(0, 101, 1, 1000, 1100, {
      horizonBars: 4,
      neutralAtrThreshold: 0.5,
      atrLookback: 14,
    });

    expect(outcome.eligible).toBe(false);
    expect(outcome.reason).toBe("invalid_entry_close");
  });
});
