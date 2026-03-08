import { describe, it, expect } from "vitest";
import { hydratePersona } from "../../seed/hydrate";
import { processBehavior } from "../pipeline";
import type { PersonaSeed } from "../../seed/persona-seed";
import type { BehaviorRequest } from "../../types/request";

const WARRIOR_SEED: PersonaSeed = {
  version: 1,
  id: "warrior-001",
  name: "Kael",
  bigFive: [0.3, 0.8, 0.6, 0.4, 0.7],
  coreValues: ["loyalty", "justice", "survival"],
  selfConcept: "I am a protector of the weak",
  roles: ["warrior", "guardian"],
  temperament: { valence: -0.1, arousal: 0.5 },
  relationships: [
    {
      targetId: "ally-001",
      tags: ["ally", "friend"],
      trust: 0.8,
      affection: 0.7,
    },
  ],
  wounds: [
    {
      label: "betrayal",
      trigger: "betrayal or backstabbing",
      sensitivity: 0.8,
      emotionalResponse: "anger",
    },
  ],
};

const SCHOLAR_SEED: PersonaSeed = {
  version: 1,
  id: "scholar-001",
  name: "Lyra",
  bigFive: [0.9, 0.6, 0.3, 0.7, 0.3],
  coreValues: ["curiosity", "compassion", "freedom"],
  selfConcept: "I seek truth above all",
  roles: ["scholar", "healer"],
  temperament: { valence: 0.2, arousal: 0.3 },
};

describe("processBehavior - E2E Pipeline", () => {
  it("should produce a complete BehaviorResponse", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 100,
      type: "event",
      event: {
        category: "social",
        action: "insulted_by",
        source: "npc-enemy",
        context: { location: "tavern", severity: 0.7, witnesses: ["ally-001"] },
      },
      worldState: {
        nearbyEntities: ["npc-enemy", "ally-001"],
        safeZone: true,
      },
    };

    const response = processBehavior(state, request);

    // Response structure
    expect(response.personaId).toBe("warrior-001");
    expect(response.tick).toBe(100);
    expect(response.action).toBeDefined();
    expect(response.action.type).toBeTruthy();
    expect(response.action.intensity).toBeGreaterThan(0);
    expect(response.internalStateChanges).toBeDefined();
    expect(response.trace).toBeDefined();
    expect(response.trace.appraisal).toBeTruthy();
    expect(response.trace.dominantMotive).toBeTruthy();
  });

  it("should produce different responses for different personas", () => {
    const warrior = hydratePersona(WARRIOR_SEED);
    const scholar = hydratePersona(SCHOLAR_SEED);

    const request: BehaviorRequest = {
      personaId: "",
      tick: 100,
      type: "event",
      event: {
        category: "social",
        action: "insulted_by",
        source: "npc-enemy",
        context: { severity: 0.7 },
      },
      worldState: {
        nearbyEntities: ["npc-enemy"],
        safeZone: true,
      },
    };

    const warriorResponse = processBehavior(warrior, {
      ...request,
      personaId: "warrior-001",
    });
    const scholarResponse = processBehavior(scholar, {
      ...request,
      personaId: "scholar-001",
    });

    // Different personas should have different dominant motives or actions
    const sameAction =
      warriorResponse.action.type === scholarResponse.action.type;
    const sameIntensity =
      Math.abs(
        warriorResponse.action.intensity - scholarResponse.action.intensity,
      ) < 0.05;

    // At least one of these should differ
    expect(sameAction && sameIntensity).toBe(false);
  });

  it("should be deterministic (same input = same output)", () => {
    const state1 = hydratePersona(WARRIOR_SEED);
    const state2 = hydratePersona(WARRIOR_SEED);

    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 100,
      type: "event",
      event: {
        category: "combat",
        action: "attacked_by",
        source: "enemy-001",
        context: { severity: 0.8 },
      },
      worldState: {
        nearbyEntities: ["enemy-001"],
        safeZone: false,
      },
    };

    const r1 = processBehavior(state1, request, { mutateState: false });
    const r2 = processBehavior(state2, request, { mutateState: false });

    expect(r1.action.type).toBe(r2.action.type);
    expect(r1.action.intensity).toBe(r2.action.intensity);
    expect(r1.trace.dominantMotive).toBe(r2.trace.dominantMotive);
  });

  it("should update state when mutateState=true", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const initialTick = state.tick;

    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 200,
      type: "event",
      event: {
        category: "social",
        action: "insulted_by",
        source: "npc-enemy",
        context: { severity: 0.7, location: "market" },
      },
      worldState: {
        nearbyEntities: ["npc-enemy"],
        safeZone: true,
      },
    };

    processBehavior(state, request, { mutateState: true });

    expect(state.tick).toBe(200);
    expect(state.emotions.active.length).toBeGreaterThan(0);
  });

  it("should not mutate state when mutateState=false", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const initialTick = state.tick;
    const initialEmotionCount = state.emotions.active.length;

    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 300,
      type: "event",
      event: {
        category: "social",
        action: "insulted_by",
        source: "npc-enemy",
        context: { severity: 0.7 },
      },
      worldState: {
        nearbyEntities: ["npc-enemy"],
        safeZone: true,
      },
    };

    processBehavior(state, request, { mutateState: false });

    expect(state.tick).toBe(initialTick);
    expect(state.emotions.active.length).toBe(initialEmotionCount);
  });

  it("should include trace with explanation", () => {
    const state = hydratePersona(WARRIOR_SEED);

    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 100,
      type: "event",
      event: {
        category: "social",
        action: "betrayed_by",
        source: "ally-001",
        context: { severity: 0.9 },
      },
      worldState: {
        nearbyEntities: ["ally-001"],
        safeZone: false,
      },
    };

    const response = processBehavior(state, request);

    expect(response.trace.appraisal).toContain("betrayal");
    expect(response.internalStateChanges.emotions.length).toBeGreaterThan(0);

    // Wound should be activated for betrayal
    expect(response.internalStateChanges.woundActivated).toBeDefined();
  });

  it("should handle event-less tick updates", () => {
    const state = hydratePersona(WARRIOR_SEED);

    const request: BehaviorRequest = {
      personaId: "warrior-001",
      tick: 50,
      type: "tick_update",
      worldState: {
        nearbyEntities: [],
      },
    };

    const response = processBehavior(state, request);

    expect(response.action).toBeDefined();
    expect(response.personaId).toBe("warrior-001");
  });
});
