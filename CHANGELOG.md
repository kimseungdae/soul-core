# Changelog

## [0.4.0] - 2026-03-08

### Added

- World Simulator module (`src/world/`) for multi-agent tile-based village simulation
- 64x64 tile map village generator with buildings, river, bridge, dungeon, forest zones
- A\* pathfinding for NPC navigation between locations
- Multi-agent scheduler: 8 NPCs with daily schedules, autonomous goal-based behavior
- Monster system: 7 monsters (wolves, goblins, skeleton, bandit) with territory patrol and respawn
- Social interaction system: automatic NPC-NPC encounters with soul-core personality processing
- Combat system: NPC-monster encounters outside village with soul-core decision pipeline
- Routine behavior system: location-based activities (tavern=eating, library=studying, etc.)
- Day/night cycle with 48 ticks per day (30 min/tick)
- Canvas 2D renderer: tile map, NPC sprites with emoji, monster sprites, HP bars, location labels
- Camera system: WASD/arrow key scrolling, mouse wheel zoom, click-to-select NPC
- Minimap (64x64 overview) with agent/monster dots and viewport rectangle
- Night overlay with dawn/dusk transitions
- World mode tab in playground with simulation controls, NPC list, state panel, event log
- 8 unique NPCs: Kael (warrior), Lyra (scholar), Vex (rogue), Elena (healer), Bjorn (blacksmith), Mira (merchant), Theron (sage), Finn (apprentice)
- All Korean UI: building names, NPC names, activities, event descriptions, controls

## [0.3.0] - 2026-03-08

### Added

- Behavior pattern system with type definitions, registry, matcher, and loader
- 18 prototype patterns across 7 categories: social (5), combat (3), survival (2), emotional (2), cognitive (2), moral (2), routine (2)
- Pattern matching engine: trait conditions, emotion conditions, appraisal tag matching, need thresholds
- Pattern-enhanced action selection: patterns provide richer parameterized actions with fallback to motive-based generation
- `matchedPattern` field in response trace for pattern traceability
- 3 new emotion types: contempt, determination, anxiety
- JSON data files in `data/patterns/` for each category (prototype, expandable)
- 12 pattern system tests (registry, matcher, pipeline integration)
- 45 total tests passing

## [0.2.0] - 2026-03-08

### Added

- Complete deterministic runtime pipeline: Perception → Appraisal → Motive Synthesis → Conflict Arbitration → Action Selection → State Update
- Perception engine with trait-biased threat/opportunity detection and social signal extraction
- Appraisal engine with character-relative event interpretation, wound triggering, identity threat detection, value engagement
- Motive synthesizer generating motives from needs, emotions, values, identity, wounds, habits, relationships
- Conflict arbitrator with opposing pair detection, identity overrides, emotional amplification, impulse control modifiers
- Action selector with feasibility checks and parameterized action output
- State updater with emotion generation, relationship updates, need changes, memory formation, habit reinforcement
- TraceLogger fluent API for structured decision tracing
- StateSnapshot and diffSnapshots for state comparison debugging
- `processBehavior()` - single function for complete Request → Response pipeline
- 7 E2E pipeline tests verifying determinism, persona differentiation, state mutation control
- 33 total tests passing

## [0.1.0] - 2026-03-08

### Added

- Phase 1: Foundation schema and type system
- 11 internal state layers (Traits, Values, Identity, Needs, Emotions, Social, Memory, Interest, Wounds, Habits, Narrative)
- Big Five + 12 core personality traits with default derivation from Big Five
- PersonaSeed compressed authoring format
- PersonaSeed → PersonaState hydration with Schwartz value mapping
- BehaviorRequest / BehaviorResponse structured JSON types
- Decision trace types (TraceEntry, DecisionTrace, TraceLog)
- Trace logger with factory functions
- 26 unit tests covering state creation, seed hydration, and trace system
