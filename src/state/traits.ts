export interface BigFive {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface CoreTraits {
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
}

export interface CustomTrait {
  id: string;
  label: string;
  value: number;
}

export interface TraitLayer {
  bigFive: BigFive;
  core: CoreTraits;
  custom: CustomTrait[];
}

export function createDefaultBigFive(): BigFive {
  return {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.5,
  };
}

export function createDefaultCoreTraits(): CoreTraits {
  return {
    threatSensitivity: 0.5,
    noveltySeeking: 0.5,
    socialDominance: 0.5,
    impulseControl: 0.5,
    emotionalVolatility: 0.5,
    ambiguityTolerance: 0.5,
    shameProneness: 0.5,
    trustBaseline: 0.5,
    moralRigidity: 0.5,
    empathyCognitive: 0.5,
    empathyAffective: 0.5,
    attachmentSecurity: 0.5,
  };
}

export function createDefaultTraitLayer(): TraitLayer {
  return {
    bigFive: createDefaultBigFive(),
    core: createDefaultCoreTraits(),
    custom: [],
  };
}
