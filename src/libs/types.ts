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

export interface WorldNode {
    id: string;
    kind: "character" | "faction" | "location" | "item" | "event" | "concept";
    name: string;
    description: string;
    properties: Record<string, unknown>;
    canon: boolean;
    related_out?: Pick<WorldNode, "id" | "kind" | "name">[];
    related_in?: Pick<WorldNode, "id" | "kind" | "name">[];
}

export interface WorldAgent {
    id: string;
    lore_ref: string;
    name: string;
    kind: "player" | "npc" | "faction_rep";
    location_id: string;
    disposition: "hostile" | "neutral" | "friendly" | "unknown";
    awareness: "unaware" | "suspicious" | "alerted" | "hostile" | "allied";
    goal_current: string;
    goal_hidden: string;
    state: Record<string, unknown>;
    active: boolean;
}

export interface WorldLocation {
    id: string;
    lore_ref: string;
    name: string;
    region: string;
    accessible: boolean;
    danger_level: number;
    atmosphere: string;
    secrets: string[];
    revealed_secrets: string[];
    state: Record<string, unknown>;
}

export interface WorldItem {
    id: string;
    lore_ref: string;
    name: string;
    holder_actor?: string;
    location_id?: string;
    accessible: boolean;
    known_to_player: boolean;
    condition: string;
    state: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD EVENT - Narrative gravity drivers
// ═══════════════════════════════════════════════════════════════════════════

export interface WorldEvent {
    id: string;
    lore_ref?: string;
    name: string;
    description: string;

    // === PARTICIPANTS ===
    participants: string[];              // world_actor IDs involved
    location_id?: string;                // where event occurs

    // === NARRATIVE GRAVITY ===
    gravitational_mass: [number, number, number];  // [trauma, hope, mystery] 0.0-1.0
    swarm_attention: number;             // 0.0-1.0: % of agents focused on this

    // === COHERENCE ===
    coherence_stress: number;            // 0.0-1.0: contradiction potential
    plausibility_decay: number;          // 0.0-1.0: rate of believability loss

    // === PLAYER INFLUENCE ===
    vector_imprint: [number, number, number];  // [moral, method, social] -1.0 to 1.0

    // === PROPAGATION ===
    concept_seeding: Record<string, number>;   // {"betrayal": 0.8, "hope": 0.3}
    temporal_ripple: number;             // 0-10: future impact waves

    // === PHASE PROGRESSION ===
    phase_charge: number;                // 0.0-1.0: hero's journey progression contribution

    // === STATE ===
    significance: number;                // 0.0-1.0: threshold for becoming lore
    resolved: boolean;
    known_to_player: boolean;

    // === METADATA ===
    state: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD CONCEPT - Ideas that propagate through the swarm
// ═══════════════════════════════════════════════════════════════════════════

export interface WorldConcept {
    id: string;
    lore_ref?: string;
    name: string;
    description: string;

    // === EMOTIONAL WEIGHT ===
    emotional_valence: number;           // -1.0 (negative) to 1.0 (positive)
    narrative_density: number;           // 0.0-1.0: story-generating potential

    // === PLAYER INFLUENCE ===
    vector_amplification: [number, number, number];  // [moral, method, social] multipliers

    // === PROPAGATION ===
    swarm_coherence: number;             // 0.0-1.0: % of agents adopting (>0.75 = dominant)
    mutation_rate: number;               // 0.0-1.0: likelihood to evolve
    gravitational_drag: number;          // 0.0-1.0: resistance to displacement

    // === COHERENCE ===
    plausibility_anchor: number;         // 0.0-1.0: reality reinforcement strength

    // === RELATIONSHIPS ===
    opposes: string[];                   // concept IDs this opposes
    evolves_from?: string;               // parent concept ID

    // === STATE ===
    active: boolean;
    known_to_player: boolean;

    // === METADATA ===
    state: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
}

export interface WorldThread {
    id: string;
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

export interface WorldSnapshot {
    agents: WorldAgent[];
    locations: WorldLocation[];
    items: WorldItem[];
    events: WorldEvent[];
    concepts: WorldConcept[];
    threads: WorldThread[];
    snapshotAt: string;
}

/**
 * Describes how a chosen option should mutate the World Graph.
 * Written by Generators, validated by Curators, applied by the Hero Agent.
 */
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

export interface BackstoryOption {
    id: string;
    name: string;
    description: string;
}

export interface StartingItemOption {
    id: string;
    name: string;
    description: string;
}

export interface PlayerCharacterTemplate {
    id?: string;
    game_id: string;
    base_name: string;
    description: string;
    fixed_traits: string[];
    backstory_options: BackstoryOption[];
    trait_options: string[];
    item_options: StartingItemOption[];
    max_item_picks: number;
    allow_custom_name: boolean;
    allow_portrait: boolean;
    starting_location: string;
    lore_node_id?: string | null;
    raw_markdown: string;
    created_at?: string;
}

export interface PlayerCharacter {
    id?: string;
    game_id: string;
    player_id: string;
    session_id: string;
    template_id: string;
    display_name: string;
    portrait_url?: string | null;
    chosen_backstory?: string | null;
    chosen_traits: string[];
    chosen_items: string[];
    world_actor_id?: string | null;
    created_at?: string;
}

export interface IngestionProgress {
    phase: "chunking" | "extracting" | "validating" | "world_init" | "complete";
    message: string;
    percent: number;
}