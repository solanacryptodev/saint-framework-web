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
    DEFINE FIELD IF NOT EXISTS kind           ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS name           ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS description    ON lore_node TYPE string;
    DEFINE FIELD IF NOT EXISTS canon          ON lore_node TYPE bool    DEFAULT false;
    DEFINE FIELD IF NOT EXISTS significance   ON lore_node TYPE float   DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS epoch          ON lore_node TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS temporal_order ON lore_node TYPE option<int>;
    DEFINE FIELD IF NOT EXISTS properties ON lore_node FLEXIBLE TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at     ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at     ON lore_node TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS lore_node_name  ON lore_node COLUMNS name;
    DEFINE INDEX IF NOT EXISTS lore_node_kind  ON lore_node COLUMNS kind;
    DEFINE INDEX IF NOT EXISTS lore_node_canon ON lore_node COLUMNS canon;

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
    DEFINE FIELD IF NOT EXISTS agents        ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS locations     ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS items         ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS factions      ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS concepts      ON lore_event TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS events       ON lore_event TYPE array<string> DEFAULT [];
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

    DEFINE TABLE IF NOT EXISTS world_agent SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id       ON world_agent TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id    ON world_agent TYPE string DEFAULT "WORLD_INIT";
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
    -- === LEVERAGE SYSTEM ===
    DEFINE FIELD IF NOT EXISTS known_leverage      ON world_agent TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS hidden_leverage     ON world_agent TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS leverage_resistance ON world_agent TYPE float DEFAULT 0.5;
    -- === DRAMA DEBT ===
    DEFINE FIELD IF NOT EXISTS drama_debt ON world_agent TYPE object DEFAULT { accumulated: 0.0, turns_since_impact: 0, last_impact_turn: 0, tolerance: 5 };


    -- ═══════════════════════════════════════════════════════════════════
    -- WORLD LOCATION — Places with environmental memory and SAINT physics
    -- ═══════════════════════════════════════════════════════════════════
    DEFINE TABLE IF NOT EXISTS world_location SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id       ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id    ON world_location TYPE string DEFAULT "WORLD_INIT";
 
    -- Identity
    DEFINE FIELD IF NOT EXISTS lore_ref     ON world_location TYPE option<record<lore_node>>;
    DEFINE FIELD IF NOT EXISTS name         ON world_location TYPE string;
    DEFINE FIELD IF NOT EXISTS description  ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS region       ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS parent       ON world_location TYPE option<record<world_location>>;
      -- Hierarchical nesting: Sector 7 → Underspire → Ashenveil
 
    -- Accessibility
    DEFINE FIELD IF NOT EXISTS accessible       ON world_location TYPE bool  DEFAULT true;
    DEFINE FIELD IF NOT EXISTS atmosphere       ON world_location TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS secrets          ON world_location TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS revealed_secrets ON world_location TYPE array<string> DEFAULT [];
 
    -- SAINT narrative physics
    DEFINE FIELD IF NOT EXISTS gravitational_signature ON world_location TYPE array<float> DEFAULT [0.3, 0.3, 0.3];
      -- [trauma, hope, mystery]: Ambient pull — agents drawn to match their own signature
    DEFINE FIELD IF NOT EXISTS emotional_charge ON world_location TYPE float DEFAULT 0.0;
      -- -1.0 to 1.0: Current atmosphere/mood of this place
 
    -- Environmental memory — locations remember what happened here
    DEFINE FIELD IF NOT EXISTS concept_imprint ON world_location TYPE object DEFAULT {};
      -- {"violence": 0.7, "sacred": 0.5}: Residual concepts from past events
    DEFINE FIELD IF NOT EXISTS memory_decay    ON world_location TYPE float DEFAULT 0.05;
      -- 0.0-1.0: Daily rate at which concept_imprint fades toward 0
 
    -- Coherence modifier
    DEFINE FIELD IF NOT EXISTS plausibility_modifier ON world_location TYPE float DEFAULT 0.0;
      -- -0.5 to 0.5: Shifts agent plausibility thresholds (magical areas, cursed ground)
 
    -- Movement and control
    DEFINE FIELD IF NOT EXISTS traversal_risk  ON world_location TYPE float DEFAULT 0.0;
      -- 0.0-1.0: Risk to agents moving through this location
    DEFINE FIELD IF NOT EXISTS controlled_by   ON world_location TYPE option<record<world_faction>>;
      -- Faction that currently controls this location (typed reference)
 
    DEFINE FIELD IF NOT EXISTS state       ON world_location TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at  ON world_location TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at  ON world_location TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_location_name ON world_location COLUMNS name;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD ITEM - Narrative gravity drivers
    -- Every item with current holder and player awareness
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_item SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id           ON world_item TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id        ON world_item TYPE string DEFAULT "WORLD_INIT";
    DEFINE FIELD IF NOT EXISTS lore_ref         ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS name             ON world_item TYPE string;
    DEFINE FIELD IF NOT EXISTS description      ON world_item TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS kind             ON world_item TYPE string DEFAULT "artifact";
      -- "artifact"|"weapon"|"key"|"document"|"relic"|"tool"
 
    -- SAINT narrative physics
    DEFINE FIELD IF NOT EXISTS narrative_weight  ON world_item TYPE float DEFAULT 0.1;
      -- 0.0-1.0: Story importance. MacGuffins score high. Mundane items score low.
    DEFINE FIELD IF NOT EXISTS gravitational_mass ON world_item TYPE array<float> DEFAULT [0.0, 0.0, 0.0];
      -- [trauma, hope, mystery]: Pull on agents who are seeking or aware of this item
 
    -- Concept association — items embody and transfer ideas
    DEFINE FIELD IF NOT EXISTS concept_affinity ON world_item TYPE object DEFAULT {};
      -- {"power": 0.9, "corruption": 0.6}: Ideas this item embodies
    DEFINE FIELD IF NOT EXISTS concept_transfer ON world_item TYPE float DEFAULT 0.0;
      -- 0.0-1.0: Strength with which item transfers its concepts to its holder each turn
 
    -- Ownership (typed references — no dangling string IDs)
    DEFINE FIELD IF NOT EXISTS held_by     ON world_item TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS location_id ON world_item TYPE option<string>;
 
    -- Coherence
    DEFINE FIELD IF NOT EXISTS plausibility_anchor ON world_item TYPE float DEFAULT 0.5;
      -- 0.0-1.0: Reality reinforcement. High for world-defining artifacts like the Void Ledger.
 
    -- State
    DEFINE FIELD IF NOT EXISTS accessible      ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS known_to_player ON world_item TYPE bool   DEFAULT false;
    DEFINE FIELD IF NOT EXISTS condition       ON world_item TYPE string DEFAULT "intact";
    DEFINE FIELD IF NOT EXISTS state           ON world_item TYPE object DEFAULT {};
    DEFINE FIELD IF NOT EXISTS created_at      ON world_item TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at      ON world_item TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS world_item_name ON world_item COLUMNS name;
    -- ═══════════════════════════════════════════════════════════════════════════
    -- WORLD THREAD - Narrative gravity drivers
    -- Open narrative threads. Tension and urgency drift each turn.
    -- ═══════════════════════════════════════════════════════════════════════════

    DEFINE TABLE IF NOT EXISTS world_thread SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id            ON world_thread TYPE string DEFAULT "";
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

    DEFINE TABLE IF NOT EXISTS world_event SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id           ON world_event TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id        ON world_event TYPE string DEFAULT "WORLD_INIT";

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

    DEFINE TABLE IF NOT EXISTS world_concept SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id              ON world_concept TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id           ON world_concept TYPE string DEFAULT "WORLD_INIT";

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

    DEFINE TABLE IF NOT EXISTS world_faction SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS game_id                  ON world_faction TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS session_id               ON world_faction TYPE string DEFAULT "WORLD_INIT";
    DEFINE FIELD IF NOT EXISTS lore_ref                  ON world_faction TYPE string;
    DEFINE FIELD IF NOT EXISTS name                      ON world_faction TYPE string;
    DEFINE FIELD IF NOT EXISTS faction_type              ON world_faction TYPE string DEFAULT "agency";
    DEFINE FIELD IF NOT EXISTS status                    ON world_faction TYPE string DEFAULT "active";
    DEFINE FIELD IF NOT EXISTS description               ON world_faction TYPE string DEFAULT "";

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
    DEFINE FIELD IF NOT EXISTS swarm_coherence            ON world_faction TYPE float DEFAULT 0.0; -- 0-1: faction-wide ideological unity

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

    -- ═══════════════════════════════════════════════════════════════════
    -- TYPED RELATIONS — Narrative semantics with story-meaningful fields
    -- ═══════════════════════════════════════════════════════════════════
 
    -- Actor current location (replaces location_id field on world_agent)
    DEFINE TABLE IF NOT EXISTS located_at TYPE RELATION
      FROM world_agent TO world_location SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS visibility ON located_at TYPE string DEFAULT "present";
    DEFINE FIELD IF NOT EXISTS purpose    ON located_at TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS since      ON located_at TYPE datetime DEFAULT time::now();
 
    -- Actor faction membership
    DEFINE TABLE IF NOT EXISTS member_of TYPE RELATION
      FROM world_agent TO world_faction SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS rank     ON member_of TYPE string DEFAULT "member";
    DEFINE FIELD IF NOT EXISTS loyalty  ON member_of TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS standing ON member_of TYPE float DEFAULT 0.5;
 
    -- Item holder (replaces holder_actor field on world_item)
    DEFINE TABLE IF NOT EXISTS held_by TYPE RELATION
      FROM world_item TO world_agent SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS awareness  ON held_by TYPE float DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS attachment ON held_by TYPE float DEFAULT 0.5;
 
    -- Actor-to-actor relationships (the social graph)
    DEFINE TABLE IF NOT EXISTS relationship TYPE RELATION
      FROM world_agent TO world_agent SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS relation_type           ON relationship TYPE string;
    DEFINE FIELD IF NOT EXISTS trust                   ON relationship TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS tension                 ON relationship TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS conceptual_resonance    ON relationship TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS narrative_entanglement  ON relationship TYPE int DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS influence_conduit       ON relationship TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS gravitational_coupling  ON relationship TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS temporal_sync           ON relationship TYPE float DEFAULT 0.5; -- memory alignment over time
    DEFINE FIELD IF NOT EXISTS vector_refraction       ON relationship TYPE array<float> DEFAULT [0.5, 0.5, 0.5]; -- [moral, method, social] distortion
    DEFINE FIELD IF NOT EXISTS plausibility_anchor     ON relationship TYPE float DEFAULT 0.5; -- mutual reality reinforcement
    DEFINE FIELD IF NOT EXISTS updated_at              ON relationship TYPE datetime DEFAULT time::now();
 
    -- Actor adopting a concept
    DEFINE TABLE IF NOT EXISTS influenced_by TYPE RELATION
      FROM world_agent TO world_concept SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS strength   ON influenced_by TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS adopted_at ON influenced_by TYPE datetime DEFAULT time::now();
 
    -- Actor participating in an event
    DEFINE TABLE IF NOT EXISTS participated_in TYPE RELATION
      FROM world_agent TO world_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS role         ON participated_in TYPE string DEFAULT "witness";
    DEFINE FIELD IF NOT EXISTS impact_felt  ON participated_in TYPE float DEFAULT 0.5;
 
    -- Faction controlling a location
    DEFINE TABLE IF NOT EXISTS controls TYPE RELATION
      FROM world_faction TO world_location SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS control_strength ON controls TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS contested        ON controls TYPE bool DEFAULT false;

  `);

  // ── ACE SYSTEM TABLES ─────────────────────────────────────────────────────
  // Infrastructure for the agent pipeline.

  await db.query(`
  --Dynamic agent definitions(persisted, rehydrated on boot)
    DEFINE TABLE IF NOT EXISTS agent_definition SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS name         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS role         ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS instructions ON agent_definition TYPE string;
    DEFINE FIELD IF NOT EXISTS model        ON agent_definition TYPE string DEFAULT "gpt-4o-mini";
    DEFINE FIELD IF NOT EXISTS tools        ON agent_definition TYPE array < string > DEFAULT[];
    DEFINE FIELD IF NOT EXISTS active       ON agent_definition TYPE bool   DEFAULT true;
    DEFINE FIELD IF NOT EXISTS metadata     ON agent_definition TYPE object DEFAULT { };
    DEFINE FIELD IF NOT EXISTS created_at   ON agent_definition TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS agent_name   ON agent_definition COLUMNS name UNIQUE;

  --Structured agent output log(separate from lore_event which is player - facing)
    DEFINE TABLE IF NOT EXISTS narrative_event SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS session_id ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS agent_name ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS event_type ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS content    ON narrative_event TYPE string;
    DEFINE FIELD IF NOT EXISTS metadata   ON narrative_event TYPE object DEFAULT { };
    DEFINE FIELD IF NOT EXISTS created_at ON narrative_event TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS narrative_session ON narrative_event COLUMNS session_id;
  `);
}

// ── Game Schema ──────────────────────────────────────────────────────────────────

export async function applyGameSchema() {
  const db = await getDB();

  await db.query(`
    DEFINE TABLE IF NOT EXISTS game SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS creator_id    ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS name          ON game TYPE string;
    DEFINE FIELD IF NOT EXISTS tagline       ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS description   ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS cost_tier     ON game TYPE string DEFAULT "free";
    DEFINE FIELD IF NOT EXISTS genre         ON game TYPE string DEFAULT "";
    DEFINE FIELD IF NOT EXISTS tags          ON game TYPE array < string > DEFAULT[];
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
// Section 1A: Full schema rewrite per TODO_3.md

export async function applyPlayerCharacterSchema() {
  const db = await getDB();

  await db.query(`
    -- ── player_character_template ──────────────────────────────────────────────

    DEFINE TABLE IF NOT EXISTS player_character_template SCHEMAFULL;

    -- Scope
    DEFINE FIELD IF NOT EXISTS game_id   ON player_character_template TYPE string;

    DEFINE FIELD IF NOT EXISTS kind   ON player_character_template TYPE string DEFAULT 'template';
    DEFINE FIELD IF NOT EXISTS status ON player_character_template TYPE string DEFAULT 'published';

    -- Identity
    DEFINE FIELD IF NOT EXISTS base_name     ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS description   ON player_character_template TYPE string DEFAULT '';
    DEFINE FIELD IF NOT EXISTS portrait_url  ON player_character_template TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS lore_node_id  ON player_character_template TYPE option<string>;

    -- Customization arrays
    DEFINE FIELD IF NOT EXISTS fixed_traits  ON player_character_template TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS trait_options ON player_character_template TYPE array<string> DEFAULT [];

    -- Nested object arrays — must define [*] fields or content is dropped
    DEFINE FIELD IF NOT EXISTS backstory_options             ON player_character_template TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS backstory_options[*]          ON player_character_template TYPE object;
    DEFINE FIELD IF NOT EXISTS backstory_options[*].id       ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS backstory_options[*].label    ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS backstory_options[*].description ON player_character_template TYPE string;

    DEFINE FIELD IF NOT EXISTS item_options              ON player_character_template TYPE array<object> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS item_options[*]           ON player_character_template TYPE object;
    DEFINE FIELD IF NOT EXISTS item_options[*].id        ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS item_options[*].name      ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS item_options[*].description ON player_character_template TYPE string;
    DEFINE FIELD IF NOT EXISTS item_options[*].lore_node_id ON player_character_template TYPE option<string>;

    -- Constraints
    DEFINE FIELD IF NOT EXISTS max_item_picks    ON player_character_template TYPE int DEFAULT 1;
    DEFINE FIELD IF NOT EXISTS allow_custom_name ON player_character_template TYPE bool DEFAULT true;
    DEFINE FIELD IF NOT EXISTS allow_portrait    ON player_character_template TYPE bool DEFAULT true;
    DEFINE FIELD IF NOT EXISTS starting_location ON player_character_template TYPE string DEFAULT '';

    -- Prebuilt character resolved fields (null for template kind)
    DEFINE FIELD IF NOT EXISTS prebuilt_backstory ON player_character_template TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS prebuilt_traits    ON player_character_template TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS prebuilt_items     ON player_character_template TYPE array<string> DEFAULT [];

    -- Source
    DEFINE FIELD IF NOT EXISTS raw_markdown ON player_character_template TYPE string DEFAULT '';
    DEFINE FIELD IF NOT EXISTS created_at   ON player_character_template TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updated_at   ON player_character_template TYPE datetime DEFAULT time::now();

    -- Index: NOT unique — multiple templates per game allowed
    DEFINE INDEX IF NOT EXISTS pct_game   ON player_character_template COLUMNS game_id;
    DEFINE INDEX IF NOT EXISTS pct_status ON player_character_template COLUMNS game_id, status;

    -- ── player_character ───────────────────────────────────────────────────────

    DEFINE TABLE IF NOT EXISTS player_character SCHEMAFULL;

    DEFINE FIELD IF NOT EXISTS game_id    ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS player_id  ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS session_id ON player_character TYPE string;

    DEFINE FIELD IF NOT EXISTS template_id ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS kind        ON player_character TYPE string DEFAULT 'template';

    DEFINE FIELD IF NOT EXISTS display_name     ON player_character TYPE string;
    DEFINE FIELD IF NOT EXISTS portrait_url     ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS chosen_backstory ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS chosen_traits    ON player_character TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS chosen_items     ON player_character TYPE array<string> DEFAULT [];
    DEFINE FIELD IF NOT EXISTS world_actor_id   ON player_character TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS created_at       ON player_character TYPE datetime DEFAULT time::now();

    -- Index: NOT unique on session_id — "PENDING" would conflict on multiple attempts
    DEFINE INDEX IF NOT EXISTS pc_player_game ON player_character COLUMNS player_id, game_id;
    DEFINE INDEX IF NOT EXISTS pc_session     ON player_character COLUMNS session_id;
  `);
}

// ── Game Session Schema ──────────────────────────────────────────────────────────────────────
// Session state for SAINT engine. One per player per game session.

export async function applyGameSessionSchema() {
  const db = await getDB();

  await db.query(`
  --Game session record — one per active player session
    DEFINE TABLE IF NOT EXISTS game_session SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS session_id           ON game_session TYPE string;
    DEFINE FIELD IF NOT EXISTS game_id              ON game_session TYPE string;
    DEFINE FIELD IF NOT EXISTS player_id            ON game_session TYPE string;
    DEFINE FIELD IF NOT EXISTS player_character_id  ON game_session TYPE string;
    DEFINE FIELD IF NOT EXISTS turn_number          ON game_session TYPE int DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS narrative_threads     ON game_session TYPE array < string > DEFAULT[];
    DEFINE FIELD IF NOT EXISTS choice_history       ON game_session TYPE array < object > DEFAULT[];
    DEFINE FIELD IF NOT EXISTS engine_genre         ON game_session TYPE string DEFAULT "fantasy";
    DEFINE FIELD IF NOT EXISTS engine_cost_tier     ON game_session TYPE string DEFAULT "free";
    DEFINE FIELD IF NOT EXISTS started_at           ON game_session TYPE datetime;
    DEFINE FIELD IF NOT EXISTS last_active_at       ON game_session TYPE datetime;
    DEFINE INDEX IF NOT EXISTS game_session_sid     ON game_session COLUMNS session_id UNIQUE;
    DEFINE INDEX IF NOT EXISTS game_session_player  ON game_session COLUMNS player_id, game_id;

  --Player influence vectors — SAINT narrative physics per session
    DEFINE TABLE IF NOT EXISTS player_session SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS session_id          ON player_session TYPE string;
    DEFINE FIELD IF NOT EXISTS game_id             ON player_session TYPE string;
    DEFINE FIELD IF NOT EXISTS player_id           ON player_session TYPE string;
    DEFINE FIELD IF NOT EXISTS moral_stance        ON player_session TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS approach            ON player_session TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS scale              ON player_session TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS foresight           ON player_session TYPE int DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS pull_on_world       ON player_session TYPE array < float > DEFAULT[0.0, 0.0, 0.0];
    DEFINE FIELD IF NOT EXISTS idea_amplification  ON player_session TYPE object DEFAULT { };
    DEFINE FIELD IF NOT EXISTS stability_effect    ON player_session TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS updated_at          ON player_session TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS player_session_sid  ON player_session COLUMNS session_id UNIQUE;

  --Narrative beat — one per turn, immutable once written
    DEFINE TABLE IF NOT EXISTS narrative_beat SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS beat_id            ON narrative_beat TYPE string;
    DEFINE FIELD IF NOT EXISTS session_id         ON narrative_beat TYPE string;
    DEFINE FIELD IF NOT EXISTS turn_number        ON narrative_beat TYPE int;
    DEFINE FIELD IF NOT EXISTS scene_description  ON narrative_beat TYPE string;
    DEFINE FIELD IF NOT EXISTS options            ON narrative_beat TYPE array < object > DEFAULT[];
    DEFINE FIELD IF NOT EXISTS chosen_option_id   ON narrative_beat TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS chosen_at          ON narrative_beat TYPE option<datetime>;
    DEFINE FIELD IF NOT EXISTS eternal_ran        ON narrative_beat TYPE bool DEFAULT false;
    DEFINE FIELD IF NOT EXISTS tool_call_count    ON narrative_beat TYPE int DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS duration_ms        ON narrative_beat TYPE int DEFAULT 0;
    DEFINE FIELD IF NOT EXISTS created_at         ON narrative_beat TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS beat_session       ON narrative_beat COLUMNS session_id;
    DEFINE INDEX IF NOT EXISTS beat_id_idx        ON narrative_beat COLUMNS beat_id UNIQUE;

  --Narrative phase state — SAINT narrative gravity per session
    DEFINE TABLE IF NOT EXISTS narrative_state SCHEMAFULL
    PERMISSIONS
      FOR select WHERE session_id = $auth.id
      FOR create, update, delete NONE;
    DEFINE FIELD IF NOT EXISTS session_id           ON narrative_state TYPE string;
    DEFINE FIELD IF NOT EXISTS game_id              ON narrative_state TYPE string;
    DEFINE FIELD IF NOT EXISTS current_phase        ON narrative_state TYPE string DEFAULT "ordinary_world";
    DEFINE FIELD IF NOT EXISTS phase_charge         ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS narrative_entropy     ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS archetype_cohesion    ON narrative_state TYPE float DEFAULT 0.8;
    DEFINE FIELD IF NOT EXISTS player_resonance      ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS inertia_resistance    ON narrative_state TYPE float DEFAULT 0.5;
    DEFINE FIELD IF NOT EXISTS point_of_no_return    ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS pull_conflict         ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS story_pace           ON narrative_state TYPE float DEFAULT 1.0;
    DEFINE FIELD IF NOT EXISTS breaking_point        ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS event_distortion     ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE FIELD IF NOT EXISTS world_awareness       ON narrative_state TYPE float DEFAULT 0.0;
    DEFINE INDEX IF NOT EXISTS narrative_state_sid   ON narrative_state COLUMNS session_id UNIQUE;
  `);
}