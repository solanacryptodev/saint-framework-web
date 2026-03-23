// src/lib/types.ts
// Shared types aligned with ACE (Agentic Context Engineering) architecture

// ── The Choice Loop ────────────────────────────────────────────────────────

/**
 * A single generated option presented to the player.
 * Generators produce a set of these; the player picks one.
 */
export interface NarrativeOption {
    id: string;                    // stable ID for tracking which was chosen
    text: string;                  // the readable choice text shown to player
    tone: OptionTone;              // narrative tone classification
    loreReferences: string[];      // lore_node IDs this option touches
    worldImpact: WorldImpact;      // predicted impact on World Graph if chosen
    weight: number;                // generator confidence / narrative gravity (0-1)
    consequence_preview?: string;  // preview of consequences shown on hover
    vector_deltas?: VectorDeltas;   // method/social/moral impact values
}

export interface VectorDeltas {
    method: number;
    social: number;
    moral: number;
}

export type OptionTone =
    | "aggressive"
    | "diplomatic"
    | "cautious"
    | "curious"
    | "compassionate"
    | "deceptive"
    | "heroic"
    | "cowardly";


// ── A complete "beat" in ACE terms ────────────────────────────────────────

/**
 * One full turn of the ACE loop:
 *   context → generate options → player chooses → world mutates → reflect
 */
export interface NarrativeBeat {
    beatId: string;
    sessionId: string;
    turnNumber: number;

    // Input context
    sceneDescription: string;        // current world state rendered as prose
    activeThreads: string[];         // ongoing narrative threads in World Graph
    loreContext: string[];           // relevant lore node names surfaced by Curators

    // Generator output
    options: NarrativeOption[];      // 3-4 options produced by Generators
    generatedBy: string;             // agent name

    // Player decision
    chosenOptionId?: string;
    chosenAt?: string;               // ISO timestamp

    // World mutation (post-choice)
    appliedImpact?: WorldImpact;
    curatedBy?: string;              // curator agent that approved the impact
    swarmReactions?: SwarmReaction[];

    // Reflection
    reflectionNotes?: string;        // Reflector output
}

export interface SwarmReaction {
    agentName: string;
    reactionType: "consequence" | "tension_shift" | "gravity_pull" | "npc_response";
    content: string;
    worldNodeAffected?: string;
}

// ── Session ────────────────────────────────────────────────────────────────

export interface GameSession {
    sessionId: string;
    playerId: string;
    startedAt: string;
    currentBeatId?: string;
    turnNumber: number;
    narrativeThreads: string[];      // active story threads
    choiceHistory: ChoiceRecord[];
}

export interface ChoiceRecord {
    beatId: string;
    turnNumber: number;
    optionId: string;
    optionText: string;
    tone: OptionTone;
    timestamp: string;
}

// ── ACE Context Window ─────────────────────────────────────────────────────

/**
 * The full context assembled by Curators before each generation pass.
 * This is the "C" in ACE — engineered context fed to Generators.
 */
export interface ACEContext {
    sessionId: string;
    turnNumber: number;

    // Lore Graph surface
    relevantLore: LoreSurface[];

    // World Graph surface  
    currentScene: string;
    activeWorldNodes: WorldNodeSurface[];
    recentConsequences: string[];    // Swarm-planted seeds about to bloom

    // Player arc
    recentChoices: ChoiceRecord[];   // last N choices for tone/pattern analysis
    playerTonePattern: OptionTone[]; // dominant tones chosen so far

    // Narrative pressure
    overallTension: number;          // 0-1, managed by Swarm Agent 03
    openThreadCount: number;
}

export interface LoreSurface {
    nodeId: string;
    kind: string;
    name: string;
    summary: string;
    relationContext?: string;
}

export interface WorldNodeSurface {
    nodeId: string;
    kind: string;
    name: string;
    activeState: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// ── Lore Graph ───────────────────────────────────────────────────────────

export interface LoreNode {
    id: string;
    kind: "character" | "faction" | "location" | "item" | "event" | "concept";
    name: string;
    description: string;
    properties: Record<string, unknown>;
    canon: boolean;
    significance?: number;
    epoch?: string;
    temporal_order?: number;
    created_at?: string;
    updated_at?: string;
    related_out?: Pick<LoreNode, "id" | "kind" | "name">[];
    related_in?: Pick<LoreNode, "id" | "kind" | "name">[];
}

export interface LoreContext {
    root: LoreNode;
    depth: number;
}

export interface LoreEvent {
    id?: string;
    session_id: string;
    turn_number: number;
    event_kind:
    | "decision"
    | "consequence"
    | "revelation"
    | "relationship_change"
    | "item_transfer"
    | "location_entered";
    description: string;
    actors: string[];
    locations: string[];
    items: string[];
    consequences: string[];
    player_choice?: string;
    created_at?: string;
}

// ── World Graph ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// WORLD AGENT - The agents of the world
// ═══════════════════════════════════════════════════════════════════════════

export interface LeverageData {
    leverage_type: "secret" | "family" | "debt" | "crime" | "desire";
    potency: number;
    moral_cost: number;
    discovery_method: string;
    expiration?: string | null;
}

export interface DramaDebt {
    accumulated: number;
    turns_since_impact: number;
    last_impact_turn: number;
    tolerance: number;
}

export interface WorldAgent {
    id: string;
    game_id: string;              // required — scope to game
    session_id: string;           // required — "WORLD_INIT" or player session id
    lore_ref: string;
    location_id: string | null;   // null until AT edge is written
    name: string;
    kind: "player" | "npc" | "faction_rep";
    disposition: "hostile" | "neutral" | "friendly" | "unknown";
    awareness: "unaware" | "suspicious" | "alerted" | "hostile" | "allied";
    goal_current: string;
    goal_hidden: string;
    state: Record<string, unknown>;
    active: boolean;
    // SAINT narrative physics
    narrative_weight: number;
    gravitational_signature: [number, number, number];
    emotional_charge: number;
    influence_resonance: number;
    vector_susceptibility: [number, number, number];
    concept_affinity: Record<string, number>;
    plausibility_threshold: number;
    coherence_contribution: number;
    agency_quota: number;
    emergence_potential: number;
    temporal_focus: number;
    // Leverage system
    known_leverage: LeverageData[];
    hidden_leverage: LeverageData[];
    leverage_resistance: number;
    // Drama debt
    drama_debt: DramaDebt;
}
/** @deprecated Use WorldAgent */
export type WorldActor = WorldAgent;

// ═══════════════════════════════════════════════════════════════════════════
// WORLD FACTION - The factions of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldFaction {
    id: string;
    game_id?: string;
    session_id?: string;
    lore_ref: string;
    name: string;
    faction_type: string;
    status: string;
    description: string;
    leadership_ids: string[];
    member_ids: string[];
    territory_ids: string[];
    narrative_weight: number;
    gravitational_mass: [number, number, number]; // [trauma, hope, mystery]
    emotional_charge: number;
    swarm_coherence: number;
    concept_affinity: string[];
    concept_orthodoxy: number;
    concept_propagation_rate: number;
    internal_coherence: number;
    vector_doctrine: { moral: number; method: number; social: number };
    vector_enforcement: number;
    alliances: Array<Record<string, unknown>>;
    hostilities: Array<Record<string, unknown>>;
    player_standing: number;
    player_known_to: boolean;
    player_perceived_alignment: number;
    state: Record<string, unknown>;
    updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD EVENT - Narrative gravity drivers
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldEvent {
    id: string;
    game_id?: string;
    session_id?: string;
    lore_ref?: string;
    name: string;
    description: string;
    participants: string[];
    location_id?: string;
    gravitational_mass: [number, number, number]; // [trauma, hope, mystery]
    swarm_attention: number;
    coherence_stress: number;
    plausibility_decay: number;
    vector_imprint: [number, number, number];
    concept_seeding: Record<string, number>;
    temporal_ripple: number;
    phase_charge: number;
    significance: number;
    resolved: boolean;
    known_to_player: boolean;
    state: Record<string, unknown>;
    created_at: string;
    updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD CONCEPT - The concepts of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldConcept {
    id: string;
    game_id?: string;
    session_id?: string;
    lore_ref?: string;
    name: string;
    description: string;
    emotional_valence: number;
    narrative_density: number;
    vector_amplification: [number, number, number];
    swarm_coherence: number;
    mutation_rate: number;
    gravitational_drag: number;
    plausibility_anchor: number;
    opposes: string[];
    evolves_from?: string;
    active: boolean;
    known_to_player: boolean;
    state: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD LOCATION - The locations of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldLocation {
    id: string;
    game_id?: string;
    session_id?: string;
    lore_ref?: string;
    name: string;
    description: string;
    region: string;
    parent?: string;               // world_location id of containing location
    accessible: boolean;
    atmosphere: string;
    secrets: string[];
    revealed_secrets: string[];
    // SAINT narrative physics
    gravitational_signature: [number, number, number]; // [trauma, hope, mystery]
    emotional_charge: number;
    // Environmental memory
    concept_imprint: Record<string, number>;
    memory_decay: number;
    // Coherence + movement
    plausibility_modifier: number;
    traversal_risk: number;
    controlled_by?: string;        // world_faction id
    state: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD ITEM - The items of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldItem {
    id: string;
    game_id?: string;
    session_id?: string;
    lore_ref?: string;
    name: string;
    description: string;
    kind: string;                  // "artifact"|"weapon"|"key"|"document"|"relic"|"tool"
    // SAINT narrative physics
    narrative_weight: number;
    gravitational_mass: [number, number, number]; // [trauma, hope, mystery]
    // Concept association
    concept_affinity: Record<string, number>;
    concept_transfer: number;
    // Ownership
    held_by?: string;              // world_agent id
    location_id?: string;          // world_location id
    // Coherence
    plausibility_anchor: number;
    // State
    accessible: boolean;
    known_to_player: boolean;
    condition: string;
    state: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD THREAD - Narrative threads of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldThread {
    id: string;
    game_id?: string;
    session_id: string;
    name: string;
    description: string;
    tension: number;
    urgency: number;
    active: boolean;
    turn_opened: number;
    turn_resolved?: number;
    involved_actors: string[];
    involved_locations: string[];
    consequence_seeds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD SNAPSHOT - A snapshot of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldSnapshot {
    actors: WorldAgent[];
    locations: WorldLocation[];
    items: WorldItem[];
    events: WorldEvent[];
    concepts: WorldConcept[];
    threads: WorldThread[];
    snapshotAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD IMPACT - The impact of the world
// ═══════════════════════════════════════════════════════════════════════════


export interface WorldImpact {
    actorDeltas: Record<string, Record<string, unknown>>;
    locationDeltas: Record<string, Record<string, unknown>>;
    itemDeltas: Record<string, Record<string, unknown>>;
    newEdges: Array<{
        from: string;
        to: string;
        type: string;
        weight?: number;
        metadata?: Record<string, unknown>;
    }>;
    newThreads: Partial<WorldThread>[];
    consequenceSeeds: string[];
    narrativePressure: number;
}

// ── ACE System ────────────────────────────────────────────────────────────

export interface AgentDefinition {
    id?: string;
    name: string;
    role: "generator" | "curator" | "reflector" | "swarm" | "hero";
    instructions: string;
    model?: string;
    tools?: string[];
    active?: boolean;
    metadata?: Record<string, unknown>;
}

export interface NarrativeEvent {
    id?: string;
    session_id: string;
    agent_name: string;
    event_type: "action" | "decision" | "outcome" | "reflection";
    content: string;
    metadata?: Record<string, unknown>;
    created_at?: string;
}

// ── World Init Types ────────────────────────────────────────────────────────

export interface WorldInitReport {
    agentsPlaced: PlacedAgent[];
    locationsCreated: CreatedLocation[];
    itemsPlaced: PlacedItem[];
    conceptsCreated: CreatedConcept[];
    eventsCreated: CreatedEvent[];
    threadsOpened: OpenedThread[];
    edgesCreated: number;
    playerStartLocation: string;
    warnings: string[];
    summary: string;
    completedAt: string;
}

export interface PlacedAgent {
    world_id: string;
    lore_name: string;
    kind: string;
    starting_location: string;
    disposition: string;
    goal_current: string;
}

export interface CreatedLocation {
    world_id: string;
    lore_name: string;
    region: string;
    danger_level: number;
    accessible: boolean;
    secret_count: number;
}

export interface PlacedItem {
    world_id: string;
    lore_name: string;
    holder?: string;
    location?: string;
    known_to_player: boolean;
}

export interface CreatedConcept {
    world_id: string;
    lore_name: string;
    description: string;
    emotional_valence: number;
    swarm_coherence: number;
}

export interface CreatedEvent {
    world_id: string;
    lore_name: string;
    description: string;
    location?: string;
    participant_count: number;
    significance: number;
}

export interface OpenedThread {
    world_id: string;
    name: string;
    tension: number;
    urgency: number;
}

// ── Lore Ingestion Types ──────────────────────────────────────────────────

export type LoreKind = "character" | "faction" | "location" | "item" | "event" | "concept";

export interface ParsedGameInfo {
    description?: string;
    genre?: string;
    cost_tier?: CostTier;
    cost?: number;        // in cents
    tags?: string[];
}

export interface ExtractedEntity {
    name: string;
    kind: LoreKind;
    description: string;
    aliases: string[];
    properties: Record<string, unknown>;
    rawMentions: string[];   // quoted excerpts from the source text
}

export interface ExtractedRelation {
    fromName: string;
    toName: string;
    relationType: string;    // "owns" | "knows" | "located_in" | "allied_with" | "opposes" | "seeks" | etc.
    weight: number;          // 0-1 narrative significance
    bidirectional: boolean;
    evidence: string;        // quoted excerpt that supports this relation
}

export interface IngestionChunk {
    heading: string;
    content: string;
    sectionType:
    "overview" |
    "characters" |
    "factions" |
    "locations" |
    "concepts" |
    "events" |
    "items" |
    "history" |
    "player_character" |
    "game_info" |
    "other";
}

export interface IngestionReport {
    sourceFile: string;
    chunksProcessed: number;
    entitiesExtracted: ExtractedEntity[];
    relationsExtracted: ExtractedRelation[];
    nodesWritten: WrittenNode[];
    edgesWritten: WrittenEdge[];
    warnings: string[];
    summary: string;
    worldReport?: WorldInitReport;
    playerCharacterTemplate?: PlayerCharacterTemplate | null;
    gameInfo?: ParsedGameInfo | null;
    completedAt: string;
}

export interface WrittenNode {
    surreal_id: string;
    name: string;
    kind: LoreKind;
}

export interface WrittenEdge {
    from: string;
    to: string;
    type: string;
}

// ── Game Record Types ─────────────────────────────────────────────────────

export type CostTier = "free" | "paid" | "premium";

export interface GameRecord {
    id?: string;
    creator_id: string;
    created_by: string;
    name: string;
    tagline: string;
    description: string;
    cost_tier: CostTier;
    genre: string;
    tags: string[];
    cover_image?: string | null;
    status: "draft" | "initializing" | "review" | "ready" | "archived";
    source_file: string;
    lore_nodes: number;
    lore_edges: number;
    world_agents: number;
    world_locations: number;
    world_concepts: number;
    world_events: number;
    world_items: number;
    world_threads: number;
    cost: number;           // in cents, e.g. 199 = $1.99. Always 0 when cost_tier = "free"
    visibility: "private" | "public";
    created_at?: string;
    updated_at?: string;
    launched_at?: string | null;
}

// ── Player Character Types ──────────────────────────────────────────────────

// Supported by new optional fields on the SurrealDB tables

export type CharacterKind =
    | "template"     // world-builder skeleton — player fills choices
    | "prebuilt"     // complete character — player picks and plays
    | "custom"       // player created from scratch (future)

export type CharacterStatus =
    | "draft"        // world-builder still editing
    | "published"    // available for players to use
    | "archived"     // no longer offered

export interface BackstoryOption {
    id: string;
    label: string;
    description: string;
    trait_modifiers?: Record<string, number>;   // optional SAINT physics nudges
    starting_location_override?: string;
}

export interface StartingItemOption {
    id: string;
    name: string;
    description: string;
    lore_node_id?: string;
}

export interface PlayerCharacterTemplate {
    id?: string;
    game_id: string;
    kind: CharacterKind;           // "template" | "prebuilt" | "custom"
    status: CharacterStatus;       // "draft" | "published" | "archived"

    // Identity
    base_name: string;
    description: string;
    portrait_url?: string | null;  // pre-built characters can ship with a portrait
    lore_node_id?: string | null;  // link to lore_node if character exists in lore

    // What the player can customize (empty arrays = no customization = prebuilt)
    fixed_traits: string[];
    backstory_options: BackstoryOption[];
    trait_options: string[];
    item_options: StartingItemOption[];
    max_item_picks: number;
    allow_custom_name: boolean;    // false for prebuilt characters
    allow_portrait: boolean;       // false for prebuilt characters with canon portrait

    // Starting state
    starting_location: string;

    // For prebuilt characters — fully resolved at template level
    // For templates — null until player confirms choices
    prebuilt_backstory?: string | null;
    prebuilt_traits?: string[];
    prebuilt_items?: string[];

    // Source
    raw_markdown: string;
    created_at?: string;
    updated_at?: string;
}

export interface PlayerCharacter {
    id?: string;
    game_id: string;
    player_id: string;
    session_id: string;
    template_id?: string | null;   // null if character was created without a template

    // Character kind inherited from template or set directly
    kind: CharacterKind;

    // Identity — resolved from template + player choices
    display_name: string;
    portrait_url?: string | null;

    // Player choices (empty if prebuilt — choices were already made)
    chosen_backstory?: string | null;
    chosen_traits: string[];
    chosen_items: string[];

    // World graph link — populated when session starts
    world_actor_id?: string | null;

    created_at?: string;
}

export interface IngestionProgress {
    phase: "chunking" | "extracting" | "validating" | "world_init" | "complete";
    message: string;
    percent: number;
}

// ── SAINT narrative physics — player session ───────────────────────────────
// Persisted in player_session table. One record per active session.
// Updated by the Tremor each turn via propagate_player_mark.

export interface PlayerInfluenceVectors {
    session_id: string;
    game_id: string;
    player_id: string;
    // Human name → schema field
    moral_stance: number;         // moral_polarity      -1.0 (merciful) to 1.0 (ruthless)
    approach: number;             // method_intensity     0.0 (diplomacy) to 1.0 (force)
    scale: number;                // social_focus         0.0 (personal) to 1.0 (collective)
    foresight: number;            // temporal_reach       0-10
    pull_on_world: [number, number, number]; // gravitational_distortion [trauma, hope, mystery]
    idea_amplification: Record<string, number>; // concept_resonance
    stability_effect: number;     // coherence_impact     -1.0 to 1.0
}

// ── SAINT narrative gravity — session state ────────────────────────────────
// Persisted in narrative_state table. One record per active session.
// Updated by the Tremor at the end of each turn.

export interface NarrativePhaseState {
    session_id?: string;
    game_id?: string;
    current_phase: string;
    phase_charge: number;         // story_progress    0.0-1.0 toward next phase
    narrative_entropy: number;    // 0.0-1.0 chaos level — rises if player stalls
    archetype_cohesion: number;   // 0.0-1.0 alignment with hero's journey structure
    player_resonance: number;     // 0.0-1.0 player story investment
    inertia_resistance: number;   // 0.0-1.0 progression speed limiter
    // Narrative Gravity System (NGE) global stats
    point_of_no_return: number;   // event_horizon_radius
    pull_conflict: number;        // spaghettification_factor
    story_pace: number;           // temporal_dilation    0.5-2.0
    breaking_point: number;       // singularity_threshold
    event_distortion: number;     // gravitational_lensing
    world_awareness: number;      // swarm_consciousness  0.0-1.0
}

// ── Turn Progress (SSE phase messaging) ──────────────────────────────────
// Sent during turn processing to show which SAINT agent is running

export interface TurnProgress {
    phase: "herald" | "tremor" | "eternal" | "witness" | "prose" | "complete";
    message: string;
}

// ── Herald Beat ───────────────────────────────────────────────────────────
// Herald Step 0 output - brief contextual text shown before the scene

export interface HeraldBeat {
    heraldText: string;
}

// ── Typed relation interfaces ──────────────────────────────────────────────
// These match the typed relation tables in surreal.ts.

export interface LocatedAt {
    in: string;   // world_agent id
    out: string;  // world_location id
    visibility: string;
    purpose?: string;
    since: string;
}

export interface MemberOf {
    in: string;   // world_agent id
    out: string;  // world_faction id
    rank: string;
    loyalty: number;
    standing: number;
}

export interface HeldBy {
    in: string;   // world_item id
    out: string;  // world_agent id
    awareness: number;
    attachment: number;
}

export interface AgentRelationship {
    in: string;   // world_agent id
    out: string;  // world_agent id
    relation_type: string;
    trust: number;
    tension: number;
    conceptual_resonance: number;   // shared_beliefs
    narrative_entanglement: number; // history        0-10
    influence_conduit: number;      // transmission
    gravitational_coupling: number; // bond_strength
    temporal_sync: number;          // memory_alignment
    vector_refraction: [number, number, number]; // influence_bend [moral, method, social]
    plausibility_anchor: number;    // reality_check
}

export interface InfluencedBy {
    in: string;   // world_agent id
    out: string;  // world_agent id (the influencer)
    influence_type: string;         // "ideological", "coercive", "charismatic", "familial", etc.
    strength: number;               // 0.0-1.0 how much this influence shapes behavior
    awareness: number;              // 0.0-1.0 how aware the influenced agent is of the manipulation
    resistance: number;             // 0.0-1.0 how much the agent resists this influence
    vector_shift: [number, number, number]; // [moral, method, social] direction of influence
    plausibility_anchor: number;    // reality_check
}

export interface ParticipatedIn {
    in: string;   // world_agent id
    out: string;  // world_event id
    role: string;                    // "witness", "perpetrator", "victim", "instigator", etc.
    perspective: number;            // 0.0-1.0 how central this was to their experience
    emotional_charge: number;       // -1.0 to 1.0 emotional impact
    memory_clarity: number;         // 0.0-1.0 how well they remember it
    narrative_weight: number;        // 0.0-1.0 significance to their story arc
}

export interface Controls {
    in: string;   // world_faction id
    out: string;  // world_location id
    control_type: string;           // "military", "economic", "political", "cultural", etc.
    strength: number;               // 0.0-1.0 degree of control
    legitimacy: number;             // 0.0-1.0 how accepted the control is
    resistance_level: number;       // 0.0-1.0 amount of resistance present
    resource_extraction: number;     // 0.0-1.0 how much is being extracted
    infrastructure_quality: number; // 0.0-1.0 condition of controlled infrastructure
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TurnInput {
    sessionId: string;
    gameId: string;
    playerId: string;
    chosenOptionId: string;
    chosenOptionText: string;
    worldImpact: Record<string, unknown>;
    turnNumber: number;
}

export interface TurnOutput {
    beat: NarrativeBeat;
    sceneDescription: string;
    heraldText?: string;  // Herald Step 0 output - brief contextual text
    options: NarrativeOption[];
    phaseState: NarrativePhaseState;
    eternalRan: boolean;
    toolCallCount: number;
    durationMs: number;
}

export interface EngineConfig {
    // Model selection
    powerModel: string;
    fastModel: string;
    proseModel: string;

    // Genre tone passed into Prose Agent
    genreTone: "thriller" | "southern_gothic" | "science_fiction" | "fantasy" | "horror";

    // Eternal threshold — only run when significance >= this value
    eternalSignificanceThreshold: number;

    // Max tool steps per agent
    tremorMaxSteps: number;
    eternalMaxSteps: number;
    witnessMaxSteps: number;

    // Phase thresholds (world-builder controlled)
    phaseThresholds: Record<string, number>;

    // Optional: NPC agents to run in parallel after Tremor
    npcAgentIds?: string[];
}
