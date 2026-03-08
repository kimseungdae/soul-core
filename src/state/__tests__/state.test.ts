import { describe, it, expect } from "vitest";
import { createPersonaState } from "../index";

describe("createPersonaState", () => {
  it("should create a state with all 11 layers", () => {
    const state = createPersonaState("npc-001");

    expect(state.id).toBe("npc-001");
    expect(state.tick).toBe(0);
    expect(state.traits).toBeDefined();
    expect(state.values).toBeDefined();
    expect(state.identity).toBeDefined();
    expect(state.needs).toBeDefined();
    expect(state.emotions).toBeDefined();
    expect(state.social).toBeDefined();
    expect(state.memory).toBeDefined();
    expect(state.interest).toBeDefined();
    expect(state.wounds).toBeDefined();
    expect(state.habits).toBeDefined();
    expect(state.narrative).toBeDefined();
  });

  it("should initialize Big Five traits to 0.5", () => {
    const state = createPersonaState("test");
    const { bigFive } = state.traits;

    expect(bigFive.openness).toBe(0.5);
    expect(bigFive.conscientiousness).toBe(0.5);
    expect(bigFive.extraversion).toBe(0.5);
    expect(bigFive.agreeableness).toBe(0.5);
    expect(bigFive.neuroticism).toBe(0.5);
  });

  it("should initialize 12 core traits to 0.5", () => {
    const state = createPersonaState("test");
    const { core } = state.traits;

    expect(core.threatSensitivity).toBe(0.5);
    expect(core.noveltySeeking).toBe(0.5);
    expect(core.impulseControl).toBe(0.5);
    expect(core.attachmentSecurity).toBe(0.5);
  });

  it("should have default needs", () => {
    const state = createPersonaState("test");
    expect(state.needs.needs.length).toBeGreaterThan(0);

    for (const need of state.needs.needs) {
      expect(need.current).toBeGreaterThanOrEqual(0);
      expect(need.current).toBeLessThanOrEqual(1);
    }
  });

  it("should have default values", () => {
    const state = createPersonaState("test");
    expect(state.values.values.length).toBeGreaterThan(0);

    for (const value of state.values.values) {
      expect(value.priority).toBeGreaterThanOrEqual(0);
      expect(value.priority).toBeLessThanOrEqual(1);
    }
  });

  it("should start with empty relationships", () => {
    const state = createPersonaState("test");
    expect(state.social.relationships).toHaveLength(0);
  });

  it("should start with empty memories", () => {
    const state = createPersonaState("test");
    expect(state.memory.memories).toHaveLength(0);
    expect(state.memory.capacity).toBe(200);
  });

  it("should accept custom tick", () => {
    const state = createPersonaState("test", 100);
    expect(state.tick).toBe(100);
  });

  it("should create independent instances", () => {
    const a = createPersonaState("a");
    const b = createPersonaState("b");

    a.traits.bigFive.openness = 0.9;
    expect(b.traits.bigFive.openness).toBe(0.5);
  });
});
