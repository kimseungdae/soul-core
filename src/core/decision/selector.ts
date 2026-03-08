import type { PersonaState } from "../../state/index";
import type { Motive } from "../motives/motive";
import type { ArbitrationResult } from "../conflict/arbitrator";
import type { AppraisalResult } from "../appraisal/appraiser";
import type { WorldState } from "../../types/request";
import type { ActionResult, AlternativeConsidered } from "../../types/response";

export interface SelectionResult {
  action: ActionResult;
  selectedMotive: Motive;
  alternatives: AlternativeConsidered[];
}

export function selectAction(
  state: PersonaState,
  arbitration: ArbitrationResult,
  appraisal: AppraisalResult,
  world: WorldState,
): SelectionResult {
  const { rankedMotives } = arbitration;

  if (rankedMotives.length === 0) {
    return {
      action: {
        type: "idle",
        intensity: 0,
        params: {},
      },
      selectedMotive: {
        id: "none",
        label: "idle",
        score: 0,
        source: "need",
        sourceId: "none",
        actionHint: "idle",
      },
      alternatives: [],
    };
  }

  const candidates = rankedMotives.slice(0, 5);
  const feasible = candidates.filter((m) => isFeasible(m, world));

  const selected = feasible.length > 0 ? feasible[0] : candidates[0];

  const action = motiveToAction(selected, state, appraisal);

  const alternatives: AlternativeConsidered[] = candidates
    .filter((m) => m.id !== selected.id)
    .map((m) => ({
      action: m.actionHint,
      score: Math.round(m.score),
      rejected: rejectReason(m, selected, world),
    }));

  return { action, selectedMotive: selected, alternatives };
}

function isFeasible(motive: Motive, world: WorldState): boolean {
  if (motive.actionHint === "attack" && world.safeZone) return false;
  if (motive.actionHint === "flee" && world.nearbyEntities.length === 0)
    return false;
  return true;
}

function motiveToAction(
  motive: Motive,
  state: PersonaState,
  appraisal: AppraisalResult,
): ActionResult {
  const intensity = Math.min(motive.score / 100, 1);

  const params: Record<string, unknown> = {};

  if (
    motive.actionHint === "verbal_retaliation" ||
    motive.actionHint === "confront"
  ) {
    params.tone =
      intensity > 0.7 ? "aggressive" : intensity > 0.4 ? "cold_anger" : "firm";
    params.publicDisplay = appraisal.urgency > 0.5;
    params.escalationWillingness =
      (1 - state.traits.core.impulseControl) * intensity;
  }

  if (motive.actionHint === "protect") {
    params.riskTolerance = state.traits.core.socialDominance * intensity;
    params.selfSacrificeWillingness = intensity > 0.7 ? true : false;
  }

  if (motive.actionHint === "flee") {
    params.panicLevel =
      intensity > 0.8 ? "high" : intensity > 0.5 ? "moderate" : "controlled";
  }

  return {
    type: motive.actionHint,
    target: motive.targetId,
    intensity,
    params,
  };
}

function rejectReason(
  rejected: Motive,
  selected: Motive,
  world: WorldState,
): string {
  if (rejected.actionHint === "attack" && world.safeZone) {
    return "safeZone=true";
  }
  if (rejected.score < selected.score * 0.5) {
    return `score too low (${Math.round(rejected.score)} vs ${Math.round(selected.score)})`;
  }
  return `outscored by ${selected.label} (${Math.round(selected.score)} > ${Math.round(rejected.score)})`;
}
