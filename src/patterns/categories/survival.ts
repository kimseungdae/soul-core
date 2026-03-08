import type { BehaviorPattern } from "../types";

const patterns: BehaviorPattern[] = [
  {
    id: "survival.scarcity.hoard_resources",
    category: "survival",
    subcategory: "resource_scarcity",
    description:
      "Self-preserving character hoards resources when needs are low",
    conditions: {
      needsBelow: { sustenance: 0.4 },
      traits: { empathy: { max: 0.5 } },
    },
    actions: [
      { type: "gather_resources", weight: 0.6 },
      { type: "hoard", weight: 0.3 },
      { type: "steal", weight: 0.1 },
    ],
    stateEffects: {
      emotions: { anxiety: 0.3 },
      needs: { sustenance: 0.1 },
    },
    priority: 7,
  },
  {
    id: "survival.scarcity.share_resources",
    category: "survival",
    subcategory: "resource_scarcity",
    description: "Empathetic character shares resources despite own scarcity",
    conditions: {
      needsBelow: { sustenance: 0.4 },
      traits: { empathy: { min: 0.6 } },
    },
    actions: [
      { type: "share", weight: 0.5 },
      { type: "gather_resources", weight: 0.4 },
      { type: "ask_for_help", weight: 0.1 },
    ],
    stateEffects: {
      emotions: { anxiety: 0.2, satisfaction: 0.1 },
      needs: { sustenance: 0.05 },
    },
    priority: 6,
  },
];

export default patterns;
