import type { EmotionType } from "../state/emotions";
import type { NarrativeArc } from "../state/narrative";
import type { RelationshipTag } from "../state/social";

export interface PersonaSeed {
  version: 1;
  id: string;
  name: string;

  bigFive: [number, number, number, number, number];

  coreTraits?: Partial<{
    threatSensitivity: number;
    noveltySeeking: number;
    socialDominance: number;
    impulseControl: number;
    emotionalVolatility: number;
    ambiguityTolerance: number;
    shameProneness: number;
    trustBaseline: number;
    moralRigidity: number;
    empathyCognitive: number;
    empathyAffective: number;
    attachmentSecurity: number;
  }>;

  coreValues: string[];

  selfConcept: string;
  roles: string[];
  groups?: string[];

  needOverrides?: Record<string, number>;

  temperament: { valence: number; arousal: number };

  relationships?: Array<{
    targetId: string;
    tags: RelationshipTag[];
    trust: number;
    affection: number;
  }>;

  backstory?: Array<{
    description: string;
    emotionalValence: number;
    importance: number;
  }>;

  interests?: Array<{ topic: string; level: number }>;

  wounds?: Array<{
    label: string;
    trigger: string;
    sensitivity: number;
    emotionalResponse: EmotionType;
  }>;

  habits?: Array<{
    label: string;
    triggerCondition: string;
    actionId: string;
    strength: number;
  }>;

  arc?: NarrativeArc;
  beliefAboutSelf?: string;
  beliefAboutWorld?: string;
}
