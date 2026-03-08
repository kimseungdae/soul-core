import type { PersonaState } from "../../state/index";
import type { Motive } from "../motives/motive";
import type { AppraisalResult } from "../appraisal/appraiser";
import { clamp01 } from "../../types/common";

export interface ConflictPair {
  motiveA: Motive;
  motiveB: Motive;
  winner: Motive;
  loser: Motive;
  reason: string;
}

export interface ArbitrationResult {
  rankedMotives: Motive[];
  conflicts: ConflictPair[];
  suppressedMotives: Motive[];
}

const OPPOSING_PAIRS: [string, string][] = [
  ["flee", "fight"],
  ["flee", "protect_ally"],
  ["withdraw", "retaliate"],
  ["rest", "prove_skill"],
  ["seek_safety", "investigate"],
  ["seek_closeness", "withdraw"],
];

export function arbitrate(
  state: PersonaState,
  motives: Motive[],
  appraisal: AppraisalResult,
): ArbitrationResult {
  if (motives.length === 0) {
    return { rankedMotives: [], conflicts: [], suppressedMotives: [] };
  }

  const adjusted = motives.map((m) => ({ ...m }));
  const conflicts: ConflictPair[] = [];
  const suppressedSet = new Set<string>();

  // --- Apply identity overrides ---
  if (appraisal.identityThreatened) {
    for (const m of adjusted) {
      if (m.source === "identity") {
        m.score *= 1.5;
      }
    }
  }

  // --- Apply emotional amplification ---
  for (const emotion of state.emotions.active) {
    if (emotion.intensity < 0.4) continue;

    for (const m of adjusted) {
      if (
        emotion.type === "anger" &&
        (m.label === "retaliate" || m.label === "fight")
      ) {
        m.score *= 1 + emotion.intensity * 0.4;
      }
      if (emotion.type === "fear" && m.label === "flee") {
        m.score *= 1 + emotion.intensity * 0.5;
      }
      if (emotion.type === "shame" && m.label === "withdraw") {
        m.score *= 1 + emotion.intensity * 0.3;
      }
    }
  }

  // --- Apply wound escalation ---
  if (appraisal.woundTriggered) {
    for (const m of adjusted) {
      if (m.source === "wound") {
        m.score *= 1.3;
      }
    }
  }

  // --- Apply impulse control ---
  const impulseControl = state.traits.core.impulseControl;
  for (const m of adjusted) {
    if (m.actionHint === "attack" || m.actionHint === "lash_out") {
      m.score *= 1 - impulseControl * 0.4;
    }
  }

  // --- Detect and resolve conflicts ---
  for (const [labelA, labelB] of OPPOSING_PAIRS) {
    const a = adjusted.find((m) => m.label === labelA);
    const b = adjusted.find((m) => m.label === labelB);

    if (!a || !b) continue;

    let winner: Motive;
    let loser: Motive;
    let reason: string;

    if (a.score >= b.score) {
      winner = a;
      loser = b;
    } else {
      winner = b;
      loser = a;
    }

    // --- Special overrides ---

    // Identity override: protector identity forces protect over flee
    if (loser.label === "protect_ally" && winner.label === "flee") {
      const protectorRole = state.identity.roles.find(
        (r) =>
          r.active &&
          (r.label.includes("protector") || r.label.includes("guardian")),
      );
      if (protectorRole && protectorRole.salience > 0.6) {
        [winner, loser] = [loser, winner];
        reason = `identity(${protectorRole.label}) overrides fear`;
      } else {
        reason = `self-preservation (${winner.score.toFixed(0)} > ${loser.score.toFixed(0)})`;
      }
    }
    // Value hierarchy: justice value can override withdrawal
    else if (loser.label === "retaliate" && winner.label === "withdraw") {
      const justiceValue = state.values.values.find((v) => v.id === "justice");
      if (justiceValue && justiceValue.priority > 0.7) {
        [winner, loser] = [loser, winner];
        reason = `justice value (${justiceValue.priority}) overrides withdrawal`;
      } else {
        reason = `impulse control favors withdrawal (${winner.score.toFixed(0)} > ${loser.score.toFixed(0)})`;
      }
    } else {
      reason = `score comparison (${winner.score.toFixed(0)} > ${loser.score.toFixed(0)})`;
    }

    conflicts.push({
      motiveA: a,
      motiveB: b,
      winner,
      loser,
      reason,
    });

    loser.score *= 0.3;
    suppressedSet.add(loser.id);
  }

  // --- Relationship modifier ---
  for (const m of adjusted) {
    if (m.targetId) {
      const rel = state.social.relationships.find(
        (r) => r.targetId === m.targetId,
      );
      if (rel) {
        if (
          m.actionHint === "attack" ||
          m.actionHint === "verbal_retaliation"
        ) {
          if (rel.affection > 0.3) {
            m.score *= 1 - rel.affection * 0.3;
          }
          if (rel.fear > 0.3) {
            m.score *= 1 - rel.fear * 0.4;
          }
        }
        if (m.actionHint === "protect" || m.actionHint === "comfort") {
          m.score *= 1 + rel.loyalty * 0.3;
        }
      }
    }
  }

  // --- Final ranking ---
  const rankedMotives = adjusted
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  const suppressedMotives = adjusted.filter((m) => suppressedSet.has(m.id));

  return { rankedMotives, conflicts, suppressedMotives };
}
