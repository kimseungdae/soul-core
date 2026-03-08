import type { PersonaSeed } from "./persona-seed";
import type { PersonaState } from "../state/index";
import type { CoreTraits } from "../state/traits";
import type { ValueEntry, SchwartzValue } from "../state/values";
import { createPersonaState } from "../state/index";
import { generateId, clamp01, clampBipolar } from "../types/common";

const VALUE_MAP: Record<string, SchwartzValue> = {
  survival: "security",
  loyalty: "benevolence",
  justice: "universalism",
  freedom: "self-direction",
  order: "conformity",
  recognition: "achievement",
  curiosity: "stimulation",
  compassion: "benevolence",
  power: "power",
  tradition: "tradition",
  pleasure: "hedonism",
};

export function hydratePersona(seed: PersonaSeed): PersonaState {
  const state = createPersonaState(seed.id);

  // Big Five
  const [o, c, e, a, n] = seed.bigFive;
  state.traits.bigFive = {
    openness: clamp01(o),
    conscientiousness: clamp01(c),
    extraversion: clamp01(e),
    agreeableness: clamp01(a),
    neuroticism: clamp01(n),
  };

  // Core Traits
  if (seed.coreTraits) {
    const ct = state.traits.core;
    for (const [key, value] of Object.entries(seed.coreTraits)) {
      if (key in ct && value !== undefined) {
        (ct as unknown as Record<string, number>)[key] = clamp01(value);
      }
    }
  }

  // Derive core traits from Big Five when not explicitly set
  if (!seed.coreTraits) {
    deriveCoreTraitsFromBigFive(state);
  }

  // Identity
  state.identity.name = seed.name;
  state.identity.selfConcept = seed.selfConcept;
  state.identity.roles = seed.roles.map((label, i) => ({
    id: `role_${i}`,
    label,
    salience: 1 - i * 0.1,
    active: i === 0,
  }));
  state.identity.groupAffiliations = seed.groups ?? [];

  // Values
  if (seed.coreValues.length > 0) {
    state.values.values = seed.coreValues.map((label, i) => {
      const category =
        VALUE_MAP[label.toLowerCase()] ??
        ("custom" as SchwartzValue | "custom");
      return {
        id: label.toLowerCase(),
        category,
        label,
        priority: clamp01(1 - i * 0.1),
        rigidity: 0.5,
      } satisfies ValueEntry;
    });
  }

  // Need overrides
  if (seed.needOverrides) {
    for (const [id, value] of Object.entries(seed.needOverrides)) {
      const need = state.needs.needs.find((n) => n.id === id);
      if (need) {
        need.current = clamp01(value);
      }
    }
  }

  // Temperament
  state.emotions.temperament = {
    valence: clampBipolar(seed.temperament.valence),
    arousal: clamp01(seed.temperament.arousal),
  };
  state.emotions.mood = { ...state.emotions.temperament };

  // Relationships
  if (seed.relationships) {
    state.social.relationships = seed.relationships.map((r) => ({
      targetId: r.targetId,
      tags: r.tags,
      trust: clampBipolar(r.trust),
      familiarity: 0.5,
      affection: clampBipolar(r.affection),
      respect: 0,
      fear: 0,
      admiration: 0,
      resentment: 0,
      loyalty: r.trust > 0 ? r.trust * 0.5 : 0,
      obligation: 0,
      rivalry: 0,
      comfort: r.affection > 0 ? r.affection * 0.3 : 0,
      dependency: 0,
      perceivedStatus: 0,
      lastInteraction: 0,
    }));
  }

  // Backstory → Episodic memories
  if (seed.backstory) {
    state.memory.memories = seed.backstory.map((b, i) => ({
      type: "episodic" as const,
      id: generateId("mem"),
      description: b.description,
      participants: [],
      emotionalValence: clampBipolar(b.emotionalValence),
      importance: clamp01(b.importance),
      tick: -(seed.backstory!.length - i),
      decayRate: 0.001,
    }));
  }

  // Interests
  if (seed.interests) {
    state.interest.interests = seed.interests.map((i) => ({
      topic: i.topic,
      level: clamp01(i.level),
      curiosity: clamp01(i.level * 0.8),
      experience: clamp01(i.level * 0.5),
    }));
  }

  // Wounds
  if (seed.wounds) {
    state.wounds.wounds = seed.wounds.map((w, i) => ({
      id: `wound_${i}`,
      label: w.label,
      trigger: w.trigger,
      sensitivity: clamp01(w.sensitivity),
      healing: 0,
      emotionalResponse: w.emotionalResponse,
      intensityMultiplier: 2.0,
    }));
  }

  // Habits
  if (seed.habits) {
    state.habits.habits = seed.habits.map((h, i) => ({
      id: `habit_${i}`,
      label: h.label,
      triggerCondition: h.triggerCondition,
      actionId: h.actionId,
      strength: clamp01(h.strength),
      reinforcement: 0.05,
      lastFired: -1,
    }));
  }

  // Narrative
  if (seed.arc) {
    state.narrative.currentArc.arc = seed.arc;
  }
  if (seed.beliefAboutSelf) {
    state.narrative.beliefAboutSelf = seed.beliefAboutSelf;
  }
  if (seed.beliefAboutWorld) {
    state.narrative.beliefAboutWorld = seed.beliefAboutWorld;
  }

  return state;
}

function deriveCoreTraitsFromBigFive(state: PersonaState): void {
  const {
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism,
  } = state.traits.bigFive;
  const core: CoreTraits = {
    threatSensitivity: clamp01(neuroticism * 0.7 + (1 - agreeableness) * 0.3),
    noveltySeeking: clamp01(openness * 0.6 + extraversion * 0.4),
    socialDominance: clamp01(extraversion * 0.5 + (1 - agreeableness) * 0.5),
    impulseControl: clamp01(conscientiousness * 0.7 + (1 - neuroticism) * 0.3),
    emotionalVolatility: clamp01(
      neuroticism * 0.8 + (1 - conscientiousness) * 0.2,
    ),
    ambiguityTolerance: clamp01(openness * 0.6 + (1 - neuroticism) * 0.4),
    shameProneness: clamp01(
      neuroticism * 0.5 + agreeableness * 0.3 + (1 - extraversion) * 0.2,
    ),
    trustBaseline: clamp01(agreeableness * 0.6 + (1 - neuroticism) * 0.4),
    moralRigidity: clamp01(conscientiousness * 0.5 + (1 - openness) * 0.5),
    empathyCognitive: clamp01(openness * 0.4 + agreeableness * 0.6),
    empathyAffective: clamp01(
      agreeableness * 0.5 + neuroticism * 0.3 + (1 - conscientiousness) * 0.2,
    ),
    attachmentSecurity: clamp01(
      (1 - neuroticism) * 0.5 + agreeableness * 0.3 + extraversion * 0.2,
    ),
  };
  state.traits.core = core;
}
