// State
export type { PersonaState } from "./state/index";
export { createPersonaState } from "./state/index";

// State layers
export type {
  TraitLayer,
  BigFive,
  CoreTraits,
  CustomTrait,
  ValueLayer,
  ValueEntry,
  SchwartzValue,
  IdentityLayer,
  Role,
  NeedLayer,
  Need,
  NeedCategory,
  EmotionLayer,
  Emotion,
  Mood,
  EmotionType,
  SocialLayer,
  Relationship,
  RelationshipTag,
  MemoryLayer,
  Memory,
  EpisodicMemory,
  SemanticMemory,
  InterestLayer,
  InterestEntry,
  WoundLayer,
  Wound,
  HabitLayer,
  Habit,
  NarrativeLayer,
  NarrativeTheme,
  LifeChapter,
  NarrativeArc,
} from "./state/index";

// Seed
export type { PersonaSeed } from "./seed/index";
export { hydratePersona } from "./seed/index";

// Trace
export type {
  TraceEntry,
  TraceLog,
  TraceEventType,
  MotiveScore,
  ConflictRecord,
  DecisionTrace,
} from "./trace/index";
export { createTraceLog, addTraceEntry } from "./trace/index";
export { TraceLogger } from "./trace/index";
export { takeSnapshot, diffSnapshots } from "./trace/index";
export type { StateSnapshot, StateDiff } from "./trace/index";

// Core Pipeline
export { processBehavior } from "./core/pipeline";
export type { PipelineOptions } from "./core/pipeline";

// Types
export type { EntityId, Tick, Range } from "./types/common";
export { clamp, clamp01, clampBipolar, generateId } from "./types/common";

// Request / Response
export type {
  BehaviorRequest,
  BehaviorEvent,
  WorldState,
  EventCategory,
  EventContext,
  RequestType,
} from "./types/request";
export type {
  BehaviorResponse,
  ActionResult,
  InternalStateChanges,
  EmotionChange,
  RelationshipUpdate,
  NeedChange,
  MemoryFormed,
  ResponseTrace,
  ConflictResolution,
  AlternativeConsidered,
} from "./types/response";
