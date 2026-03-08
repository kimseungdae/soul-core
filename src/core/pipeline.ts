import type { PersonaState } from "../state/index";
import type { BehaviorRequest } from "../types/request";
import type { BehaviorResponse } from "../types/response";
import { perceive } from "./perception/perceive";
import { appraise } from "./appraisal/appraiser";
import { synthesizeMotives } from "./motives/synthesizer";
import { arbitrate } from "./conflict/arbitrator";
import { selectAction } from "./decision/selector";
import {
  computeStateChanges,
  applyStateChanges,
} from "../runtime/state-updater";

export interface PipelineOptions {
  mutateState?: boolean;
}

export function processBehavior(
  state: PersonaState,
  request: BehaviorRequest,
  options: PipelineOptions = {},
): BehaviorResponse {
  const { mutateState = true } = options;

  const { event, worldState, tick } = request;

  // 1. Perception
  const perception = perceive(state, event, worldState);

  // 2. Appraisal
  const appraisalResult = appraise(state, event, perception);

  // 3. Motive Synthesis
  const motives = synthesizeMotives(state, event, appraisalResult, perception);

  // 4. Conflict Arbitration
  const arbitration = arbitrate(state, motives, appraisalResult);

  // 5. Action Selection
  const selection = selectAction(
    state,
    arbitration,
    appraisalResult,
    worldState,
  );

  // 6. Compute State Changes
  const stateChanges = computeStateChanges(
    state,
    selection.action,
    selection.selectedMotive,
    appraisalResult,
    event,
    tick,
  );

  // 7. Apply State Changes (if mutating)
  if (mutateState) {
    applyStateChanges(state, stateChanges, tick);
  }

  // 8. Build Response
  const response: BehaviorResponse = {
    personaId: request.personaId,
    tick,
    action: selection.action,
    internalStateChanges: stateChanges,
    trace: {
      appraisal: appraisalResult.tags.join(" + "),
      dominantMotive: selection.selectedMotive.label,
      conflictsResolved: arbitration.conflicts.map((c) => ({
        a: c.motiveA.label,
        b: c.motiveB.label,
        winner: c.winner.label,
        reason: c.reason,
      })),
      alternativesConsidered: selection.alternatives,
      matchedPattern: selection.matchedPatternId,
    },
  };

  return response;
}
