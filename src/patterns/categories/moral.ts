import type { BehaviorPattern } from "../types";

const patterns: BehaviorPattern[] = [
  {
    id: "moral.injustice.righteous_intervention",
    category: "moral",
    subcategory: "injustice_response",
    description:
      "Morally rigid character intervenes against perceived injustice",
    conditions: {
      appraisalTags: ["injustice"],
      traits: {
        moralRigidity: { min: 0.6 },
        socialDominance: { min: 0.4 },
      },
    },
    actions: [
      { type: "confront", weight: 0.5, params: { tone: "righteous" } },
      { type: "protect", weight: 0.3 },
      { type: "denounce", weight: 0.2 },
    ],
    stateEffects: {
      emotions: { anger: 0.4, determination: 0.3 },
      needs: { recognition: 0.1 },
    },
    priority: 8,
  },
  {
    id: "moral.injustice.silent_disapproval",
    category: "moral",
    subcategory: "injustice_response",
    description: "Passive character silently disapproves of injustice",
    conditions: {
      appraisalTags: ["injustice"],
      traits: {
        socialDominance: { max: 0.3 },
        moralRigidity: { min: 0.3 },
      },
    },
    actions: [
      { type: "observe", weight: 0.5 },
      { type: "withdraw", weight: 0.3 },
      { type: "remember", weight: 0.2 },
    ],
    stateEffects: {
      emotions: { contempt: 0.3, distress: 0.2 },
    },
    priority: 5,
  },
];

export default patterns;
