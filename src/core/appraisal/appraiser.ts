import type { PersonaState } from "../../state/index";
import type { BehaviorEvent } from "../../types/request";
import type { PerceptionResult } from "../perception/perceive";
import { clamp01, clampBipolar } from "../../types/common";

export type AppraisalTag =
  | "physical_threat"
  | "social_threat"
  | "identity_challenge"
  | "opportunity"
  | "comfort"
  | "injustice"
  | "betrayal"
  | "loss"
  | "gain"
  | "insult"
  | "praise"
  | "abandonment"
  | "control_loss"
  | "novel_stimulus";

export interface AppraisalResult {
  tags: AppraisalTag[];
  urgency: number;
  personalRelevance: number;
  emotionalImpact: number;
  woundTriggered: string | null;
  valuesEngaged: string[];
  identityThreatened: boolean;
}

export function appraise(
  state: PersonaState,
  event: BehaviorEvent | undefined,
  perception: PerceptionResult,
): AppraisalResult {
  const result: AppraisalResult = {
    tags: [],
    urgency: 0,
    personalRelevance: 0,
    emotionalImpact: 0,
    woundTriggered: null,
    valuesEngaged: [],
    identityThreatened: false,
  };

  if (!event) return result;

  // --- Tag Assignment ---

  if (event.category === "combat") {
    result.tags.push("physical_threat");
    result.urgency = clamp01(perception.perceivedThreatLevel * 1.2);
    result.personalRelevance = clamp01(
      0.5 + perception.perceivedThreatLevel * 0.5,
    );
    result.emotionalImpact = -perception.perceivedThreatLevel;
  }

  if (event.category === "social") {
    const action = event.action.toLowerCase();

    if (
      action.includes("insult") ||
      action.includes("mock") ||
      action.includes("humiliat")
    ) {
      result.tags.push("social_threat", "insult");
      result.emotionalImpact = -(event.context.severity ?? 0.5);

      const witnessCount = event.context.witnesses?.length ?? 0;
      result.urgency = clamp01(
        (event.context.severity ?? 0.5) * (1 + witnessCount * 0.1),
      );
    }

    if (
      action.includes("betray") ||
      action.includes("lie") ||
      action.includes("deceiv")
    ) {
      result.tags.push("betrayal");
      result.emotionalImpact = -0.8;
      result.personalRelevance = 0.9;
    }

    if (
      action.includes("prais") ||
      action.includes("compliment") ||
      action.includes("thank")
    ) {
      result.tags.push("praise");
      result.emotionalImpact = event.context.severity ?? 0.5;
    }

    if (
      action.includes("abandon") ||
      action.includes("leav") ||
      action.includes("reject")
    ) {
      result.tags.push("abandonment", "loss");
      result.emotionalImpact = -0.7;
    }
  }

  if (event.category === "moral") {
    result.tags.push("injustice");
    const moralRigidity = state.traits.core.moralRigidity;
    result.personalRelevance = clamp01(0.3 + moralRigidity * 0.7);
    result.emotionalImpact = -(event.context.severity ?? 0.5) * moralRigidity;
  }

  if (event.category === "cognitive") {
    result.tags.push("novel_stimulus", "opportunity");
    result.emotionalImpact = perception.perceivedOpportunity * 0.5;
    result.personalRelevance = state.traits.core.noveltySeeking;
  }

  // --- Wound Check ---
  for (const wound of state.wounds.wounds) {
    const triggerLower = wound.trigger.toLowerCase();
    const actionLower = event.action.toLowerCase();
    const categoryMatches = result.tags.some((tag) =>
      triggerLower.includes(tag.replace("_", " ")),
    );
    const actionMatches = triggerLower
      .split(/\s+or\s+/)
      .some((t) => actionLower.includes(t.trim()));

    if (categoryMatches || actionMatches) {
      result.woundTriggered = wound.id;
      result.emotionalImpact *= wound.intensityMultiplier;
      result.personalRelevance = clamp01(
        result.personalRelevance + wound.sensitivity * 0.5,
      );
      result.urgency = clamp01(result.urgency + wound.sensitivity * 0.3);
      break;
    }
  }

  // --- Identity Threat Check ---
  for (const role of state.identity.roles) {
    if (!role.active) continue;

    if (role.salience > 0.7) {
      const roleLabel = role.label.toLowerCase();
      if (
        (roleLabel.includes("protector") &&
          result.tags.includes("physical_threat")) ||
        (roleLabel.includes("leader") &&
          result.tags.includes("control_loss")) ||
        (roleLabel.includes("honest") && result.tags.includes("betrayal"))
      ) {
        result.identityThreatened = true;
        result.personalRelevance = clamp01(result.personalRelevance + 0.3);
        result.tags.push("identity_challenge");
        break;
      }
    }
  }

  // --- Values Engagement ---
  for (const value of state.values.values) {
    if (value.priority < 0.4) continue;

    const label = value.label.toLowerCase();
    if (
      (label.includes("justice") && result.tags.includes("injustice")) ||
      (label.includes("loyalty") && result.tags.includes("betrayal")) ||
      (label.includes("survival") && result.tags.includes("physical_threat")) ||
      (label.includes("recognition") &&
        (result.tags.includes("insult") || result.tags.includes("praise"))) ||
      (label.includes("compassion") && result.tags.includes("loss")) ||
      (label.includes("freedom") && result.tags.includes("control_loss")) ||
      (label.includes("curiosity") && result.tags.includes("novel_stimulus"))
    ) {
      result.valuesEngaged.push(value.id);
    }
  }

  if (result.valuesEngaged.length > 0) {
    const maxValuePriority = Math.max(
      ...state.values.values
        .filter((v) => result.valuesEngaged.includes(v.id))
        .map((v) => v.priority),
    );
    result.personalRelevance = clamp01(
      Math.max(result.personalRelevance, maxValuePriority),
    );
  }

  result.urgency = clamp01(result.urgency);
  result.personalRelevance = clamp01(result.personalRelevance);
  result.emotionalImpact = clampBipolar(result.emotionalImpact);

  return result;
}
