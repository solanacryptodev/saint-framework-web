import { Surreal } from "surrealdb";
import { getDB } from "./surreal";

// ── SurrealDB Schema for Saint Framework ────────────────────────────────────────

export async function applySchema(db: Surreal) {

  // ── LORE GRAPH ────────────────────────────────────────────────────────────
  // Written once during World Forge. Read-heavy during play.
  // lore_node and lore_relation are immutable after ingestion.
  // lore_event grows during play — one row per player decision.

  await db.query(`
    DEFINE TABLE IF NOT EXISTS lore_node SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS kind         ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS name         ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS description  ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS properties   ON lore_node TYPE object  DEFAULT {};
    DEFINE FIELD IF NOT EXISTS canon        ON lore_node TYPE bool    DEFAULT true;
    DEFINE FIELD IF NOT EXISTS created_at   ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at   ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS lore_node_name ON lore_node COLUMNS name;

    DEFINE TABLE IF NOT EXISTS lore_relation
      TYPE RELATION FROM lore_node TO lore_node SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS relation_type ON lore_relation TYPE string;
    DEFINE FIELD IF NOT EXISTS weight        ON lore_relation TYPE float   DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS established   ON lore_relation TYPE string  DEFAULT "pre-game";
    DEFINE FIELD IF NOT EXISTS metadata      ON lore_relation TYPE object  DEFAULT {};

    -- Append-only event log. Every player decision becomes permanent lore.
    DEFINE TABLE IF NOT EXISTS lore_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id    ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS turn_number   ON lore_event TYPE int;
    DEFINE FIELD IF NOT EXISTS event_kind    ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS description   ON lore_event TYPE string;
    DEFINE FIELD IF NOT EXISTS actors        ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS locations     ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS items         ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS consequences  ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS player_choice ON lore_event TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS created_at    ON lore_event TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS lore_event_session ON lore_event COLUMNS session_id;
  `);

  // ── WORLD GRAPH ───────────────────────────────────────────────────────────
  // Written during World Forge init, mutated every turn during play.
  // This is the live simulation state the ACE agents read and write.

  await db.query(`
    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD AGENT - Narrative gravity drivers
    -- Every character and NPC with live position + behavioral state
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_agent SCHEMAFULL;

    DEFINE FIELD IF NOT EXISTS lore_ref     ON world_agent TYPE string;
    DEFINE FIELD IF NOT EXISTS name         ON world_agent TYPE string;
    DEFINE FIELD IF NOT EXISTS kind         ON world_agent TYPE string; -- player|npc|faction_rep
    DEFINE FIELD IF NOT EXISTS location_id  ON world_agent TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS disposition  ON world_agent TYPE string DEFAULT "neutral";
    DEFINE FIELD IF NOT EXISTS awareness    ON world_agent TYPE string DEFAULT "unaware";
    DEFINE FIELD IF NOT EXISTS goal_current ON world_agent TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS goal_hidden  ON world_agent TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS state        ON world_agent TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS active       ON world_agent TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS updated_at   ON world_agent TYPE datetime DEFAULT time::now();
    
    -- === NARRATIVE PHYSICS ===
    DEFINE FIELD IF NOT EXISTS narrative_weight ON world_agent TYPE float DEFAULT 0.2;
    -- 0.0-1.0: Story importance, affects gravitational pull

    DEFINE FIELD IF NOT EXISTS gravitational_signature ON world_agent TYPE array<float> DEFAULT [0.3, 0.3, 0.3];
    -- [trauma, hope, mystery]: What events attract this agent

    DEFINE FIELD IF NOT EXISTS emotional_charge ON world_agent TYPE float DEFAULT 0.0;
    -- -1.0 (despair) to 1.0 (joy): Current emotional state, spreads to nearby agents

    -- === PLAYER INFLUENCE ===
    DEFINE FIELD IF NOT EXISTS influence_resonance ON world_agent TYPE float DEFAULT 0.5;
    -- 0.0-1.0: How much player actions amplify through this agent

    DEFINE FIELD IF NOT EXISTS vector_susceptibility ON world_agent TYPE array<float> DEFAULT [0.5, 0.5, 0.5];
    -- [moral, method, social]: Response to player's influence vectors

    -- === CONCEPT SYSTEM ===
    DEFINE FIELD IF NOT EXISTS concept_affinity ON world_agent TYPE object DEFAULT {};
    -- {"revenge": 0.8, "redemption": -0.3}: Attraction/repulsion to narrative concepts

    -- === COHERENCE ===
    DEFINE FIELD IF NOT EXISTS plausibility_threshold ON world_agent TYPE float DEFAULT 0.6;
    -- 0.0-1.0: Minimum believability for accepting events

    DEFINE FIELD IF NOT EXISTS coherence_contribution ON world_agent TYPE float DEFAULT 0.5;
    -- 0.0-1.0: Tendency to resolve contradictions

    -- === AGENCY ===
    DEFINE FIELD IF NOT EXISTS agency_quota ON world_agent TYPE int DEFAULT 100;
    -- 0-100: Daily action capacity (depletes with activity)

    DEFINE FIELD IF NOT EXISTS emergence_potential ON world_agent TYPE float DEFAULT 0.3;
    -- 0.0-1.0: Likelihood to initiate new narratives

    -- === TEMPORAL ===
    DEFINE FIELD IF NOT EXISTS temporal_focus ON world_agent TYPE float DEFAULT 0.5;
    -- 0.0 (past-focused) to 1.0 (future-focused): Affects memory/foresight
    DEFINE INDEX IF NOT EXISTS world_agent_name ON world_agent COLUMNS name;


    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD LOCATION - Narrative gravity drivers
    -- Every location with current danger level and unrevealed secrets
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_location SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref          ON world_location TYPE string;
    DEFINE FIELD IF NOT EXISTS name              ON world_location TYPE string;
    DEFINE FIELD IF NOT EXISTS region            ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS accessible        ON world_location TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS danger_level      ON world_location TYPE float  DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS atmosphere        ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS secrets           ON world_location TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS revealed_secrets  ON world_location TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS state             ON world_location TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS updated_at        ON world_location TYPE datetime DEFAULT time::now();

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD ITEM - Narrative gravity drivers
    -- Every item with current holder and player awareness
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_item SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref         ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS name             ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS holder_actor     ON world_item TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS location_id      ON world_item TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS accessible       ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS known_to_player  ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS condition        ON world_item TYPE string DEFAULT "intact";
    DEFINE FIELD IF NOT EXISTS state            ON world_item TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS updated_at       ON world_item TYPE datetime DEFAULT time::now();

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD THREAD - Narrative gravity drivers
    -- Open narrative threads. Tension and urgency drift each turn.
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_thread SCHEMAFULL;

    DEFINE FIELD IF NOT EXISTS session_id         ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS name               ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS description        ON world_thread TYPE string;
    DEFINE FIELD IF NOT EXISTS tension            ON world_thread TYPE float DEFAULT 0.3;
    DEFINE FIELD IF NOT EXISTS urgency            ON world_thread TYPE float DEFAULT 0.3;
    DEFINE FIELD IF NOT EXISTS active             ON world_thread TYPE bool  DEFAULT true;
    DEFINE FIELD IF NOT EXISTS turn_opened        ON world_thread TYPE int   DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS turn_resolved      ON world_thread TYPE option<int>;
    DEFINE FIELD IF NOT EXISTS involved_actors    ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS involved_locations ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS consequence_seeds  ON world_thread TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS updated_at         ON world_thread TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_thread_session ON world_thread COLUMNS session_id;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD EDGE - Narrative gravity drivers
    -- Spatial and relational edges: AT, LEADS_TO, HOLDS, AWARE_OF, GUARDS
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_edge TYPE RELATION SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS edge_type     ON world_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS weight        ON world_edge TYPE float DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS bidirectional ON world_edge TYPE bool  DEFAULT false;
    DEFINE FIELD IF NOT EXISTS metadata      ON world_edge TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS active        ON world_edge TYPE bool  DEFAULT true;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD EVENT - Narrative gravity drivers
    -- Events pull agents toward them based on emotional significance
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_event SCHEMAFULL;

    -- Identity
    DEFINE FIELD IF NOT EXISTS lore_ref           ON world_event TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS name               ON world_event TYPE string;
    DEFINE FIELD IF NOT EXISTS description        ON world_event TYPE string DEFAULT "";

    -- Participants
    DEFINE FIELD IF NOT EXISTS participants       ON world_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS location_id        ON world_event TYPE option<string>;

    -- Narrative Gravity: [trauma, hope, mystery] - what kind of pull this event exerts
    DEFINE FIELD IF NOT EXISTS gravitational_mass ON world_event TYPE array<float> DEFAULT [0.0, 0.0, 0.0];
    DEFINE FIELD IF NOT EXISTS swarm_attention    ON world_event TYPE float DEFAULT 0.0;

    -- Coherence: how stable/believable this event is
    DEFINE FIELD IF NOT EXISTS coherence_stress   ON world_event TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS plausibility_decay ON world_event TYPE float DEFAULT 0.1;

    -- Player Influence: [moral, method, social] signature left by player
    DEFINE FIELD IF NOT EXISTS vector_imprint     ON world_event TYPE array<float> DEFAULT [0.0, 0.0, 0.0];

    -- Propagation: what ideas spawn from this event
    DEFINE FIELD IF NOT EXISTS concept_seeding    ON world_event TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS temporal_ripple    ON world_event TYPE int DEFAULT 0;

    -- Phase Progression: contribution to hero's journey
    DEFINE FIELD IF NOT EXISTS phase_charge       ON world_event TYPE float DEFAULT 0.0;

    -- State
    DEFINE FIELD IF NOT EXISTS significance       ON world_event TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS resolved           ON world_event TYPE bool DEFAULT false;
    DEFINE FIELD IF NOT EXISTS known_to_player    ON world_event TYPE bool DEFAULT false;

    -- Metadata
    DEFINE FIELD IF NOT EXISTS state              ON world_event TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at         ON world_event TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at         ON world_event TYPE datetime DEFAULT time::now();

    -- Indexes
    DEFINE INDEX IF NOT EXISTS world_event_location ON world_event COLUMNS location_id;
    DEFINE INDEX IF NOT EXISTS world_event_resolved ON world_event COLUMNS resolved;


    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD CONCEPT - Ideas that propagate through the swarm
    -- Concepts spread, mutate, and become dominant ideologies when swarm_coherence > 0.75
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_concept SCHEMAFULL;

    -- Identity
    DEFINE FIELD IF NOT EXISTS lore_ref              ON world_concept TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS name                  ON world_concept TYPE string;
    DEFINE FIELD IF NOT EXISTS description           ON world_concept TYPE string DEFAULT "";

    -- Emotional Weight
    DEFINE FIELD IF NOT EXISTS emotional_valence     ON world_concept TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS narrative_density     ON world_concept TYPE float DEFAULT 0.3;

    -- Player Influence: [moral, method, social] amplification when concept is active
    DEFINE FIELD IF NOT EXISTS vector_amplification  ON world_concept TYPE array<float> DEFAULT [1.0, 1.0, 1.0];

    -- Propagation
    DEFINE FIELD IF NOT EXISTS swarm_coherence       ON world_concept TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS mutation_rate         ON world_concept TYPE float DEFAULT 0.1;
    DEFINE FIELD IF NOT EXISTS gravitational_drag    ON world_concept TYPE float DEFAULT 0.5;

    -- Coherence
    DEFINE FIELD IF NOT EXISTS plausibility_anchor   ON world_concept TYPE float DEFAULT 0.5;

    -- Relationships
    DEFINE FIELD IF NOT EXISTS opposes               ON world_concept TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS evolves_from          ON world_concept TYPE option<string>;

    -- State
    DEFINE FIELD IF NOT EXISTS active                ON world_concept TYPE bool DEFAULT true;
    DEFINE FIELD IF NOT EXISTS known_to_player       ON world_concept TYPE bool DEFAULT false;

    -- Metadata
    DEFINE FIELD IF NOT EXISTS state                 ON world_concept TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at            ON world_concept TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at            ON world_concept TYPE datetime DEFAULT time::now();

    -- Indexes
    DEFINE INDEX IF NOT EXISTS world_concept_name ON world_concept COLUMNS name;
    DEFINE INDEX IF NOT EXISTS world_concept_coherence ON world_concept COLUMNS swarm_coherence;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD FACTION - Groups that propagate through the swarm
    -- Factions spread, mutate, and become dominant ideologies when swarm_coherence > 0.75
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_faction SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS lore_ref                  ON world_faction TYPE string;
    DEFINE FIELD IF NOT EXISTS name                      ON world_faction TYPE string;
    DEFINE FIELD IF NOT EXISTS faction_type              ON world_faction TYPE string DEFAULT "agency";
    DEFINE FIELD IF NOT EXISTS status                    ON world_faction TYPE string DEFAULT "active";

    -- Membership
    DEFINE FIELD IF NOT EXISTS leadership_ids            ON world_faction TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS member_ids                ON world_faction TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS territory_ids             ON world_faction TYPE array<string> DEFAULT [];

    -- SAINT Framework: Narrative Gravity
    DEFINE FIELD IF NOT EXISTS narrative_weight          ON world_faction TYPE float  DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS gravitational_mass        ON world_faction TYPE object DEFAULT {
      trauma: 0.0,
      hope: 0.0,
      mystery: 0.0
    };
    DEFINE FIELD IF NOT EXISTS emotional_charge          ON world_faction TYPE float  DEFAULT 0.5;

    -- SAINT Framework: Ideological Core
    DEFINE FIELD IF NOT EXISTS concept_affinity          ON world_faction TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS concept_orthodoxy         ON world_faction TYPE float  DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS concept_propagation_rate  ON world_faction TYPE float  DEFAULT 0.3;

    -- SAINT Framework: Swarm Dynamics
    DEFINE FIELD IF NOT EXISTS internal_coherence        ON world_faction TYPE float  DEFAULT 0.7;
    DEFINE FIELD IF NOT EXISTS vector_doctrine           ON world_faction TYPE object DEFAULT {
      moral: 0.0,
      method: 0.0,
      social: 0.0
    };
    DEFINE FIELD IF NOT EXISTS vector_enforcement        ON world_faction TYPE float  DEFAULT 0.5;

    -- SAINT Framework: Inter-Faction Relations
    DEFINE FIELD IF NOT EXISTS alliances                 ON world_faction TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS hostilities               ON world_faction TYPE array<object> DEFAULT [];

    -- SAINT Framework: Player Relationship
    DEFINE FIELD IF NOT EXISTS player_standing           ON world_faction TYPE float  DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS player_known_to           ON world_faction TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS player_perceived_alignment ON world_faction TYPE float DEFAULT 0.0;

    DEFINE FIELD IF NOT EXISTS state                     ON world_faction TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS updated_at                ON world_faction TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_faction_name        ON world_faction COLUMNS name;
    DEFINE INDEX IF NOT EXISTS world_faction_type        ON world_faction COLUMNS faction_type;
  `);

  // ── ACE SYSTEM TABLES ─────────────────────────────────────────────────────
  // Infrastructure for the agent pipeline.

  await db.query(`
    -- Dynamic agent definitions (persisted, rehydrated on boot)
    DEFINE TABLE IF NOT EXISTS agent_definition SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS name         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS role         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS instructions ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS model        ON agent_definition TYPE string DEFAULT "gpt-4o-mini";
    DEFINE FIELD IF NOT EXISTS tools        ON agent_definition TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS active       ON agent_definition TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS metadata     ON agent_definition TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at   ON agent_definition TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS agent_name   ON agent_definition COLUMNS name UNIQUE;

    -- Structured agent output log (separate from lore_event which is player-facing)
    DEFINE TABLE IF NOT EXISTS narrative_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS agent_name ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS event_type ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS content    ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS metadata   ON narrative_event TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at ON narrative_event TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS narrative_session ON narrative_event COLUMNS session_id;
  `);
}

// ── Game Schema ──────────────────────────────────────────────────────────────────

export async function applyGameSchema() {
  const db = await getDB();

  await db.query(`
    DEFINE TABLE game SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS creator_id    ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS name          ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS tagline       ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS description   ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS cost_tier     ON game TYPE string DEFAULT "free";
    DEFINE FIELD IF NOT EXISTS genre         ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS tags          ON game TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS cover_image   ON game TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS status        ON game TYPE string DEFAULT "draft";
    DEFINE FIELD IF NOT EXISTS source_file   ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS lore_nodes    ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS lore_edges    ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS world_agents  ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS world_threads ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS cost          ON game TYPE int    DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS visibility    ON game TYPE string DEFAULT "private";
    DEFINE FIELD IF NOT EXISTS created_at    ON game TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at    ON game TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS launched_at   ON game TYPE option<datetime>;
    DEFINE INDEX IF NOT EXISTS game_creator  ON game COLUMNS creator_id;
  `);
}

//--- Entity Asset Schema ---

export async function applyEntityAssetSchema() {
  const db = await getDB();

  await db.query(`
    DEFINE TABLE IF NOT EXISTS entity_asset SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS game_id       ON entity_asset TYPE string;
    DEFINE FIELD IF NOT EXISTS lore_node_id  ON entity_asset TYPE string;
    DEFINE FIELD IF NOT EXISTS image_url     ON entity_asset TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS audio_url     ON entity_asset TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS notes         ON entity_asset TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS updated_at    ON entity_asset TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS asset_game    ON entity_asset COLUMNS game_id;
    DEFINE INDEX IF NOT EXISTS asset_node    ON entity_asset COLUMNS lore_node_id;
  `);
}

// ── Player Character Schema ──────────────────────────────────────────────────────────────────

export async function applyPlayerCharacterSchema() {
  const db = await getDB();

  await db.query(`
    -- What the world-builder defined in ## Player Character
    DEFINE TABLE IF NOT EXISTS player_character_template SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS game_id          ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS base_name        ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS description      ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS fixed_traits     ON player_character_template TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS backstory_options ON player_character_template TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS trait_options    ON player_character_template TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS item_options     ON player_character_template TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS max_item_picks   ON player_character_template TYPE int DEFAULT 1;
    DEFINE FIELD IF NOT EXISTS allow_custom_name ON player_character_template TYPE bool DEFAULT true;
    DEFINE FIELD IF NOT EXISTS allow_portrait   ON player_character_template TYPE bool DEFAULT true;
    DEFINE FIELD IF NOT EXISTS starting_location ON player_character_template TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS lore_node_id     ON player_character_template TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS raw_markdown     ON player_character_template TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS created_at       ON player_character_template TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS pct_game         ON player_character_template COLUMNS game_id UNIQUE;

    -- What the player chose at character creation
    DEFINE TABLE IF NOT EXISTS player_character SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS game_id          ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS player_id        ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS session_id       ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS template_id      ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS display_name     ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS portrait_url     ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS chosen_backstory ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS chosen_traits    ON player_character TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS chosen_items     ON player_character TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS world_actor_id   ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS created_at       ON player_character TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS pc_session       ON player_character COLUMNS session_id UNIQUE;
    DEFINE INDEX IF NOT EXISTS pc_player_game   ON player_character COLUMNS player_id, game_id;
  `);
}
