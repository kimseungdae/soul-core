export type MotiveSource =
  | "need"
  | "emotion"
  | "value"
  | "identity"
  | "wound"
  | "habit"
  | "relationship"
  | "interest";

export interface Motive {
  id: string;
  label: string;
  score: number;
  source: MotiveSource;
  sourceId: string;
  actionHint: string;
  targetId?: string;
}
