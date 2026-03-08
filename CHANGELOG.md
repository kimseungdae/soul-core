# Changelog

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
