/**
 * MLAI P0 learning contract.
 *
 * This module defines the causal boundary between an observed market state and
 * a future outcome. It intentionally does not train a model or claim that a
 * historical frequency is predictive. It exists to make target construction
 * explicit and testable before historical experience is generated.
 */

export type OutcomeDirection = "UP" | "DOWN" | "NEUTRAL";

export interface OutcomeDefinition {
  horizonBars: number;
  neutralAtrThreshold: number;
  atrLookback: number;
}

export interface CausalOutcome {
  direction: OutcomeDirection;
  rawReturn: number;
  atrReturn: number | null;
  entryClose: number;
  exitClose: number;
  entryTimestamp: number;
  exitTimestamp: number;
  horizonBars: number;
  eligible: boolean;
  reason?: string;
}

export interface LearningEligibility {
  observedThroughIndex: number;
  outcomeExitIndex: number;
  eligible: boolean;
  reason?: string;
}

/**
 * Classify an outcome using only the close at the observation boundary and the
 * close exactly horizonBars later. ATR is supplied from information available
 * at the observation boundary; callers must not calculate it using future bars.
 */
export function classifyCausalOutcome(
  entryClose: number,
  exitClose: number,
  atrAtEntry: number | null,
  entryTimestamp: number,
  exitTimestamp: number,
  definition: OutcomeDefinition,
): CausalOutcome {
  if (!Number.isFinite(entryClose) || entryClose <= 0) {
    return {
      direction: "NEUTRAL",
      rawReturn: NaN,
      atrReturn: null,
      entryClose,
      exitClose,
      entryTimestamp,
      exitTimestamp,
      horizonBars: definition.horizonBars,
      eligible: false,
      reason: "invalid_entry_close",
    };
  }

  if (!Number.isFinite(exitClose) || exitClose <= 0) {
    return {
      direction: "NEUTRAL",
      rawReturn: NaN,
      atrReturn: null,
      entryClose,
      exitClose,
      entryTimestamp,
      exitTimestamp,
      horizonBars: definition.horizonBars,
      eligible: false,
      reason: "invalid_exit_close",
    };
  }

  const rawReturn = exitClose / entryClose - 1;
  const atrReturn = atrAtEntry != null && atrAtEntry > 0
    ? (exitClose - entryClose) / atrAtEntry
    : null;

  const threshold = atrAtEntry != null && atrAtEntry > 0
    ? definition.neutralAtrThreshold * atrAtEntry / entryClose
    : 0;

  const direction: OutcomeDirection =
    rawReturn > threshold ? "UP" :
    rawReturn < -threshold ? "DOWN" :
    "NEUTRAL";

  return {
    direction,
    rawReturn,
    atrReturn,
    entryClose,
    exitClose,
    entryTimestamp,
    exitTimestamp,
    horizonBars: definition.horizonBars,
    eligible: true,
  };
}

/**
 * A state is eligible only when its complete future outcome is inside the
 * supplied dataset. This prevents right-edge examples from being silently
 * treated as neutral or negative observations.
 */
export function checkLearningEligibility(
  observedThroughIndex: number,
  horizonBars: number,
  candleCount: number,
): LearningEligibility {
  const outcomeExitIndex = observedThroughIndex + horizonBars;

  if (observedThroughIndex < 0 || observedThroughIndex >= candleCount) {
    return {
      observedThroughIndex,
      outcomeExitIndex,
      eligible: false,
      reason: "observation_index_out_of_range",
    };
  }

  if (!Number.isInteger(horizonBars) || horizonBars <= 0) {
    return {
      observedThroughIndex,
      outcomeExitIndex,
      eligible: false,
      reason: "invalid_horizon",
    };
  }

  if (outcomeExitIndex >= candleCount) {
    return {
      observedThroughIndex,
      outcomeExitIndex,
      eligible: false,
      reason: "future_outcome_not_available",
    };
  }

  return {
    observedThroughIndex,
    outcomeExitIndex,
    eligible: true,
  };
}
