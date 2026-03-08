import type { PersonaState } from "../../state/index";
import type { BehaviorEvent, WorldState } from "../../types/request";
import { clamp01 } from "../../types/common";

export interface SocialSignal {
  sourceId: string;
  type: "hostile" | "friendly" | "neutral" | "submissive" | "dominant";
  intensity: number;
}

export interface PerceptionResult {
  relevantEntities: string[];
  perceivedThreatLevel: number;
  perceivedOpportunity: number;
  socialSignals: SocialSignal[];
  attentionFocus: string | null;
}

export function perceive(
  state: PersonaState,
  event: BehaviorEvent | undefined,
  world: WorldState,
): PerceptionResult {
  const result: PerceptionResult = {
    relevantEntities: [...world.nearbyEntities],
    perceivedThreatLevel: 0,
    perceivedOpportunity: 0,
    socialSignals: [],
    attentionFocus: null,
  };

  const { threatSensitivity } = state.traits.core;
  const baseThreat = event?.context.severity ?? 0;

  if (event?.category === "combat") {
    result.perceivedThreatLevel = clamp01(
      baseThreat * (0.5 + threatSensitivity * 0.5),
    );
  } else if (event?.category === "social") {
    const socialThreat = baseThreat * 0.5;
    result.perceivedThreatLevel = clamp01(
      socialThreat * (0.3 + state.traits.core.shameProneness * 0.7),
    );
  }

  if (world.safeZone) {
    result.perceivedThreatLevel *= 0.5;
  }

  if (event?.category === "cognitive") {
    result.perceivedOpportunity = clamp01(
      (baseThreat || 0.5) * (0.3 + state.traits.core.noveltySeeking * 0.7),
    );
  }

  for (const entityId of world.nearbyEntities) {
    const rel = state.social.relationships.find((r) => r.targetId === entityId);
    if (rel) {
      let type: SocialSignal["type"] = "neutral";
      let intensity = 0;

      if (rel.trust < -0.3 || rel.resentment > 0.5) {
        type = "hostile";
        intensity = Math.max(Math.abs(rel.trust), rel.resentment);
      } else if (rel.affection > 0.3 || rel.trust > 0.3) {
        type = "friendly";
        intensity = Math.max(rel.affection, rel.trust);
      } else if (rel.fear > 0.3) {
        type = "dominant";
        intensity = rel.fear;
      }

      result.socialSignals.push({ sourceId: entityId, type, intensity });
    }
  }

  if (event?.source) {
    result.attentionFocus = event.source;
  } else if (result.socialSignals.length > 0) {
    result.attentionFocus = result.socialSignals.sort(
      (a, b) => b.intensity - a.intensity,
    )[0].sourceId;
  }

  return result;
}
