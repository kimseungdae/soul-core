import type { BehaviorPattern } from "../types";

const patterns: BehaviorPattern[] = [
  {
    id: "social.insult.aggressive_retaliation",
    category: "social",
    subcategory: "insult_response",
    description:
      "Low impulse control character retaliates aggressively to insults",
    conditions: {
      traits: {
        impulseControl: { min: 0, max: 0.4 },
        socialDominance: { min: 0.5 },
      },
      appraisalTags: ["insult", "social_threat"],
    },
    actions: [
      {
        type: "verbal_retaliation",
        weight: 0.5,
        params: { tone: "aggressive" },
      },
      { type: "intimidation", weight: 0.3 },
      { type: "physical_retaliation", weight: 0.2 },
    ],
    stateEffects: {
      emotions: { anger: 0.3, pride: 0.1 },
      relationships: { source: { trust: -0.2, respect: -0.15 } },
    },
    priority: 8,
  },
  {
    id: "social.insult.calm_dismissal",
    category: "social",
    subcategory: "insult_response",
    description: "High impulse control character calmly dismisses insults",
    conditions: {
      traits: {
        impulseControl: { min: 0.6 },
        emotionalStability: { min: 0.5 },
      },
      appraisalTags: ["insult"],
    },
    actions: [
      { type: "dismiss", weight: 0.6, params: { tone: "calm" } },
      {
        type: "verbal_retaliation",
        weight: 0.3,
        params: { tone: "cold_anger" },
      },
      { type: "walk_away", weight: 0.1 },
    ],
    stateEffects: {
      emotions: { contempt: 0.2 },
      relationships: { source: { respect: -0.1 } },
    },
    priority: 6,
  },
  {
    id: "social.insult.shame_withdrawal",
    category: "social",
    subcategory: "insult_response",
    description: "Shame-prone character withdraws after being insulted",
    conditions: {
      traits: {
        shameProneness: { min: 0.6 },
        socialDominance: { max: 0.4 },
      },
      appraisalTags: ["insult", "social_threat"],
    },
    actions: [
      { type: "withdraw", weight: 0.6 },
      { type: "submit", weight: 0.3 },
      { type: "cry", weight: 0.1 },
    ],
    stateEffects: {
      emotions: { shame: 0.5, distress: 0.3 },
      needs: { recognition: -0.2 },
    },
    priority: 7,
  },
];

export default patterns;
