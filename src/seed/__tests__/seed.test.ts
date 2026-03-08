import { describe, it, expect } from "vitest";
import { hydratePersona } from "../hydrate";
import type { PersonaSeed } from "../persona-seed";

const TEST_SEED: PersonaSeed = {
  version: 1,
  id: "warrior-001",
  name: "Kael",
  bigFive: [0.3, 0.8, 0.6, 0.4, 0.7],
  coreValues: ["loyalty", "justice", "survival"],
  selfConcept: "I am a protector of the weak",
  roles: ["warrior", "guardian", "exile"],
  groups: ["mountain_clan"],
  needOverrides: { hunger: 0.3, safety: 0.9 },
  temperament: { valence: -0.2, arousal: 0.6 },
  relationships: [
    {
      targetId: "npc-002",
      tags: ["ally", "friend"],
      trust: 0.8,
      affection: 0.6,
    },
  ],
  backstory: [
    {
      description: "Exiled from homeland after false accusation",
      emotionalValence: -0.8,
      importance: 0.9,
    },
    {
      description: "Saved a child from bandits on the road",
      emotionalValence: 0.5,
      importance: 0.7,
    },
  ],
  interests: [{ topic: "swordsmanship", level: 0.9 }],
  wounds: [
    {
      label: "betrayal",
      trigger: "false accusation or backstabbing",
      sensitivity: 0.8,
      emotionalResponse: "anger",
    },
  ],
  habits: [
    {
      label: "patrol_at_dawn",
      triggerCondition: "morning",
      actionId: "patrol",
      strength: 0.7,
    },
  ],
  arc: "redemption",
  beliefAboutSelf: "I must earn back my honor",
  beliefAboutWorld: "The world punishes the trusting",
};

describe("hydratePersona", () => {
  it("should map Big Five from tuple", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.traits.bigFive.openness).toBe(0.3);
    expect(state.traits.bigFive.conscientiousness).toBe(0.8);
    expect(state.traits.bigFive.extraversion).toBe(0.6);
    expect(state.traits.bigFive.agreeableness).toBe(0.4);
    expect(state.traits.bigFive.neuroticism).toBe(0.7);
  });

  it("should derive core traits from Big Five when not provided", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.traits.core.threatSensitivity).toBeGreaterThan(0.5);
    expect(state.traits.core.impulseControl).toBeGreaterThan(0.5);
    expect(state.traits.core.noveltySeeking).toBeLessThan(0.5);
  });

  it("should set identity", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.identity.name).toBe("Kael");
    expect(state.identity.selfConcept).toBe("I am a protector of the weak");
    expect(state.identity.roles).toHaveLength(3);
    expect(state.identity.roles[0].label).toBe("warrior");
    expect(state.identity.roles[0].active).toBe(true);
    expect(state.identity.groupAffiliations).toContain("mountain_clan");
  });

  it("should map core values to Schwartz categories", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.values.values).toHaveLength(3);
    expect(state.values.values[0].category).toBe("benevolence");
    expect(state.values.values[0].priority).toBe(1.0);
    expect(state.values.values[1].category).toBe("universalism");
  });

  it("should apply need overrides", () => {
    const state = hydratePersona(TEST_SEED);

    const hunger = state.needs.needs.find((n) => n.id === "hunger");
    const safety = state.needs.needs.find((n) => n.id === "safety");

    expect(hunger?.current).toBe(0.3);
    expect(safety?.current).toBe(0.9);
  });

  it("should set temperament and mood", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.emotions.temperament.valence).toBe(-0.2);
    expect(state.emotions.temperament.arousal).toBe(0.6);
    expect(state.emotions.mood.valence).toBe(-0.2);
  });

  it("should create relationships", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.social.relationships).toHaveLength(1);
    const rel = state.social.relationships[0];
    expect(rel.targetId).toBe("npc-002");
    expect(rel.trust).toBe(0.8);
    expect(rel.affection).toBe(0.6);
    expect(rel.loyalty).toBeGreaterThan(0);
  });

  it("should convert backstory to episodic memories", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.memory.memories).toHaveLength(2);
    const mem = state.memory.memories[0];
    expect(mem.type).toBe("episodic");
    if (mem.type === "episodic") {
      expect(mem.emotionalValence).toBe(-0.8);
      expect(mem.importance).toBe(0.9);
    }
  });

  it("should create interests", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.interest.interests).toHaveLength(1);
    expect(state.interest.interests[0].topic).toBe("swordsmanship");
    expect(state.interest.interests[0].level).toBe(0.9);
  });

  it("should create wounds", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.wounds.wounds).toHaveLength(1);
    expect(state.wounds.wounds[0].label).toBe("betrayal");
    expect(state.wounds.wounds[0].sensitivity).toBe(0.8);
    expect(state.wounds.wounds[0].healing).toBe(0);
    expect(state.wounds.wounds[0].intensityMultiplier).toBe(2.0);
  });

  it("should create habits", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.habits.habits).toHaveLength(1);
    expect(state.habits.habits[0].label).toBe("patrol_at_dawn");
    expect(state.habits.habits[0].strength).toBe(0.7);
  });

  it("should set narrative", () => {
    const state = hydratePersona(TEST_SEED);

    expect(state.narrative.currentArc.arc).toBe("redemption");
    expect(state.narrative.beliefAboutSelf).toBe("I must earn back my honor");
    expect(state.narrative.beliefAboutWorld).toBe(
      "The world punishes the trusting",
    );
  });

  it("should clamp out-of-range values", () => {
    const seed: PersonaSeed = {
      ...TEST_SEED,
      bigFive: [1.5, -0.2, 0.5, 0.5, 0.5],
    };
    const state = hydratePersona(seed);

    expect(state.traits.bigFive.openness).toBe(1);
    expect(state.traits.bigFive.conscientiousness).toBe(0);
  });
});
