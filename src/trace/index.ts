import type { EntityId, Tick } from "../types/common";
import type { TraceEntry, TraceLog, TraceEventType } from "./types";
import { generateId } from "../types/common";

export function createTraceLog(personaId: EntityId, startTick: Tick): TraceLog {
  return {
    personaId,
    startTick,
    endTick: startTick,
    entries: [],
  };
}

export function addTraceEntry(
  log: TraceLog,
  event: TraceEventType,
  data: Record<string, unknown>,
  tick: Tick,
): TraceEntry {
  const entry: TraceEntry = {
    id: generateId("trace"),
    tick,
    timestamp: Date.now(),
    personaId: log.personaId,
    event,
    data,
  };
  log.entries.push(entry);
  log.endTick = tick;
  return entry;
}

export type {
  TraceEntry,
  TraceLog,
  TraceEventType,
  MotiveScore,
  ConflictRecord,
  DecisionTrace,
} from "./types";

export { TraceLogger } from "./logger";
export { takeSnapshot, diffSnapshots } from "./snapshot";
export type { StateSnapshot, StateDiff } from "./snapshot";
