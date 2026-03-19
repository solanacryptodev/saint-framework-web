import { WorldAgent, WorldConcept, WorldEvent, WorldLocation } from "../../libs/types";

// ═══════════════════════════════════════════════════════════════════════════
// ACE GAME TOOLS - tools that Query, Update, Propagate, Generate and Resolve
// ═══════════════════════════════════════════════════════════════════════════
// Query: Get nearby agents, find events by gravitational_mass, check relationships
// Update: Modify emotional_charge, adjust concept_affinity, deplete agency_quota
// Propagate: Spread concepts via influence_conduit, ripple emotional_charge through relationships
// Generate: Spawn world_event from triggers, create world_concept from high concept_seeding
// Resolve: Heal coherence_stress, promote events to lore_node when significance > threshold
// Calculate: Compute gravitational pull, check phase thresholds, determine swarm_coherence
// ═══════════════════════════════════════════════════════════════════════════

interface CatalystTool {
    name: "catalyst_tool";
    description: "Injects dramatic, extreme, or provocative options to prevent narrative stagnation and create viral moments";

    // Input from current game state
    input: {
        current_scene: WorldEvent;
        player: WorldAgent;
        npcs_present: WorldAgent[];
        location: WorldLocation;
        active_concepts: WorldConcept[];
        recent_options_chosen: string[];      // Last 5 player choices
        tension_history: number[];            // Last 10 tension scores
    };

    // Configuration
    config: {
        drama_threshold: number;              // 0-1: When to trigger (default 0.4)
        escalation_bias: number;              // 0-1: How extreme to go
        viral_targeting: boolean;             // Optimize for shareability
        player_comfort_zone: string[];        // What they usually choose
    };

    // Output
    output: {
        catalyst_options: CatalystOption[];
        injection_reason: string;
        predicted_virality: number;
    };
}

interface CatalystOption {
    id: string;
    text: string;
    option_type: "escalation" | "transgression" | "revelation" | "betrayal" | "sacrifice";
    drama_score: number;                    // 0-1: How dramatic
    moral_weight: number;                   // -1 to 1: Ethical implications
    virality_potential: number;             // 0-1: Shareability
    consequences: {
        immediate: string;
        ripple: string[];
    };
    tags: string[];                         // ["blackmail", "violence", "romance", "betrayal"]
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// GENERATOR GAME TOOLS - Creates narrative options for the player based on world + lore context
// ═══════════════════════════════════════════════════════════════════════════════════════════

// lore_query_relevant(context) - Find lore_nodes related to current situation
// lore_get_by_kind(kind) - Fetch lore by type (character, event, location)
// lore_get_connections(node_id) - Get related_to, caused_by, resulted_in links
// world_query_nearby_actors(location_id, radius) - Get NPCs in vicinity
// world_query_active_events(location_id) - Find unresolved events nearby
// world_get_actor_goals(actor_id) - Read NPC current/hidden goals
// world_query_concepts_by_coherence(threshold) - Find dominant ideologies
// world_get_faction_tensions() - Query faction relationships
// generate_action_options(player_context) - Produce 3-5 meaningful choices
// generate_dialogue_options(npc_id, context) - Create conversation branches
// calculate_option_consequences(option) - Preview potential ripple effects
// check_phase_requirements(phase) - Validate hero's journey progression

// ═══════════════════════════════════════════════════════════════════════════════════════════
// REFLECTOR GAME TOOLS - Processes world changes and signals Curators when lore-worthy events occur
// ═══════════════════════════════════════════════════════════════════════════════════════════

// world_update_actor(actor_id, changes) - Modify actor stats
// world_update_location(location_id, changes) - Modify location state
// world_update_faction(faction_id, changes) - Modify faction stats
// world_create_event(params) - Spawn new world_event
// world_resolve_event(event_id) - Mark event as resolved
// world_create_concept(params) - Spawn new world_concept
// world_update_concept_coherence(concept_id, delta) - Adjust swarm adoption
// world_create_relationship(actor1, actor2, params) - Create knows edge
// world_update_relationship(rel_id, changes) - Modify relationship stats
// propagate_emotional_charge(source_id, radius, decay) - Spread mood through network
// propagate_concept(concept_id, source_id, via_relationships) - Spread ideas via influence_conduit
// propagate_vector_imprint(event_id, via_relationships) - Ripple player influence
// calculate_gravitational_pull(actor_id) - Compute event attraction
// calculate_swarm_coherence(concept_id) - Check adoption percentage
// check_coherence_stress(event_id) - Detect contradictions
// check_significance_threshold(event_id) - Evaluate lore-worthiness
// notify_curator(event_id, reason) - Signal for lore promotion
// notify_curator_contradiction(details) - Signal coherence issue

// ═════════════════════════════════════════════════════════════════════════════════════
// CURATOR GAME TOOLS - Maintains canonical lore and promotes significant world events
// ═════════════════════════════════════════════════════════════════════════════════════

// lore_create_node(params) - Create new lore_node
// lore_update_node(node_id, changes) - Modify existing lore
// lore_set_canon(node_id, bool) - Mark as canonical truth
// lore_create_relationship(node1, node2, type) - Link lore entries (caused_by, related_to)
// lore_merge_nodes(node_ids) - Combine duplicate/related lore
// lore_archive_node(node_id) - Soft-delete outdated lore
// lore_query_contradictions(node_id) - Find conflicting entries
// lore_resolve_contradiction(node_ids, resolution) - Reconcile conflicts
// world_get_event(event_id) - Read event for promotion
// world_get_actor(actor_id) - Read actor for lore creation
// world_get_concept(concept_id) - Read concept for lore creation
// promote_event_to_lore(event_id) - Convert world_event → lore_node
// promote_concept_to_lore(concept_id) - Convert dominant concept → lore
// promote_actor_to_lore(actor_id) - Create/update character lore
// generate_lore_description(entity, context) - Write historical description
// assign_temporal_epoch(node_id, epoch) - Place in timeline
// validate_canon_consistency(node_id) - Check against existing lore

// ═══════════════════════════════════════════════════════════════════════════════════════════
// AGENT GAME TOOLS - Acts/reacts within the world graph based on personal stats and relationships
// ═══════════════════════════════════════════════════════════════════════════════════════════

// self_get_stats() - Read own actor record
// self_update_stats(changes) - Modify own emotional_charge, concept_affinity, etc.
// self_deplete_agency(amount) - Reduce agency_quota
// self_get_goals() - Read current/hidden goals
// self_update_goals(changes) - Modify goals based on events
// query_relationships() - Get all knows edges
// query_relationship_with(actor_id) - Get specific relationship stats
// update_relationship(actor_id, changes) - Modify trust, resonance, etc.
// query_location() - Get current location + its stats
// query_nearby_actors(radius) - Find other NPCs nearby
// query_nearby_events() - Find active events at location
// query_nearby_items() - Find items at location
// evaluate_event_attraction(event_id) - Compare gravitational_mass to own signature
// evaluate_concept_alignment(concept_id) - Compare concept to own affinity
// decide_action(options) - Choose action based on stats + context
// perform_action(action_type, params) - Execute chosen action
// communicate_to_actor(actor_id, message_type, content) - Send to another NPC
// move_to_location(location_id) - Change location
// interact_with_item(item_id, action) - Pick up, use, drop item
// adopt_concept(concept_id, strength) - Add to concept_affinity
// reject_concept(concept_id) - Remove from concept_affinity
// form_alliance(actor_id) - Strengthen relationship
// break_alliance(actor_id) - Weaken/sever relationship

