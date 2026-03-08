import { describe, it, expect } from "vitest";
import { createTraceLog, addTraceEntry } from "../index";

describe("TraceLog", () => {
  it("should create an empty trace log", () => {
    const log = createTraceLog("npc-001", 0);

    expect(log.personaId).toBe("npc-001");
    expect(log.startTick).toBe(0);
    expect(log.endTick).toBe(0);
    expect(log.entries).toHaveLength(0);
  });

  it("should add trace entries", () => {
    const log = createTraceLog("npc-001", 0);

    const entry = addTraceEntry(
      log,
      "perception",
      { event: "enemy_spotted" },
      1,
    );

    expect(log.entries).toHaveLength(1);
    expect(entry.event).toBe("perception");
    expect(entry.tick).toBe(1);
    expect(entry.personaId).toBe("npc-001");
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it("should update endTick", () => {
    const log = createTraceLog("npc-001", 0);

    addTraceEntry(log, "perception", {}, 5);
    addTraceEntry(log, "appraisal", {}, 10);

    expect(log.endTick).toBe(10);
  });

  it("should generate unique entry ids", () => {
    const log = createTraceLog("npc-001", 0);

    const a = addTraceEntry(log, "perception", {}, 1);
    const b = addTraceEntry(log, "appraisal", {}, 2);

    expect(a.id).not.toBe(b.id);
  });
});
