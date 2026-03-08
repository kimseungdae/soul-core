export type NeedCategory =
  | "physiological"
  | "safety"
  | "belonging"
  | "esteem"
  | "self-actualization"
  | "custom";

export interface Need {
  id: string;
  category: NeedCategory;
  label: string;
  current: number;
  decayRate: number;
  weight: number;
}

export interface NeedLayer {
  needs: Need[];
}

export function createDefaultNeeds(): Need[] {
  return [
    {
      id: "hunger",
      category: "physiological",
      label: "hunger",
      current: 0.8,
      decayRate: 0.01,
      weight: 1.0,
    },
    {
      id: "fatigue",
      category: "physiological",
      label: "fatigue",
      current: 0.8,
      decayRate: 0.008,
      weight: 0.9,
    },
    {
      id: "pain",
      category: "physiological",
      label: "pain",
      current: 1.0,
      decayRate: 0,
      weight: 1.0,
    },
    {
      id: "safety",
      category: "safety",
      label: "safetyNeed",
      current: 0.7,
      decayRate: 0.005,
      weight: 0.9,
    },
    {
      id: "affiliation",
      category: "belonging",
      label: "affiliationNeed",
      current: 0.6,
      decayRate: 0.003,
      weight: 0.7,
    },
    {
      id: "intimacy",
      category: "belonging",
      label: "intimacyNeed",
      current: 0.5,
      decayRate: 0.002,
      weight: 0.5,
    },
    {
      id: "autonomy",
      category: "esteem",
      label: "autonomyNeed",
      current: 0.7,
      decayRate: 0.003,
      weight: 0.6,
    },
    {
      id: "competence",
      category: "esteem",
      label: "competenceNeed",
      current: 0.6,
      decayRate: 0.002,
      weight: 0.6,
    },
    {
      id: "recognition",
      category: "esteem",
      label: "recognitionNeed",
      current: 0.5,
      decayRate: 0.004,
      weight: 0.5,
    },
    {
      id: "curiosity",
      category: "self-actualization",
      label: "curiosityDrive",
      current: 0.6,
      decayRate: 0.003,
      weight: 0.4,
    },
    {
      id: "control",
      category: "esteem",
      label: "controlNeed",
      current: 0.6,
      decayRate: 0.003,
      weight: 0.5,
    },
    {
      id: "rest",
      category: "physiological",
      label: "restNeed",
      current: 0.8,
      decayRate: 0.008,
      weight: 0.8,
    },
  ];
}

export function createDefaultNeedLayer(): NeedLayer {
  return { needs: createDefaultNeeds() };
}
