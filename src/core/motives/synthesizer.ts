import type { PersonaState } from "../../state/index";
import type { AppraisalResult } from "../appraisal/appraiser";
import type { PerceptionResult } from "../perception/perceive";
import type { BehaviorEvent } from "../../types/request";
import type { Motive } from "./motive";
import { clamp01 } from "../../types/common";

export function synthesizeMotives(
  state: PersonaState,
  event: BehaviorEvent | undefined,
  appraisal: AppraisalResult,
  perception: PerceptionResult,
): Motive[] {
  const motives: Motive[] = [];
  let idCounter = 0;
  const nextId = () => `motive_${++idCounter}`;

  // --- Need-based motives ---
  for (const need of state.needs.needs) {
    const deprivation = 1 - need.current;
    if (deprivation < 0.3) continue;

    const score = deprivation * need.weight * 100;
    motives.push({
      id: nextId(),
      label: `satisfy_${need.id}`,
      score,
      source: "need",
      sourceId: need.id,
      actionHint: needToAction(need.id),
    });
  }

  // --- Emotion-based motives ---
  for (const emotion of state.emotions.active) {
    if (emotion.intensity < 0.3) continue;

    const motive = emotionToMotive(
      emotion.type,
      emotion.intensity,
      emotion.source,
    );
    if (motive) {
      motives.push({ ...motive, id: nextId() });
    }
  }

  // --- Appraisal-driven motives ---
  if (appraisal.tags.includes("physical_threat")) {
    const fleeScore =
      perception.perceivedThreatLevel *
      (1 - state.traits.core.socialDominance) *
      80;
    const fightScore =
      perception.perceivedThreatLevel * state.traits.core.socialDominance * 70;

    motives.push({
      id: nextId(),
      label: "flee",
      score: fleeScore,
      source: "emotion",
      sourceId: "fear",
      actionHint: "flee",
    });
    motives.push({
      id: nextId(),
      label: "fight",
      score: fightScore,
      source: "emotion",
      sourceId: "anger",
      actionHint: "attack",
      targetId: event?.source,
    });
  }

  if (
    appraisal.tags.includes("insult") ||
    appraisal.tags.includes("social_threat")
  ) {
    const retaliateScore =
      clamp01(
        state.traits.core.socialDominance * 0.4 +
          (1 - state.traits.core.impulseControl) * 0.3 +
          state.traits.core.shameProneness * 0.3,
      ) * 80;

    motives.push({
      id: nextId(),
      label: "retaliate",
      score: retaliateScore,
      source: "emotion",
      sourceId: "anger",
      actionHint: "verbal_retaliation",
      targetId: event?.source,
    });

    const withdrawScore =
      clamp01(
        (1 - state.traits.core.socialDominance) * 0.5 +
          state.traits.core.impulseControl * 0.5,
      ) * 40;

    motives.push({
      id: nextId(),
      label: "withdraw",
      score: withdrawScore,
      source: "emotion",
      sourceId: "shame",
      actionHint: "withdraw",
    });
  }

  if (appraisal.tags.includes("betrayal")) {
    const loyaltyValue = state.values.values.find((v) => v.id === "loyalty");
    const revengeScore = (loyaltyValue?.priority ?? 0.5) * 70;

    motives.push({
      id: nextId(),
      label: "seek_justice",
      score: revengeScore,
      source: "value",
      sourceId: "loyalty",
      actionHint: "confront",
      targetId: event?.source,
    });
  }

  // --- Value-based motives ---
  for (const valueId of appraisal.valuesEngaged) {
    const value = state.values.values.find((v) => v.id === valueId);
    if (!value || value.priority < 0.5) continue;

    const existing = motives.find((m) => m.sourceId === valueId);
    if (existing) {
      existing.score *= 1 + value.priority * 0.3;
      continue;
    }

    motives.push({
      id: nextId(),
      label: `uphold_${valueId}`,
      score: value.priority * 50,
      source: "value",
      sourceId: valueId,
      actionHint: valueToAction(valueId),
    });
  }

  // --- Identity-based motives ---
  if (appraisal.identityThreatened) {
    const activeRole = state.identity.roles.find((r) => r.active);
    if (activeRole) {
      motives.push({
        id: nextId(),
        label: `defend_identity_${activeRole.label}`,
        score: activeRole.salience * 90,
        source: "identity",
        sourceId: activeRole.id,
        actionHint: roleToAction(activeRole.label),
        targetId: event?.source,
      });
    }
  }

  // --- Wound-driven motives ---
  if (appraisal.woundTriggered) {
    const wound = state.wounds.wounds.find(
      (w) => w.id === appraisal.woundTriggered,
    );
    if (wound) {
      motives.push({
        id: nextId(),
        label: `wound_reaction_${wound.label}`,
        score: wound.sensitivity * wound.intensityMultiplier * 40,
        source: "wound",
        sourceId: wound.id,
        actionHint: woundToAction(wound.emotionalResponse),
      });
    }
  }

  // --- Habit-driven motives ---
  for (const habit of state.habits.habits) {
    if (habit.strength < 0.4) continue;
    if (
      event &&
      habit.triggerCondition.toLowerCase().includes(event.category)
    ) {
      motives.push({
        id: nextId(),
        label: `habit_${habit.label}`,
        score: habit.strength * 35,
        source: "habit",
        sourceId: habit.id,
        actionHint: habit.actionId,
      });
    }
  }

  // --- Relationship-based motives ---
  if (event?.source) {
    const rel = state.social.relationships.find(
      (r) => r.targetId === event.source,
    );
    if (rel) {
      if (rel.loyalty > 0.5 && appraisal.tags.includes("physical_threat")) {
        motives.push({
          id: nextId(),
          label: "protect_ally",
          score: rel.loyalty * 85,
          source: "relationship",
          sourceId: rel.targetId,
          actionHint: "protect",
          targetId: rel.targetId,
        });
      }
      if (rel.affection > 0.5 && appraisal.tags.includes("loss")) {
        motives.push({
          id: nextId(),
          label: "comfort_ally",
          score: rel.affection * 60,
          source: "relationship",
          sourceId: rel.targetId,
          actionHint: "comfort",
          targetId: rel.targetId,
        });
      }
    }
  }

  return motives.sort((a, b) => b.score - a.score);
}

function needToAction(needId: string): string {
  const map: Record<string, string> = {
    hunger: "eat",
    fatigue: "rest",
    pain: "seek_healing",
    safety: "seek_safety",
    affiliation: "socialize",
    intimacy: "seek_closeness",
    autonomy: "assert_independence",
    competence: "prove_skill",
    recognition: "seek_recognition",
    curiosity: "investigate",
    control: "take_control",
    rest: "rest",
  };
  return map[needId] ?? "idle";
}

function emotionToMotive(
  type: string,
  intensity: number,
  source?: string,
): Omit<Motive, "id"> | null {
  switch (type) {
    case "fear":
      return {
        label: "escape_danger",
        score: intensity * 75,
        source: "emotion",
        sourceId: "fear",
        actionHint: "flee",
      };
    case "anger":
      return {
        label: "express_anger",
        score: intensity * 65,
        source: "emotion",
        sourceId: "anger",
        actionHint: "confront",
        targetId: source,
      };
    case "guilt":
      return {
        label: "make_amends",
        score: intensity * 50,
        source: "emotion",
        sourceId: "guilt",
        actionHint: "apologize",
      };
    case "loneliness":
      return {
        label: "seek_company",
        score: intensity * 45,
        source: "emotion",
        sourceId: "loneliness",
        actionHint: "socialize",
      };
    default:
      return null;
  }
}

function valueToAction(valueId: string): string {
  const map: Record<string, string> = {
    survival: "seek_safety",
    loyalty: "support_ally",
    justice: "intervene",
    freedom: "resist",
    order: "enforce_rules",
    recognition: "prove_self",
    curiosity: "investigate",
    compassion: "help",
  };
  return map[valueId] ?? "idle";
}

function roleToAction(role: string): string {
  if (role.includes("protector") || role.includes("guardian")) return "protect";
  if (role.includes("leader")) return "take_command";
  if (role.includes("warrior")) return "fight";
  if (role.includes("healer")) return "heal";
  return "assert_role";
}

function woundToAction(emotionalResponse: string): string {
  switch (emotionalResponse) {
    case "anger":
      return "lash_out";
    case "fear":
      return "flee";
    case "shame":
      return "withdraw";
    case "distress":
      return "freeze";
    default:
      return "defensive_reaction";
  }
}
