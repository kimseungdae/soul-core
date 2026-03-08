import type { EntityId, Tick } from "../types/common";
import type { TraitLayer } from "./traits";
import type { ValueLayer } from "./values";
import type { IdentityLayer } from "./identity";
import type { NeedLayer } from "./needs";
import type { EmotionLayer } from "./emotions";
import type { SocialLayer } from "./social";
import type { MemoryLayer } from "./memory";
import type { InterestLayer } from "./interest";
import type { WoundLayer } from "./wounds";
import type { HabitLayer } from "./habits";
import type { NarrativeLayer } from "./narrative";
import { createDefaultTraitLayer } from "./traits";
import { createDefaultValueLayer } from "./values";
import { createDefaultIdentityLayer } from "./identity";
import { createDefaultNeedLayer } from "./needs";
import { createDefaultEmotionLayer } from "./emotions";
import { createDefaultSocialLayer } from "./social";
import { createDefaultMemoryLayer } from "./memory";
import { createDefaultInterestLayer } from "./interest";
import { createDefaultWoundLayer } from "./wounds";
import { createDefaultHabitLayer } from "./habits";
import { createDefaultNarrativeLayer } from "./narrative";

export interface PersonaState {
  id: EntityId;
  tick: Tick;
  traits: TraitLayer;
  values: ValueLayer;
  identity: IdentityLayer;
  needs: NeedLayer;
  emotions: EmotionLayer;
  social: SocialLayer;
  memory: MemoryLayer;
  interest: InterestLayer;
  wounds: WoundLayer;
  habits: HabitLayer;
  narrative: NarrativeLayer;
}

export function createPersonaState(id: EntityId, tick: Tick = 0): PersonaState {
  return {
    id,
    tick,
    traits: createDefaultTraitLayer(),
    values: createDefaultValueLayer(),
    identity: createDefaultIdentityLayer(),
    needs: createDefaultNeedLayer(),
    emotions: createDefaultEmotionLayer(),
    social: createDefaultSocialLayer(),
    memory: createDefaultMemoryLayer(),
    interest: createDefaultInterestLayer(),
    wounds: createDefaultWoundLayer(),
    habits: createDefaultHabitLayer(),
    narrative: createDefaultNarrativeLayer(),
  };
}

export type { TraitLayer, BigFive, CoreTraits, CustomTrait } from "./traits";
export type { ValueLayer, ValueEntry, SchwartzValue } from "./values";
export type { IdentityLayer, Role } from "./identity";
export type { NeedLayer, Need, NeedCategory } from "./needs";
export type { EmotionLayer, Emotion, Mood, EmotionType } from "./emotions";
export type { SocialLayer, Relationship, RelationshipTag } from "./social";
export type {
  MemoryLayer,
  Memory,
  EpisodicMemory,
  SemanticMemory,
} from "./memory";
export type { InterestLayer, InterestEntry } from "./interest";
export type { WoundLayer, Wound } from "./wounds";
export type { HabitLayer, Habit } from "./habits";
export type {
  NarrativeLayer,
  NarrativeTheme,
  LifeChapter,
  NarrativeArc,
} from "./narrative";

export { createDefaultTraitLayer } from "./traits";
export { createDefaultValueLayer } from "./values";
export { createDefaultIdentityLayer } from "./identity";
export { createDefaultNeedLayer } from "./needs";
export { createDefaultEmotionLayer } from "./emotions";
export { createDefaultSocialLayer, createRelationship } from "./social";
export { createDefaultMemoryLayer } from "./memory";
export { createDefaultInterestLayer } from "./interest";
export { createDefaultWoundLayer } from "./wounds";
export { createDefaultHabitLayer } from "./habits";
export { createDefaultNarrativeLayer } from "./narrative";
