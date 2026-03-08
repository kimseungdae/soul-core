import {
  createWorldState,
  worldTick,
  loadPrototypePatterns,
} from "../src/index";
import { AGENT_DEFS } from "../playground/src/world/agents";

loadPrototypePatterns();
const world = createWorldState(AGENT_DEFS);

const stats = {
  totalEvents: 0,
  eventsByType: {} as Record<string, number>,
  deaths: 0,
  starvationDeaths: 0,
  combatDeaths: 0,
  combatWins: 0,
  combatFlees: 0,
  goalDistribution: {} as Record<string, number>,
  goalSamples: 0,
};

const TICKS = 500;

for (let t = 0; t < TICKS; t++) {
  const events = worldTick(world);

  for (const ev of events) {
    stats.totalEvents++;
    stats.eventsByType[ev.type] = (stats.eventsByType[ev.type] ?? 0) + 1;

    if (ev.type === "death") {
      stats.deaths++;
      if (
        ev.descriptionKo?.includes("굶주림") ||
        ev.descriptionKo?.includes("굶어")
      ) {
        stats.starvationDeaths++;
      } else {
        stats.combatDeaths++;
      }
    }
    if (ev.type === "combat") {
      if (ev.descriptionKo?.includes("처치")) stats.combatWins++;
      if (ev.descriptionKo?.includes("도망")) stats.combatFlees++;
    }
  }

  for (const a of world.agents) {
    if (a.alive) {
      stats.goalDistribution[a.currentGoal] =
        (stats.goalDistribution[a.currentGoal] ?? 0) + 1;
      stats.goalSamples++;
    }
  }
}

// --- Report ---
const alive = world.agents.filter((a) => a.alive);
console.log(
  `\n=== SIMULATION REPORT (${TICKS} ticks, ~${(TICKS / 288).toFixed(1)} days) ===`,
);
console.log(`Survivors: ${alive.length}/${world.agents.length}`);
console.log(
  `Deaths: ${stats.deaths} (starvation: ${stats.starvationDeaths}, combat: ${stats.combatDeaths})`,
);
console.log(`Combat: ${stats.combatWins}W / ${stats.combatFlees}F`);

console.log(`\nGoal Distribution:`);
const sorted = Object.entries(stats.goalDistribution).sort(
  (a, b) => b[1] - a[1],
);
for (const [goal, count] of sorted) {
  const pct = ((count / stats.goalSamples) * 100).toFixed(1);
  console.log(`  ${goal.padEnd(20)} ${String(count).padStart(5)}  (${pct}%)`);
}

console.log(`\nEvent Types:`);
for (const [type, count] of Object.entries(stats.eventsByType).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${type.padEnd(15)} ${count}`);
}

console.log(`\nAgent Status:`);
for (const a of world.agents) {
  const status = a.alive ? "ALIVE" : "DEAD ";
  console.log(
    `  ${a.nameKo.padEnd(6)} ${status} | HP:${String(Math.round(a.hp)).padStart(3)} | hunger:${a.hunger.toFixed(2)} | gold:${String(a.gold).padStart(3)} | weapon:${a.inventory.weapon} food:${a.inventory.food} | goal:${a.currentGoal}`,
  );
}

// --- PASS/FAIL ---
const failures: string[] = [];

if (alive.length < 5) {
  failures.push(`Only ${alive.length} survivors (need 5+)`);
}
if (stats.starvationDeaths > 2) {
  failures.push(`${stats.starvationDeaths} starvation deaths (max 2)`);
}
if (stats.combatWins < 1) {
  failures.push(`${stats.combatWins} combat wins (need 1+)`);
}
const gatherPct =
  ((stats.goalDistribution["gathering"] ?? 0) / stats.goalSamples) * 100;
if (gatherPct < 10) {
  failures.push(`Gathering only ${gatherPct.toFixed(1)}% of time (need 10%+)`);
}

const sleepPct =
  ((stats.goalDistribution["sleeping"] ?? 0) / stats.goalSamples) * 100;
if (sleepPct > 60) {
  failures.push(`Sleeping ${sleepPct.toFixed(1)}% of time (max 60%)`);
}

const idlePct =
  ((stats.goalDistribution["idle"] ?? 0) / stats.goalSamples) * 100;
if (idlePct > 30) {
  failures.push(`Idle ${idlePct.toFixed(1)}% of time (max 30%)`);
}

if (failures.length === 0) {
  console.log("\n✅ ALL CHECKS PASSED");
} else {
  console.log("\n❌ CHECKS FAILED:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
