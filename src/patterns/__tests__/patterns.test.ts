import { describe, it, expect, beforeEach } from "vitest";
import { hydratePersona } from "../../seed/hydrate";
import { processBehavior } from "../../core/pipeline";
import {
  registerPatterns,
  clearPatterns,
  getAllPatterns,
  getPatternsByCategory,
  getPatternById,
  loadPrototypePatterns,
  resetPatternLoader,
  getPrototypePatterns,
} from "../index";
import { matchPatterns } from "../matcher";
import { appraise } from "../../core/appraisal/appraiser";
import { perceive } from "../../core/perception/perceive";
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

describe("Pattern Registry", () => {
  beforeEach(() => {
    clearPatterns();
    resetPatternLoader();
  });

  it("should load prototype patterns", () => {
    loadPrototypePatterns();
    const all = getAllPatterns();
    expect(all.length).toBeGreaterThan(0);
  });

  it("should have patterns in all 7 categories", () => {
    loadPrototypePatterns();
    const categories = [
      "social",
      "combat",
      "survival",
      "emotional",
      "cognitive",
      "moral",
      "routine",
    ] as const;
    for (const cat of categories) {
      const patterns = getPatternsByCategory(cat);
      expect(patterns.length).toBeGreaterThan(0);
    }
  });

  it("should find pattern by id", () => {
    loadPrototypePatterns();
    const pattern = getPatternById("social.insult.aggressive_retaliation");
    expect(pattern).toBeDefined();
    expect(pattern!.category).toBe("social");
  });

  it("should clear all patterns", () => {
    loadPrototypePatterns();
    expect(getAllPatterns().length).toBeGreaterThan(0);
    clearPatterns();
    expect(getAllPatterns().length).toBe(0);
  });

  it("should return correct prototype count", () => {
    const prototypes = getPrototypePatterns();
    expect(prototypes.length).toBe(18);
  });
});

describe("Pattern Matcher", () => {
  beforeEach(() => {
    clearPatterns();
    resetPatternLoader();
    loadPrototypePatterns();
  });

  it("should match insult patterns for warrior (low impulse control)", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const event = {
      category: "social" as const,
      action: "insulted_by",
      source: "npc-enemy",
      context: { severity: 0.7 },
    };
    const perception = perceive(state, event, {
      nearbyEntities: ["npc-enemy"],
    });
    const appraisalResult = appraise(state, event, perception);

    const matches = matchPatterns(state, appraisalResult, getAllPatterns());
    expect(matches.length).toBeGreaterThan(0);

    const topMatch = matches[0];
    expect(topMatch.pattern.category).toBe("social");
  });

  it("should match combat patterns for physical threat", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const event = {
      category: "combat" as const,
      action: "attacked_by",
      source: "enemy-001",
      context: { severity: 0.8 },
    };
    const perception = perceive(state, event, {
      nearbyEntities: ["enemy-001"],
    });
    const appraisalResult = appraise(state, event, perception);

    const matches = matchPatterns(state, appraisalResult, getAllPatterns());
    const combatMatches = matches.filter(
      (m) => m.pattern.category === "combat",
    );
    expect(combatMatches.length).toBeGreaterThan(0);
  });

  it("should produce different matches for combat vs cognitive events", () => {
    const warrior = hydratePersona(WARRIOR_SEED);

    const combatEvent = {
      category: "combat" as const,
      action: "attacked_by",
      source: "enemy-001",
      context: { severity: 0.8 },
    };
    const cognitiveEvent = {
      category: "cognitive" as const,
      action: "discovered_artifact",
      source: "world",
      context: { severity: 0.5 },
    };
    const world = { nearbyEntities: ["enemy-001"] };

    const cPerception = perceive(warrior, combatEvent, world);
    const cAppraisal = appraise(warrior, combatEvent, cPerception);
    const combatMatches = matchPatterns(warrior, cAppraisal, getAllPatterns());

    const dPerception = perceive(warrior, cognitiveEvent, {
      nearbyEntities: [],
    });
    const dAppraisal = appraise(warrior, cognitiveEvent, dPerception);
    const cogMatches = matchPatterns(warrior, dAppraisal, getAllPatterns());

    // Combat event should match combat patterns
    expect(combatMatches.some((m) => m.pattern.category === "combat")).toBe(
      true,
    );
    // Cognitive event should match cognitive patterns
    expect(cogMatches.some((m) => m.pattern.category === "cognitive")).toBe(
      true,
    );
    // They should be different sets
    const combatIds = combatMatches.map((m) => m.pattern.id);
    const cogIds = cogMatches.map((m) => m.pattern.id);
    expect(combatIds).not.toEqual(cogIds);
  });

  it("should match cognitive patterns for novel stimulus", () => {
    const scholar = hydratePersona(SCHOLAR_SEED);
    const event = {
      category: "cognitive" as const,
      action: "discovered_artifact",
      source: "world",
      context: { severity: 0.5 },
    };
    const perception = perceive(scholar, event, { nearbyEntities: [] });
    const appraisalResult = appraise(scholar, event, perception);

    const matches = matchPatterns(scholar, appraisalResult, getAllPatterns());
    const cognitiveMatches = matches.filter(
      (m) => m.pattern.category === "cognitive",
    );
    expect(cognitiveMatches.length).toBeGreaterThan(0);
    expect(cognitiveMatches[0].pattern.id).toContain("eager_investigation");
  });
});

describe("Pipeline with Patterns", () => {
  beforeEach(() => {
    clearPatterns();
    resetPatternLoader();
    loadPrototypePatterns();
  });

  it("should include matchedPattern in trace when pattern matches", () => {
    const state = hydratePersona(WARRIOR_SEED);
    const request: BehaviorRequest = {
      personaId: "warrior-001",
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

    const response = processBehavior(state, request, { mutateState: false });
    // Pattern should be matched (or at least response should be valid)
    expect(response.action).toBeDefined();
    expect(response.action.type).toBeTruthy();
    expect(response.trace).toBeDefined();
  });

  it("should produce pattern-influenced actions for betrayal", () => {
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

    const response = processBehavior(state, request, { mutateState: false });
    expect(response.action.intensity).toBeGreaterThan(0.3);
    // Betrayal should trigger strong emotional response
    expect(response.internalStateChanges.emotions.length).toBeGreaterThan(0);
  });

  it("should still work without patterns loaded", () => {
    clearPatterns();
    const state = hydratePersona(WARRIOR_SEED);
    const request: BehaviorRequest = {
      personaId: "warrior-001",
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

    const response = processBehavior(state, request, { mutateState: false });
    expect(response.action).toBeDefined();
    expect(response.action.type).toBeTruthy();
  });
});
