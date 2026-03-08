import type { PersonaState } from "../state/index";
import type { Motive } from "../core/motives/motive";
import type { AppraisalResult } from "../core/appraisal/appraiser";
import type { ActionResult } from "../types/response";
import type { BehaviorEvent } from "../types/request";
import type {
  InternalStateChanges,
  EmotionChange,
  RelationshipUpdate,
  NeedChange,
  MemoryFormed,
} from "../types/response";
import type { EmotionType } from "../state/emotions";
import { clamp01, clampBipolar, generateId } from "../types/common";

export function computeStateChanges(
  state: PersonaState,
  action: ActionResult,
  selectedMotive: Motive,
  appraisal: AppraisalResult,
  event: BehaviorEvent | undefined,
  tick: number,
): InternalStateChanges {
  const emotions: EmotionChange[] = [];
  const relationshipUpdates: RelationshipUpdate[] = [];
  const needChanges: NeedChange[] = [];
  let memoryFormed: MemoryFormed | undefined;
  let woundActivated: string | undefined;
  let habitFired: string | undefined;

  // --- Emotion generation from appraisal ---
  if (appraisal.emotionalImpact < -0.3) {
    if (appraisal.tags.includes("physical_threat")) {
      emotions.push({
        type: "fear",
        intensity: Math.abs(appraisal.emotionalImpact),
        source: event?.source ?? "event",
      });
    }
    if (
      appraisal.tags.includes("insult") ||
      appraisal.tags.includes("social_threat")
    ) {
      emotions.push({
        type: "anger",
        intensity: Math.abs(appraisal.emotionalImpact) * 0.8,
        source: event?.source ?? "event",
      });
      if (state.traits.core.shameProneness > 0.5) {
        emotions.push({
          type: "shame",
          intensity:
            state.traits.core.shameProneness *
            Math.abs(appraisal.emotionalImpact),
          source: "event",
        });
      }
    }
    if (appraisal.tags.includes("betrayal")) {
      emotions.push({
        type: "anger",
        intensity: 0.8,
        source: event?.source ?? "event",
      });
      emotions.push({
        type: "distress",
        intensity: 0.6,
        source: event?.source ?? "event",
      });
    }
    if (
      appraisal.tags.includes("loss") ||
      appraisal.tags.includes("abandonment")
    ) {
      emotions.push({
        type: "distress",
        intensity: 0.7,
        source: event?.source ?? "event",
      });
      emotions.push({ type: "loneliness", intensity: 0.5, source: "event" });
    }
  } else if (appraisal.emotionalImpact > 0.3) {
    if (appraisal.tags.includes("praise")) {
      emotions.push({
        type: "pride",
        intensity: appraisal.emotionalImpact,
        source: event?.source ?? "event",
      });
      emotions.push({
        type: "joy",
        intensity: appraisal.emotionalImpact * 0.5,
        source: "event",
      });
    }
    if (appraisal.tags.includes("opportunity")) {
      emotions.push({
        type: "hope",
        intensity: appraisal.emotionalImpact * 0.6,
        source: "event",
      });
    }
  }

  // --- Relationship updates ---
  if (event?.source) {
    const update: RelationshipUpdate = { targetId: event.source };

    if (appraisal.tags.includes("betrayal")) {
      update.trust = -0.3;
      update.respect = -0.2;
    } else if (appraisal.tags.includes("insult")) {
      update.trust = -0.1;
      update.respect = -0.15;
      update.affection = -0.1;
    } else if (appraisal.tags.includes("praise")) {
      update.trust = 0.05;
      update.respect = 0.1;
      update.affection = 0.1;
    }

    if (
      update.trust !== undefined ||
      update.respect !== undefined ||
      update.affection !== undefined
    ) {
      relationshipUpdates.push(update);
    }
  }

  // --- Need changes ---
  if (action.type === "flee" || action.type === "attack") {
    needChanges.push({ id: "fatigue", delta: -0.1 });
    needChanges.push({
      id: "safety",
      delta: action.type === "flee" ? 0.1 : -0.15,
    });
  }
  if (appraisal.tags.includes("insult")) {
    needChanges.push({ id: "recognition", delta: -0.2 });
  }
  if (appraisal.tags.includes("praise")) {
    needChanges.push({ id: "recognition", delta: 0.15 });
  }

  // --- Memory formation ---
  if (appraisal.personalRelevance > 0.4 && event) {
    memoryFormed = {
      description: `${event.action} by ${event.source ?? "unknown"} at ${event.context.location ?? "unknown location"}`,
      emotionalValence: appraisal.emotionalImpact,
      importance: appraisal.personalRelevance,
    };
  }

  // --- Wound activation ---
  if (appraisal.woundTriggered) {
    woundActivated = appraisal.woundTriggered;
  }

  // --- Habit firing ---
  if (selectedMotive.source === "habit") {
    habitFired = selectedMotive.sourceId;
  }

  return {
    emotions,
    relationshipUpdates,
    needChanges,
    memoryFormed,
    woundActivated,
    habitFired,
  };
}

export function applyStateChanges(
  state: PersonaState,
  changes: InternalStateChanges,
  tick: number,
): void {
  // Apply emotions
  for (const ec of changes.emotions) {
    state.emotions.active.push({
      type: ec.type as EmotionType,
      intensity: clamp01(ec.intensity),
      decay: 0.05,
      source: ec.source,
      timestamp: tick,
    });
  }

  // Update mood based on new emotions
  if (changes.emotions.length > 0) {
    const avgImpact =
      changes.emotions.reduce((sum, e) => {
        const sign = [
          "joy",
          "pride",
          "hope",
          "relief",
          "gratitude",
          "admiration",
          "satisfaction",
          "affection",
        ].includes(e.type)
          ? 1
          : -1;
        return sum + sign * e.intensity;
      }, 0) / changes.emotions.length;
    state.emotions.mood.valence = clampBipolar(
      state.emotions.mood.valence + avgImpact * 0.3,
    );
    state.emotions.mood.arousal = clamp01(state.emotions.mood.arousal + 0.1);
  }

  // Apply relationship updates
  for (const ru of changes.relationshipUpdates) {
    let rel = state.social.relationships.find(
      (r) => r.targetId === ru.targetId,
    );
    if (!rel) {
      rel = {
        targetId: ru.targetId,
        tags: ["acquaintance"],
        trust: 0,
        familiarity: 0.1,
        affection: 0,
        respect: 0,
        fear: 0,
        admiration: 0,
        resentment: 0,
        loyalty: 0,
        obligation: 0,
        rivalry: 0,
        comfort: 0,
        dependency: 0,
        perceivedStatus: 0,
        lastInteraction: tick,
      };
      state.social.relationships.push(rel);
    }
    if (ru.trust !== undefined) rel.trust = clampBipolar(rel.trust + ru.trust);
    if (ru.affection !== undefined)
      rel.affection = clampBipolar(rel.affection + ru.affection);
    if (ru.respect !== undefined)
      rel.respect = clampBipolar(rel.respect + ru.respect);
    if (ru.familiarity !== undefined)
      rel.familiarity = clamp01(rel.familiarity + ru.familiarity);
    rel.lastInteraction = tick;
  }

  // Apply need changes
  for (const nc of changes.needChanges) {
    const need = state.needs.needs.find((n) => n.id === nc.id);
    if (need) {
      need.current = clamp01(need.current + nc.delta);
    }
  }

  // Form memory
  if (changes.memoryFormed) {
    state.memory.memories.push({
      type: "episodic",
      id: generateId("mem"),
      description: changes.memoryFormed.description,
      participants: [],
      emotionalValence: changes.memoryFormed.emotionalValence,
      importance: changes.memoryFormed.importance,
      tick,
      decayRate: 0.002,
    });

    // Prune if over capacity
    if (state.memory.memories.length > state.memory.capacity) {
      state.memory.memories.sort((a, b) => {
        const aImp = a.type === "episodic" ? a.importance : a.confidence;
        const bImp = b.type === "episodic" ? b.importance : b.confidence;
        return bImp - aImp;
      });
      state.memory.memories = state.memory.memories.slice(
        0,
        state.memory.capacity,
      );
    }
  }

  // Reinforce habit
  if (changes.habitFired) {
    const habit = state.habits.habits.find((h) => h.id === changes.habitFired);
    if (habit) {
      habit.strength = clamp01(habit.strength + habit.reinforcement);
      habit.lastFired = tick;
    }
  }

  // Update tick
  state.tick = tick;
}
