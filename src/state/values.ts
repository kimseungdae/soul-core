export type SchwartzValue =
  | "power"
  | "achievement"
  | "hedonism"
  | "stimulation"
  | "self-direction"
  | "universalism"
  | "benevolence"
  | "tradition"
  | "conformity"
  | "security";

export interface ValueEntry {
  id: string;
  category: SchwartzValue | "custom";
  label: string;
  priority: number;
  rigidity: number;
}

export interface ValueLayer {
  values: ValueEntry[];
}

export function createDefaultValueLayer(): ValueLayer {
  return {
    values: [
      {
        id: "survival",
        category: "security",
        label: "survivalPriority",
        priority: 0.7,
        rigidity: 0.8,
      },
      {
        id: "loyalty",
        category: "benevolence",
        label: "loyaltyPriority",
        priority: 0.5,
        rigidity: 0.5,
      },
      {
        id: "justice",
        category: "universalism",
        label: "justicePriority",
        priority: 0.5,
        rigidity: 0.5,
      },
      {
        id: "freedom",
        category: "self-direction",
        label: "freedomPriority",
        priority: 0.5,
        rigidity: 0.5,
      },
      {
        id: "order",
        category: "conformity",
        label: "orderPriority",
        priority: 0.5,
        rigidity: 0.5,
      },
      {
        id: "recognition",
        category: "achievement",
        label: "recognitionPriority",
        priority: 0.4,
        rigidity: 0.3,
      },
      {
        id: "curiosity",
        category: "stimulation",
        label: "curiosityPriority",
        priority: 0.5,
        rigidity: 0.3,
      },
      {
        id: "compassion",
        category: "benevolence",
        label: "compassionPriority",
        priority: 0.5,
        rigidity: 0.5,
      },
    ],
  };
}
