import type { EntityId, Tick } from "../types/common";
import type { TraceLog, TraceEntry, TraceEventType } from "./types";
import { createTraceLog, addTraceEntry } from "./index";

export class TraceLogger {
  private log: TraceLog;
  private enabled: boolean;

  constructor(personaId: EntityId, startTick: Tick, enabled = true) {
    this.log = createTraceLog(personaId, startTick);
    this.enabled = enabled;
  }

  perception(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "perception", data, tick);
  }

  appraisal(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "appraisal", data, tick);
  }

  motive(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "motive", data, tick);
  }

  conflict(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "conflict", data, tick);
  }

  decision(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "decision", data, tick);
  }

  stateUpdate(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "state_update", data, tick);
  }

  memoryFormed(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "memory_formed", data, tick);
  }

  emotionTriggered(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "emotion_triggered", data, tick);
  }

  habitFired(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "habit_fired", data, tick);
  }

  woundActivated(tick: Tick, data: Record<string, unknown>): void {
    if (this.enabled) addTraceEntry(this.log, "wound_activated", data, tick);
  }

  getLog(): TraceLog {
    return this.log;
  }

  getEntries(): TraceEntry[] {
    return this.log.entries;
  }

  getEntriesByType(type: TraceEventType): TraceEntry[] {
    return this.log.entries.filter((e) => e.event === type);
  }

  clear(newStartTick: Tick): void {
    this.log = createTraceLog(this.log.personaId, newStartTick);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
