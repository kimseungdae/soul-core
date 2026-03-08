export interface InterestEntry {
  topic: string;
  level: number;
  curiosity: number;
  experience: number;
}

export interface InterestLayer {
  interests: InterestEntry[];
}

export function createDefaultInterestLayer(): InterestLayer {
  return { interests: [] };
}
