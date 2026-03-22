import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { StringRecordId } from "surrealdb";
import { getDB } from "../../libs/surreal";
import type {
    WorldAgent, WorldLocation, WorldConcept, WorldEvent,
    WorldItem, AgentRelationship, LoreNode, NarrativePhaseState
} from "../../libs/types";

// ═══════════════════════════════════════════════════════════════════════════
// ACE GAME TOOLS
// Tool ownership by agent:
//   Reflector (Tremor)  → Update, Propagate, Signal tools
//   Curator (Eternal)   → Lore Read/Write tools
//   Generator (Witness) → Query and Generate tools
//   NPC Agent           → Self tools
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared resolver helper ────────────────────────────────────────────────

async function resolveByName<T extends { id: string }>(
    table: string,
    name: string
): Promise<string | null> {
    const db = await getDB();
    const [rows] = await db.query<[T[]]>(
        `SELECT id FROM type::table($t) WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
        { t: table, n: name }
    );
    return rows?.[0] ? String(rows[0].id) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTOR (TREMOR) — UPDATE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const worldUpdateAgentTool = createTool({
    id: "world_update_agent",
    description: "Modify any field on a world_agent record. Use for updating mood (emotional_charge), awareness, goals, energy (agency_quota), drama_debt, or any SAINT physics field after an action.",
    inputSchema: z.object({
        agent_id: z.string().describe("world_agent record ID (e.g. 'world_agent:abc123')"),
        changes: z.object({
            emotional_charge: z.number().min(-1).max(1).optional().describe("mood: -1.0 despair to 1.0 joy"),
            awareness: z.enum(["unaware", "suspicious", "alerted", "hostile", "allied"]).optional(),
            disposition: z.enum(["hostile", "neutral", "friendly", "unknown"]).optional(),
            goal_current: z.string().optional(),
            goal_hidden: z.string().optional(),
            agency_quota: z.number().min(0).max(100).optional().describe("energy remaining 0-100"),
            narrative_weight: z.number().min(0).max(1).optional(),
            concept_affinity: z.record(z.string(), z.number()).optional().describe("beliefs map e.g. {revenge: 0.8}"),
            drama_debt: z.object({
                accumulated: z.number().min(0).max(1).optional(),
                turns_since_impact: z.number().int().optional(),
                last_impact_turn: z.number().int().optional(),
                tolerance: z.number().int().optional(),
            }).optional(),
            state: z.record(z.string(), z.unknown()).optional(),
            active: z.boolean().optional(),
            location_id: z.string().optional().describe("world_location record ID — denormalized fast-lookup index, updated when agent moves"),
        }).describe("Fields to update — only provided fields are changed"),
    }),
    execute: async ({ agent_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(agent_id);

        const setClauses: string[] = [];
        const params: Record<string, unknown> = { id: rid };

        if (changes.emotional_charge !== undefined) { setClauses.push("emotional_charge = $ec"); params.ec = changes.emotional_charge; }
        if (changes.awareness !== undefined) { setClauses.push("awareness = $aw"); params.aw = changes.awareness; }
        if (changes.disposition !== undefined) { setClauses.push("disposition = $disp"); params.disp = changes.disposition; }
        if (changes.goal_current !== undefined) { setClauses.push("goal_current = $gc"); params.gc = changes.goal_current; }
        if (changes.goal_hidden !== undefined) { setClauses.push("goal_hidden = $gh"); params.gh = changes.goal_hidden; }
        if (changes.agency_quota !== undefined) { setClauses.push("agency_quota = $aq"); params.aq = changes.agency_quota; }
        if (changes.narrative_weight !== undefined) { setClauses.push("narrative_weight = $nw"); params.nw = changes.narrative_weight; }
        if (changes.concept_affinity !== undefined) { setClauses.push("concept_affinity = object::merge(concept_affinity, $ca)"); params.ca = changes.concept_affinity; }
        if (changes.drama_debt !== undefined) { setClauses.push("drama_debt = object::merge(drama_debt, $dd)"); params.dd = changes.drama_debt; }
        if (changes.state !== undefined) { setClauses.push("state = object::merge(state, $st)"); params.st = changes.state; }
        if (changes.active !== undefined) { setClauses.push("active = $active"); params.active = changes.active; }
        if (changes.location_id !== undefined) { setClauses.push("location_id = $loc_id"); params.loc_id = new StringRecordId(changes.location_id); }
        setClauses.push("updated_at = time::now()");

        const [result] = await db.query<[WorldAgent[]]>(
            `UPDATE $id SET ${setClauses.join(", ")} RETURN AFTER`,
            params
        );
        return result?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const worldUpdateLocationTool = createTool({
    id: "world_update_location",
    description: "Modify location state — atmosphere, danger, concept_imprint, secrets. Call when player enters, something happens there, or a secret is discovered.",
    inputSchema: z.object({
        location_id: z.string().describe("world_location record ID"),
        changes: z.object({
            atmosphere: z.string().optional().describe("1-2 sentence sensory description"),
            accessible: z.boolean().optional(),
            traversal_risk: z.number().min(0).max(1).optional().describe("danger level 0-1"),
            concept_imprint: z.record(z.string(), z.number()).optional().describe("Merged into location concept_imprint"),
            emotional_charge: z.number().min(-1).max(1).optional(),
            secrets: z.array(z.string()).optional().describe("Remaining unrevealed secrets"),
            revealed_secrets: z.array(z.string()).optional().describe("Append newly discovered secrets here"),
            state: z.record(z.string(), z.unknown()).optional(),
        }),
    }),
    execute: async ({ location_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(location_id);

        const setClauses: string[] = [];
        const params: Record<string, unknown> = { id: rid };

        if (changes.atmosphere !== undefined) { setClauses.push("atmosphere = $atm"); params.atm = changes.atmosphere; }
        if (changes.accessible !== undefined) { setClauses.push("accessible = $acc"); params.acc = changes.accessible; }
        if (changes.traversal_risk !== undefined) { setClauses.push("traversal_risk = $tr"); params.tr = changes.traversal_risk; }
        // top-level SAINT physics fields on world_location
        if (changes.emotional_charge !== undefined) { setClauses.push("emotional_charge = $ech"); params.ech = changes.emotional_charge; }
        if (changes.concept_imprint !== undefined) { setClauses.push("concept_imprint = object::merge(concept_imprint, $ci)"); params.ci = changes.concept_imprint; }
        if (changes.secrets !== undefined) { setClauses.push("secrets = $sec"); params.sec = changes.secrets; }
        if (changes.revealed_secrets !== undefined) { setClauses.push("revealed_secrets = array::union(revealed_secrets, $rs)"); params.rs = changes.revealed_secrets; }
        if (changes.state !== undefined) { setClauses.push("state = object::merge(state, $st)"); params.st = changes.state; }
        setClauses.push("updated_at = time::now()");

        const [result] = await db.query<[WorldLocation[]]>(
            `UPDATE $id SET ${setClauses.join(", ")} RETURN AFTER`,
            params
        );
        return result?.[0] ?? { error: "Location not found", location_id };
    },
});

export const worldUpdateFactionTool = createTool({
    id: "world_update_faction",
    description: "Modify faction state — player_standing, internal_coherence, emotional_charge. Call when the player's action touches faction interests.",
    inputSchema: z.object({
        faction_id: z.string().describe("world_faction record ID"),
        changes: z.object({
            player_standing: z.number().min(-1).max(1).optional().describe("reputation: -1.0 enemy to 1.0 ally"),
            internal_coherence: z.number().min(0).max(1).optional().describe("solidarity under stress"),
            emotional_charge: z.number().min(-1).max(1).optional().describe("collective mood"),
            narrative_weight: z.number().min(0).max(1).optional(),
            player_perceived_alignment: z.number().min(-1).max(1).optional(),
            state: z.record(z.string(), z.unknown()).optional(),
        }),
    }),
    execute: async ({ faction_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(faction_id);

        const setClauses: string[] = [];
        const params: Record<string, unknown> = { id: rid };

        if (changes.player_standing !== undefined) { setClauses.push("player_standing = $ps"); params.ps = changes.player_standing; }
        if (changes.internal_coherence !== undefined) { setClauses.push("internal_coherence = $ic"); params.ic = changes.internal_coherence; }
        if (changes.emotional_charge !== undefined) { setClauses.push("emotional_charge = $ec"); params.ec = changes.emotional_charge; }
        if (changes.narrative_weight !== undefined) { setClauses.push("narrative_weight = $nw"); params.nw = changes.narrative_weight; }
        if (changes.player_perceived_alignment !== undefined) { setClauses.push("player_perceived_alignment = $ppa"); params.ppa = changes.player_perceived_alignment; }
        if (changes.state !== undefined) { setClauses.push("state = object::merge(state, $st)"); params.st = changes.state; }
        setClauses.push("updated_at = time::now()");

        const [result] = await db.query<[{ id: string; name: string; player_standing: number }[]]>(
            `UPDATE $id SET ${setClauses.join(", ")} RETURN AFTER`,
            params
        );
        return result?.[0] ?? { error: "Faction not found", faction_id };
    },
});

export const worldUpdateConceptTool = createTool({
    id: "world_update_concept",
    description: "Modify a concept's adoption (swarm_coherence), story_fuel (narrative_density), or feeling (emotional_valence). Call when player actions reinforce or challenge a dominant idea. Signal Eternal if adoption crosses 0.75.",
    inputSchema: z.object({
        concept_id: z.string().describe("world_concept record ID"),
        changes: z.object({
            swarm_coherence: z.number().min(0).max(1).optional().describe("adoption 0.0-1.0 (>0.75 = canonical truth)"),
            narrative_density: z.number().min(0).max(1).optional().describe("story_fuel"),
            emotional_valence: z.number().min(-1).max(1).optional().describe("feeling"),
            gravitational_drag: z.number().min(0).max(1).optional().describe("staying_power"),
            mutation_rate: z.number().min(0).max(1).optional().describe("drift"),
            known_to_player: z.boolean().optional(),
            active: z.boolean().optional(),
            state: z.record(z.string(), z.unknown()).optional(),
        }),
    }),
    execute: async ({ concept_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(concept_id);

        const setClauses: string[] = [];
        const params: Record<string, unknown> = { id: rid };

        if (changes.swarm_coherence !== undefined) { setClauses.push("swarm_coherence = $sc"); params.sc = changes.swarm_coherence; }
        if (changes.narrative_density !== undefined) { setClauses.push("narrative_density = $nd"); params.nd = changes.narrative_density; }
        if (changes.emotional_valence !== undefined) { setClauses.push("emotional_valence = $ev"); params.ev = changes.emotional_valence; }
        if (changes.gravitational_drag !== undefined) { setClauses.push("gravitational_drag = $gd"); params.gd = changes.gravitational_drag; }
        if (changes.mutation_rate !== undefined) { setClauses.push("mutation_rate = $mr"); params.mr = changes.mutation_rate; }
        if (changes.known_to_player !== undefined) { setClauses.push("known_to_player = $ktp"); params.ktp = changes.known_to_player; }
        if (changes.active !== undefined) { setClauses.push("active = $active"); params.active = changes.active; }
        if (changes.state !== undefined) { setClauses.push("state = object::merge(state, $st)"); params.st = changes.state; }
        setClauses.push("updated_at = time::now()");

        const [result] = await db.query<[WorldConcept[]]>(
            `UPDATE $id SET ${setClauses.join(", ")} RETURN AFTER`,
            params
        );
        const concept = result?.[0];
        const canonicalWarning = concept && (concept as WorldConcept).swarm_coherence >= 0.75
            ? "⚠️ adoption >= 0.75 — call check_significance then notify_eternal"
            : undefined;
        return { ...(concept ?? { error: "Concept not found", concept_id }), canonicalWarning };
    },
});

export const worldCreateEventTool = createTool({
    id: "world_create_event",
    description: "Spawn a new world_event from the player's action. Only call when something genuinely changed state — a decision made, discovery found, confrontation had. Ask: will this matter three turns from now?",
    inputSchema: z.object({
        name: z.string().describe("Short specific name: 'Kael Descends to the Archive Basement'"),
        description: z.string().describe("What happened"),
        participant_names: z.array(z.string()).default([]).describe("Names of world_agent records involved"),
        location_name: z.string().optional().describe("Name of world_location where event occurs"),
        weight: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]).describe("[wound_mass, hope_mass, mystery_mass] 0.0-1.0"),
        player_mark: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]).describe("[moral_stamp, method_stamp, social_stamp] -1.0 to 1.0"),
        ideas_spawned: z.record(z.string(), z.number()).default({}).describe("Concepts seeded: {'betrayal': 0.8}"),
        long_shadow: z.number().min(0).max(10).default(2).describe("0-10: how long this echoes. murder=8, conversation=2"),
        spotlight: z.number().min(0).max(1).default(0.1).describe("Start at 0.1 — only witnesses know yet"),
        significance: z.number().min(0).max(1).default(0.5).describe("Tremor assessment for lore threshold"),
        phase_charge: z.number().min(0).max(1).default(0).describe("Hero's journey progression contribution"),
        known_to_player: z.boolean().default(true),
    }),
    execute: async ({ name, description, participant_names, location_name, weight, player_mark, ideas_spawned, long_shadow, spotlight, significance, phase_charge, known_to_player }) => {
        const db = await getDB();

        const participantIds: string[] = [];
        for (const n of participant_names ?? []) {
            const id = await resolveByName<WorldAgent>("world_agent", n);
            if (id) participantIds.push(id);
        }

        let locationId: string | undefined;
        if (location_name) {
            const id = await resolveByName<WorldLocation>("world_location", location_name);
            if (id) locationId = id;
        }

        const [created] = await db.query<[WorldEvent[]]>(
            `CREATE world_event CONTENT $data RETURN AFTER`,
            {
                data: {
                    name,
                    description,
                    participants: participantIds,
                    location_id: locationId,
                    gravitational_mass: weight,
                    swarm_attention: spotlight,
                    coherence_stress: 0,
                    plausibility_decay: 0.1,
                    vector_imprint: player_mark,
                    concept_seeding: ideas_spawned,
                    temporal_ripple: long_shadow,
                    phase_charge,
                    significance,
                    resolved: false,
                    known_to_player,
                    state: {},
                }
            }
        );
        const event = created?.[0];
        return {
            event_id: event ? String(event.id) : null,
            name,
            significance,
            status: "created",
            note: "Call check_significance and check_contradiction next. Always.",
        };
    },
});

export const worldResolveEventTool = createTool({
    id: "world_resolve_event",
    description: "Mark a world_event as resolved. Resolved events stop accruing spotlight and no longer generate active tension. Call when the player's action directly closes an open situation.",
    inputSchema: z.object({
        event_id: z.string().describe("world_event record ID"),
    }),
    execute: async ({ event_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(event_id);
        const [result] = await db.query<[WorldEvent[]]>(
            `UPDATE $id SET resolved = true, updated_at = time::now() RETURN AFTER`,
            { id: rid }
        );
        return result?.[0] ?? { error: "Event not found", event_id };
    },
});

export const worldCreateConceptTool = createTool({
    id: "world_create_concept",
    description: "Spawn a brand-new idea into the world. Only call when world_create_event's ideas_spawned contains a concept name that doesn't exist in world_concept yet. Always check first — no duplicates.",
    inputSchema: z.object({
        name: z.string().describe("Concept name — must be unique"),
        description: z.string(),
        emotional_valence: z.number().min(-1).max(1).default(0).describe("feeling: -1 dark to 1 hopeful"),
        narrative_density: z.number().min(0).max(1).default(0.3).describe("story_fuel"),
        swarm_coherence: z.number().min(0).max(1).default(0.1).describe("initial adoption level"),
        staying_power: z.number().min(0).max(1).default(0.5).describe("gravitational_drag"),
        lore_node_name: z.string().optional().describe("Corresponding lore_node name if one exists"),
    }),
    execute: async ({ name, description, emotional_valence, narrative_density, swarm_coherence, staying_power, lore_node_name }) => {
        const db = await getDB();

        // Check for duplicates first
        const [existing] = await db.query<[WorldConcept[]]>(
            `SELECT id, name FROM world_concept WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: name }
        );
        if (existing?.[0]) {
            return { error: "Concept already exists", existing_id: String(existing[0].id), name };
        }

        let loreRef: string | undefined;
        if (lore_node_name) {
            const id = await resolveByName<LoreNode>("lore_node", lore_node_name);
            if (id) loreRef = id;
        }

        const [created] = await db.query<[WorldConcept[]]>(
            `CREATE world_concept CONTENT $data RETURN AFTER`,
            {
                data: {
                    lore_ref: loreRef,
                    name,
                    description,
                    emotional_valence,
                    narrative_density,
                    vector_amplification: [1.0, 1.0, 1.0],
                    swarm_coherence,
                    mutation_rate: 0.1,
                    gravitational_drag: staying_power,
                    plausibility_anchor: 0.5,
                    opposes: [],
                    active: true,
                    known_to_player: false,
                    state: {},
                }
            }
        );
        const concept = created?.[0];
        return { concept_id: concept ? String(concept.id) : null, name, status: "created" };
    },
});

export const worldUpdateRelationshipTool = createTool({
    id: "world_update_relationship",
    description: "Modify the relationship edge between two world_agents. This is the social graph — keep it updated for emergent narrative. Direct interaction always increments history by 1.",
    inputSchema: z.object({
        agent1_id: z.string().describe("First world_agent record ID (in)"),
        agent2_id: z.string().describe("Second world_agent record ID (out)"),
        changes: z.object({
            trust: z.number().min(0).max(1).optional(),
            tension: z.number().min(0).max(1).optional(),
            conceptual_resonance: z.number().min(-1).max(1).optional().describe("shared_beliefs"),
            narrative_entanglement: z.number().int().optional().describe("history count — usually increment by 1"),
            influence_conduit: z.number().min(0).max(1).optional().describe("transmission"),
            gravitational_coupling: z.number().min(0).max(1).optional().describe("bond_strength"),
            temporal_sync: z.number().min(0).max(1).optional().describe("memory_alignment"),
            relation_type: z.string().optional(),
        }),
    }),
    execute: async ({ agent1_id, agent2_id, changes }) => {
        const db = await getDB();
        const rid1 = new StringRecordId(agent1_id);
        const rid2 = new StringRecordId(agent2_id);

        const setClauses: string[] = [];
        const params: Record<string, unknown> = { a1: rid1, a2: rid2 };

        if (changes.trust !== undefined) { setClauses.push("trust = $trust"); params.trust = changes.trust; }
        if (changes.tension !== undefined) { setClauses.push("tension = $tension"); params.tension = changes.tension; }
        if (changes.conceptual_resonance !== undefined) { setClauses.push("conceptual_resonance = $cr"); params.cr = changes.conceptual_resonance; }
        if (changes.narrative_entanglement !== undefined) { setClauses.push("narrative_entanglement = $ne"); params.ne = changes.narrative_entanglement; }
        if (changes.influence_conduit !== undefined) { setClauses.push("influence_conduit = $ic"); params.ic = changes.influence_conduit; }
        if (changes.gravitational_coupling !== undefined) { setClauses.push("gravitational_coupling = $gc"); params.gc = changes.gravitational_coupling; }
        if (changes.temporal_sync !== undefined) { setClauses.push("temporal_sync = $ts"); params.ts = changes.temporal_sync; }
        if (changes.relation_type !== undefined) { setClauses.push("relation_type = $rt"); params.rt = changes.relation_type; }
        setClauses.push("updated_at = time::now()");

        // Try to update existing relationship edge
        const [result] = await db.query<[AgentRelationship[]]>(
            `UPDATE relationship SET ${setClauses.join(", ")} WHERE in = $a1 AND out = $a2 RETURN AFTER`,
            params
        );

        if (!result?.[0]) {
            // Create if doesn't exist
            await db.query(
                `RELATE $a1->relationship->$a2 SET relation_type = $rt, trust = $trust, tension = 0.0, conceptual_resonance = 0.0, narrative_entanglement = 1, influence_conduit = 0.5, gravitational_coupling = 0.0, temporal_sync = 0.5, vector_refraction = [0.5,0.5,0.5], plausibility_anchor = 0.5, updated_at = time::now()`,
                {
                    a1: rid1, a2: rid2,
                    rt: changes.relation_type ?? "acquaintance",
                    trust: changes.trust ?? 0.5,
                }
            );
            return { status: "created", agent1_id, agent2_id };
        }
        return { status: "updated", relationship: result[0] };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTOR (TREMOR) — PROPAGATE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const propagateMoodTool = createTool({
    id: "propagate_mood",
    description: "Spread a mood change outward from a source agent through their relationship network. Radius 1=private, 2=semi-public, 3=public. Decay controls diminishment per hop.",
    inputSchema: z.object({
        source_id: z.string().describe("world_agent record ID — the emotional epicenter"),
        radius: z.number().int().min(1).max(3).default(1).describe("1=immediate connections only, 2=two hops, 3=three hops"),
        decay: z.number().min(0).max(1).default(0.6).describe("0.0-1.0: multiplier per hop. 0.6 = each hop gets 60% of previous"),
    }),
    execute: async ({ source_id, radius, decay }) => {
        const db = await getDB();
        const rid = new StringRecordId(source_id);

        // Get source mood
        const [sourceRows] = await db.query<[WorldAgent[]]>(`SELECT emotional_charge FROM $id`, { id: rid });
        const sourceMood = sourceRows?.[0]?.emotional_charge ?? 0;

        const affected: { agent_id: string; new_charge: number; hop: number }[] = [];

        // Walk relationship hops
        let frontier = [source_id];
        const visited = new Set([source_id]);

        for (let hop = 1; hop <= (radius ?? 1); hop++) {
            const moodDelta = sourceMood * Math.pow(decay ?? 0.6, hop);
            const nextFrontier: string[] = [];

            for (const currentId of frontier) {
                const currentRid = new StringRecordId(currentId);
                const [relRows] = await db.query<[{ out: string; influence_conduit: number }[]]>(
                    `SELECT out, influence_conduit FROM relationship WHERE in = $id`,
                    { id: currentRid }
                );

                for (const rel of relRows ?? []) {
                    const neighborId = String(rel.out);
                    if (visited.has(neighborId)) continue;
                    visited.add(neighborId);
                    nextFrontier.push(neighborId);

                    const effectiveDelta = moodDelta * (rel.influence_conduit ?? 0.5);
                    const neighborRid = new StringRecordId(neighborId);
                    await db.query(
                        `UPDATE $id SET emotional_charge = math::clamp(emotional_charge + $d, -1.0, 1.0), updated_at = time::now()`,
                        { id: neighborRid, d: effectiveDelta }
                    );
                    affected.push({ agent_id: neighborId, new_charge: effectiveDelta, hop });
                }
            }
            frontier = nextFrontier;
            if (frontier.length === 0) break;
        }

        return { source_id, source_mood: sourceMood, radius, affected_count: affected.length, affected };
    },
});

export const propagateConceptTool = createTool({
    id: "propagate_concept",
    description: "Spread an idea from a source agent outward through their relationship network. Only agents whose beliefs make them receptive will adopt it.",
    inputSchema: z.object({
        concept_id: z.string().describe("world_concept record ID"),
        source_id: z.string().describe("world_agent ID championing the concept"),
        via_relationships: z.boolean().default(true).describe("If true, use influence_conduit transmission values"),
    }),
    execute: async ({ concept_id, source_id, via_relationships }) => {
        const db = await getDB();
        const sourceRid = new StringRecordId(source_id);
        const conceptRid = new StringRecordId(concept_id);

        // Get concept
        const [conceptRows] = await db.query<[WorldConcept[]]>(`SELECT * FROM $id`, { id: conceptRid });
        const concept = conceptRows?.[0];
        if (!concept) return { error: "Concept not found", concept_id };

        // Get source relationships
        const [relRows] = await db.query<[{ out: string; influence_conduit: number }[]]>(
            `SELECT out, influence_conduit FROM relationship WHERE in = $id`,
            { id: sourceRid }
        );

        const adopted: { agent_id: string; strength: number }[] = [];
        const resisted: { agent_id: string; reason: string }[] = [];

        for (const rel of relRows ?? []) {
            const neighborId = String(rel.out);
            const neighborRid = new StringRecordId(neighborId);
            const transmissionStrength = via_relationships ? (rel.influence_conduit ?? 0.5) : 0.5;
            const adoptionStrength = concept.swarm_coherence * transmissionStrength;

            // Check neighbor's opposing concepts and plausibility_threshold
            const [neighborRows] = await db.query<[WorldAgent[]]>(
                `SELECT concept_affinity, plausibility_threshold FROM $id`,
                { id: neighborRid }
            );
            const neighbor = neighborRows?.[0];
            if (!neighbor) continue;

            const threshold = neighbor.plausibility_threshold ?? 0.6;
            if (adoptionStrength < threshold * 0.3) {
                resisted.push({ agent_id: neighborId, reason: "below threshold" });
                continue;
            }

            // Adopt: RELATE influenced_by + update concept_affinity
            await db.query(
                `RELATE $agent->influenced_by->$concept SET strength = $s, adopted_at = time::now()`,
                { agent: neighborRid, concept: conceptRid, s: adoptionStrength }
            );
            await db.query(
                `UPDATE $id SET concept_affinity = object::merge(concept_affinity, $ca) WHERE $id = $id`,
                { id: neighborRid, ca: { [concept.name]: adoptionStrength } }
            );
            adopted.push({ agent_id: neighborId, strength: adoptionStrength });
        }

        // Update swarm_coherence on concept
        if (adopted.length > 0) {
            const [totalAgents] = await db.query<[{ count: number }[]]>(`SELECT count() FROM world_agent GROUP ALL`);
            const total = totalAgents?.[0]?.count ?? 1;
            const [alreadyAdopted] = await db.query<[{ count: number }[]]>(
                `SELECT count() FROM influenced_by WHERE out = $id GROUP ALL`,
                { id: conceptRid }
            );
            const adoptedCount = alreadyAdopted?.[0]?.count ?? 0;
            const newCoherence = Math.min(adoptedCount / total, 1.0);
            await db.query(`UPDATE $id SET swarm_coherence = $sc, updated_at = time::now()`, { id: conceptRid, sc: newCoherence });
        }

        return { concept_id, adopted_count: adopted.length, resisted_count: resisted.length, adopted, resisted };
    },
});

export const propagatePlayerMarkTool = createTool({
    id: "propagate_player_mark",
    description: "Ripple the player's influence signature outward from an event. Agents present/connected update their responds_to (vector_susceptibility) based on the player_mark imprinted on the event. Always call after world_create_event.",
    inputSchema: z.object({
        event_id: z.string().describe("world_event record ID"),
        via_relationships: z.boolean().default(true),
    }),
    execute: async ({ event_id, via_relationships }) => {
        const db = await getDB();
        const eventRid = new StringRecordId(event_id);

        const [eventRows] = await db.query<[WorldEvent[]]>(`SELECT * FROM $id`, { id: eventRid });
        const event = eventRows?.[0];
        if (!event) return { error: "Event not found", event_id };

        const [moral, method, social] = event.vector_imprint ?? [0, 0, 0];
        const updated: string[] = [];

        for (const participantId of event.participants ?? []) {
            const pRid = new StringRecordId(participantId);
            // Nudge vector_susceptibility proportional to influence_resonance
            const [agentRows] = await db.query<[WorldAgent[]]>(
                `SELECT influence_resonance, vector_susceptibility FROM $id`, { id: pRid }
            );
            const agent = agentRows?.[0];
            if (!agent) continue;

            const pull = agent.influence_resonance ?? 0.5;
            const current = agent.vector_susceptibility ?? [0.5, 0.5, 0.5];
            const newVec = [
                Math.max(0, Math.min(1, current[0] + moral * pull * 0.1)),
                Math.max(0, Math.min(1, current[1] + method * pull * 0.1)),
                Math.max(0, Math.min(1, current[2] + social * pull * 0.1)),
            ];
            await db.query(
                `UPDATE $id SET vector_susceptibility = $vs, updated_at = time::now()`,
                { id: pRid, vs: newVec }
            );
            updated.push(participantId);
        }

        return { event_id, player_mark: event.vector_imprint, agents_updated: updated };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTOR (TREMOR) — SIGNAL TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const checkSignificanceTool = createTool({
    id: "check_significance",
    description: "Evaluate whether a world_event is significant enough for the Eternal to review. Call after every world_create_event.",
    inputSchema: z.object({
        event_id: z.string().describe("world_event record ID"),
    }),
    execute: async ({ event_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(event_id);

        const [rows] = await db.query<[WorldEvent[]]>(`SELECT * FROM $id`, { id: rid });
        const event = rows?.[0];
        if (!event) return { significant: false, reason: "Event not found", score: 0 };

        const sigScore = event.significance ?? 0;
        const longShadow = event.temporal_ripple ?? 0;

        // Check if any named lore entities involved
        const participantNames: string[] = [];
        for (const pid of event.participants ?? []) {
            const pRid = new StringRecordId(pid);
            const [agentRows] = await db.query<[WorldAgent[]]>(`SELECT name, lore_ref FROM $id`, { id: pRid });
            if (agentRows?.[0]?.name) participantNames.push(agentRows[0].name);
        }
        const hasNamedEntity = participantNames.length > 0;
        const hasNewFact = sigScore >= 0.6;

        const significant = sigScore >= 0.6 && longShadow >= 5 && hasNamedEntity && hasNewFact;
        const reasons: string[] = [];
        if (sigScore < 0.6) reasons.push(`significance ${sigScore.toFixed(2)} < 0.6`);
        if (longShadow < 5) reasons.push(`long_shadow ${longShadow} < 5`);
        if (!hasNamedEntity) reasons.push("no named lore entities involved");

        return {
            significant,
            reason: significant ? "All promotion criteria met" : reasons.join("; "),
            score: sigScore,
            long_shadow: longShadow,
            named_participants: participantNames,
        };
    },
});

export const checkContradictionTool = createTool({
    id: "check_contradiction",
    description: "Quick check whether a new world_event conflicts with established lore. Call after world_create_event, before notify_eternal.",
    inputSchema: z.object({
        event_id: z.string().describe("world_event record ID"),
    }),
    execute: async ({ event_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(event_id);

        const [eventRows] = await db.query<[WorldEvent[]]>(`SELECT name, description, participants FROM $id`, { id: rid });
        const event = eventRows?.[0];
        if (!event) return { contradicts: false, conflicts: [] };

        // Search lore_node for any canon entries related to this event's participants
        const conflicts: LoreNode[] = [];
        for (const pid of event.participants ?? []) {
            const pRid = new StringRecordId(pid);
            const [agentRows] = await db.query<[{ name: string }[]]>(`SELECT name FROM $id`, { id: pRid });
            const agentName = agentRows?.[0]?.name;
            if (!agentName) continue;

            const [loreRows] = await db.query<[LoreNode[]]>(
                `SELECT * FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) AND canon = true LIMIT 1`,
                { n: agentName }
            );
            if (loreRows?.[0]) conflicts.push(loreRows[0]);
        }

        return {
            contradicts: conflicts.length > 0,
            conflicts,
            note: conflicts.length > 0 ? "Run lore_query_contradictions for deep check" : "No canon conflicts found",
        };
    },
});

export const notifyEternalTool = createTool({
    id: "notify_eternal",
    description: "Signal the Eternal (Curator) to review a world_event for lore promotion. Only call when check_significance returns significant: true.",
    inputSchema: z.object({
        event_id: z.string().describe("world_event record ID"),
        reason: z.string().describe("Plain-language reason this event deserves lore promotion"),
        contradiction_ids: z.array(z.string()).optional().describe("lore_node IDs from check_contradiction if conflicts found"),
        session_id: z.string().describe("Current session ID"),
    }),
    execute: async ({ event_id, reason, contradiction_ids, session_id }) => {
        const db = await getDB();
        await db.query(
            `CREATE narrative_event CONTENT $data`,
            {
                data: {
                    session_id,
                    agent_name: "Tremor",
                    event_type: "outcome",
                    content: `NOTIFY_ETERNAL: event=${event_id} | ${reason}`,
                    metadata: { event_id, reason, contradiction_ids: contradiction_ids ?? [], signal: "PROMOTE_TO_LORE" },
                }
            }
        );
        return { status: "notified", event_id, reason, has_contradictions: (contradiction_ids?.length ?? 0) > 0 };
    },
});

export const notifyEternalContradictionTool = createTool({
    id: "notify_eternal_contradiction",
    description: "Signal the Eternal specifically about a contradiction — independent of significance. Contradictions must always be resolved regardless of event significance.",
    inputSchema: z.object({
        conflicting_node_ids: z.array(z.string()).describe("lore_node IDs in conflict"),
        event_id: z.string().optional().describe("Triggering world_event ID if applicable"),
        description: z.string().describe("What the contradiction is"),
        session_id: z.string(),
    }),
    execute: async ({ conflicting_node_ids, event_id, description, session_id }) => {
        const db = await getDB();
        await db.query(
            `CREATE narrative_event CONTENT $data`,
            {
                data: {
                    session_id,
                    agent_name: "Tremor",
                    event_type: "outcome",
                    content: `CONTRADICTION_DETECTED: ${description}`,
                    metadata: { conflicting_node_ids, event_id, signal: "RESOLVE_CONTRADICTION" },
                }
            }
        );
        return { status: "notified", conflict_count: conflicting_node_ids.length, description };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// CURATOR (ETERNAL) — READ TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const worldGetEventTool = createTool({
    id: "world_get_event",
    description: "Read the full world_event record the Tremor flagged. Always the first call the Eternal makes. Read significance, long_shadow, weight, player_mark, ideas_spawned, contradicts before deciding anything.",
    inputSchema: z.object({ event_id: z.string() }),
    execute: async ({ event_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[WorldEvent[]]>(`SELECT * FROM $id`, { id: new StringRecordId(event_id) });
        return rows?.[0] ?? { error: "Event not found", event_id };
    },
});

export const worldGetAgentTool = createTool({
    id: "world_get_agent",
    description: "Read a character's current world state — goals, mood, beliefs — before deciding whether their involvement in an event warrants a lore update.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[WorldAgent[]]>(`SELECT * FROM $id`, { id: new StringRecordId(agent_id) });
        return rows?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const worldGetConceptTool = createTool({
    id: "world_get_concept",
    description: "Read a concept's current state, particularly adoption (swarm_coherence). A concept above 0.75 is a candidate for promotion to canonical lore.",
    inputSchema: z.object({ concept_id: z.string() }),
    execute: async ({ concept_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[WorldConcept[]]>(`SELECT * FROM $id`, { id: new StringRecordId(concept_id) });
        return rows?.[0] ?? { error: "Concept not found", concept_id };
    },
});

export const loreQueryContradictionsTool = createTool({
    id: "lore_query_contradictions",
    description: "Deep check — finds all lore nodes that conflict with a given node. Run on every named entity in an event before promoting anything to lore. Always. The Eternal cannot let contradictions slip into the permanent record.",
    inputSchema: z.object({
        node_id: z.string().describe("lore_node record ID to check against"),
    }),
    execute: async ({ node_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);

        // Get the node itself
        const [nodeRows] = await db.query<[LoreNode[]]>(`SELECT * FROM $id`, { id: rid });
        const node = nodeRows?.[0];
        if (!node) return { conflicts: [], node_id };

        // Find nodes with contradicts relation pointing here
        const [outConflicts] = await db.query<[LoreNode[]]>(
            `SELECT * FROM lore_node WHERE ->lore_relation[WHERE relation_type = 'contradicts']->(lore_node WHERE id = $id)`,
            { id: rid }
        );
        // Also find nodes this node contradicts
        const [inConflicts] = await db.query<[LoreNode[]]>(
            `SELECT *, ->lore_relation[WHERE relation_type = 'contradicts']->lore_node AS contradicts_nodes FROM $id`,
            { id: rid }
        );

        const conflicts = [...(outConflicts ?? []), ...(inConflicts ?? [])].filter(Boolean);
        return { node_id, node_name: node.name, conflicts, conflict_count: conflicts.length };
    },
});

export const loreGetConnectionsTool = createTool({
    id: "lore_get_connections",
    description: "Read all existing lore relations for a node — what it caused, what caused it, what it relates to. Used before writing any new lore_relation.",
    inputSchema: z.object({
        node_id: z.string().describe("lore_node record ID"),
    }),
    execute: async ({ node_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);

        // Outbound relations — what this node points to
        const [outRows] = await db.query<[any[]]>(`
        SELECT out.id AS target_id, out.name AS target_name, out.kind AS target_kind,
               relation_type, weight
        FROM lore_relation
        WHERE in = $id
    `, { id: rid });

        // Inbound relations — what points to this node
        const [inRows] = await db.query<[any[]]>(`
        SELECT in.id AS source_id, in.name AS source_name, in.kind AS source_kind,
               relation_type, weight
        FROM lore_relation
        WHERE out = $id
    `, { id: rid });

        return {
            node_id,
            out: outRows ?? [],
            in: inRows ?? [],
        };
    },
});

export const loreQueryRelevantTool = createTool({
    id: "lore_query_relevant",
    description: "Find lore nodes related to the current situation by name/keyword match. Always the first call the Witness makes, every turn. The gap between what the player knows and what lore says is narrative leverage.",
    inputSchema: z.object({
        context: z.string().describe("Keywords or short description of the current scene/situation"),
        limit: z.number().int().min(1).max(20).default(10),
    }),
    execute: async ({ context, limit }) => {
        const db = await getDB();
        const words = context.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) {
            const [all] = await db.query<[LoreNode[]]>(`SELECT id, kind, name, description FROM lore_node WHERE canon = true LIMIT $lim`, { lim: limit });
            return all ?? [];
        }
        // Build OR conditions for each word
        const conditions = words.map((_, i) => `string::lowercase(name) CONTAINS $w${i} OR string::lowercase(description) CONTAINS $w${i}`).join(" OR ");
        const params: Record<string, unknown> = { lim: limit };
        words.forEach((w, i) => { params[`w${i}`] = w; });
        const [rows] = await db.query<[LoreNode[]]>(
            `SELECT id, kind, name, description FROM lore_node WHERE canon = true AND (${conditions}) LIMIT $lim`,
            params
        );
        return rows ?? [];
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// CURATOR (ETERNAL) — WRITE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const loreCreateNodeTool = createTool({
    id: "lore_create_node",
    description: "Create a new permanent entry in the lore graph. Once created this node is part of what the world knows. Only for: named entities directly encountered, facts concretely established through play, events with long_shadow>=5 and significance>=0.6, or concepts that crossed 0.75 adoption.",
    inputSchema: z.object({
        kind: z.enum(["character", "faction", "location", "item", "event", "concept"]),
        name: z.string(),
        description: z.string().describe("Permanent lore description — write as established fact or 'Evidence suggests...' if unproven"),
        properties: z.record(z.string(), z.unknown()).default({}).describe("Additional properties for this entity"),
        canon: z.boolean().default(true),
    }),
    execute: async ({ kind, name, description, properties, canon }) => {
        const db = await getDB();

        // Check for duplicate
        const [existing] = await db.query<[LoreNode[]]>(
            `SELECT id, name FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) LIMIT 1`,
            { n: name }
        );
        if (existing?.[0]) {
            return { error: "Node already exists — use lore_update_node", existing_id: String(existing[0].id), name };
        }

        const [created] = await db.query<[LoreNode[]]>(
            `CREATE lore_node CONTENT $data RETURN AFTER`,
            { data: { kind, name, description, properties, canon } }
        );
        return { node_id: created?.[0] ? String(created[0].id) : null, name, kind, status: "created" };
    },
});

export const loreUpdateNodeTool = createTool({
    id: "lore_update_node",
    description: "Modify an existing lore node. Most common Eternal operation. Critical: only state something as fact if the player actually established it — use 'Evidence suggests...' for clues without proof.",
    inputSchema: z.object({
        node_id: z.string(),
        changes: z.object({
            description: z.string().optional(),
            properties: z.record(z.string(), z.unknown()).optional().describe("Merged into existing properties"),
            canon: z.boolean().optional(),
        }),
    }),
    execute: async ({ node_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);

        const setClauses: string[] = ["updated_at = time::now()"];
        const params: Record<string, unknown> = { id: rid };

        if (changes.description !== undefined) { setClauses.push("description = $desc"); params.desc = changes.description; }
        if (changes.properties !== undefined) { setClauses.push("properties = object::merge(properties, $props)"); params.props = changes.properties; }
        if (changes.canon !== undefined) { setClauses.push("canon = $canon"); params.canon = changes.canon; }

        const [result] = await db.query<[LoreNode[]]>(
            `UPDATE $id SET ${setClauses.join(", ")} RETURN AFTER`,
            params
        );
        return result?.[0] ?? { error: "Node not found", node_id };
    },
});

export const loreSetCanonTool = createTool({
    id: "lore_set_canon",
    description: "Mark a lore node as canonical truth (canon:true) or strip canonical status from a node that has been superseded or disproven.",
    inputSchema: z.object({
        node_id: z.string(),
        canon: z.boolean().describe("true = this is established world truth. false = superseded or disproven."),
    }),
    execute: async ({ node_id, canon }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);
        const [result] = await db.query<[LoreNode[]]>(
            `UPDATE $id SET canon = $canon, updated_at = time::now() RETURN AFTER`,
            { id: rid, canon }
        );
        return result?.[0] ?? { error: "Node not found", node_id };
    },
});

export const loreCreateRelationTool = createTool({
    id: "lore_create_relation",
    description: "Create a directed edge between two lore nodes. Types: caused_by, revealed_that, resulted_in, related_to, contradicts, supersedes, discovered_by. One event typically creates 2–4 relations.",
    inputSchema: z.object({
        from_node_id: z.string().describe("Source lore_node ID"),
        to_node_id: z.string().describe("Target lore_node ID"),
        relation_type: z.enum(["caused_by", "revealed_that", "resulted_in", "related_to", "contradicts", "supersedes", "discovered_by", "leads_to"]),
        weight: z.number().min(0).max(1).default(0.8).describe("Narrative significance 0-1"),
        established: z.string().default("during-play").describe("When this relation was established"),
        metadata: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ from_node_id, to_node_id, relation_type, weight, established, metadata }) => {
        const db = await getDB();
        const fromRid = new StringRecordId(from_node_id);
        const toRid = new StringRecordId(to_node_id);

        const [result] = await db.query(
            `RELATE $from->lore_relation->$to SET relation_type = $rt, weight = $w, established = $est, metadata = $meta RETURN AFTER`,
            { from: fromRid, to: toRid, rt: relation_type, w: weight, est: established, meta: metadata }
        );
        return { status: "created", from_node_id, to_node_id, relation_type, weight };
    },
});

export const loreMergeNodesTool = createTool({
    id: "lore_merge_nodes",
    description: "Combine two lore nodes into one. Used when the world has two nodes representing the same truth (e.g. deduplication failures). Always keep the more complete node as primary.",
    inputSchema: z.object({
        primary_id: z.string().describe("More complete node — survives the merge"),
        secondary_id: z.string().describe("Less complete node — gets archived after merge"),
    }),
    execute: async ({ primary_id, secondary_id }) => {
        const db = await getDB();
        const primaryRid = new StringRecordId(primary_id);
        const secondaryRid = new StringRecordId(secondary_id);

        // Get secondary node's properties
        const [secRows] = await db.query<[LoreNode[]]>(`SELECT * FROM $id`, { id: secondaryRid });
        const secondary = secRows?.[0];
        if (!secondary) return { error: "Secondary node not found", secondary_id };

        // Merge description and properties into primary
        await db.query(
            `UPDATE $id SET properties = object::merge(properties, $props), updated_at = time::now()`,
            { id: primaryRid, props: secondary.properties ?? {} }
        );

        // Re-point all lore_relations from secondary to primary
        await db.query(
            `UPDATE lore_relation SET out = $prim WHERE out = $sec`,
            { prim: primaryRid, sec: secondaryRid }
        );
        await db.query(
            `UPDATE lore_relation SET in = $prim WHERE in = $sec`,
            { prim: primaryRid, sec: secondaryRid }
        );

        // Create supersedes relation and archive secondary
        await db.query(
            `RELATE $prim->lore_relation->$sec SET relation_type = 'supersedes', weight = 1.0, established = 'merge'`,
            { prim: primaryRid, sec: secondaryRid }
        );
        await db.query(
            `UPDATE $id SET canon = false, properties = object::merge(properties, {archived: true, archived_reason: 'merged_into_' + $pid}) WHERE $id = $id`,
            { id: secondaryRid, pid: primary_id }
        );

        const [result] = await db.query<[LoreNode[]]>(`SELECT * FROM $id`, { id: primaryRid });
        return { status: "merged", primary: result?.[0], secondary_archived: secondary_id };
    },
});

export const loreArchiveNodeTool = createTool({
    id: "lore_archive_node",
    description: "Soft-delete a lore node that has been superseded or created in error. Archived nodes remain in the record but are no longer surfaced by the Witness. Always create a supersedes relation pointing to the replacement first.",
    inputSchema: z.object({
        node_id: z.string(),
        reason: z.string().describe("Why this node is being archived"),
    }),
    execute: async ({ node_id, reason }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);
        const [result] = await db.query<[LoreNode[]]>(
            `UPDATE $id SET canon = false, properties = object::merge(properties, {archived: true, archived_reason: $r}), updated_at = time::now() RETURN AFTER`,
            { id: rid, r: reason }
        );
        return result?.[0] ?? { error: "Node not found", node_id };
    },
});

export const loreResolveContradictionTool = createTool({
    id: "lore_resolve_contradiction",
    description: "Reconcile two or more conflicting lore nodes. Resolution modes: supersede (one replaces another), coexist (both true, different perspectives), unknown (ambiguity is deliberate), disproven (one is false).",
    inputSchema: z.object({
        conflicting_ids: z.array(z.string()).describe("lore_node IDs in conflict"),
        resolution: z.enum(["supersede", "coexist", "unknown", "disproven"]),
        winner_id: z.string().optional().describe("For 'supersede' and 'disproven' — the node that prevails"),
        notes: z.string().describe("Explanation of how the contradiction is resolved"),
    }),
    execute: async ({ conflicting_ids, resolution, winner_id, notes }) => {
        const db = await getDB();
        const results: Record<string, unknown>[] = [];

        if (resolution === "supersede" && winner_id) {
            const winnerRid = new StringRecordId(winner_id);
            for (const id of conflicting_ids) {
                if (id === winner_id) continue;
                const loserRid = new StringRecordId(id);
                await db.query(
                    `RELATE $winner->lore_relation->$loser SET relation_type = 'supersedes', weight = 1.0, metadata = {notes: $notes}`,
                    { winner: winnerRid, loser: loserRid, notes }
                );
                await db.query(`UPDATE $id SET canon = false, properties = object::merge(properties, {archived: true}), updated_at = time::now()`, { id: loserRid });
                results.push({ id, action: "archived" });
            }
        } else if (resolution === "disproven" && winner_id) {
            for (const id of conflicting_ids) {
                if (id === winner_id) continue;
                const rid = new StringRecordId(id);
                await db.query(`UPDATE $id SET canon = false, properties = object::merge(properties, {disproven: true, disproven_notes: $notes}), updated_at = time::now()`, { id: rid, notes });
                results.push({ id, action: "disproven" });
            }
        } else if (resolution === "coexist") {
            results.push({ action: "coexist", note: "Both nodes remain canon — conflict is meaningful", ids: conflicting_ids });
        } else {
            results.push({ action: "unknown", note: "Contradiction preserved as deliberate ambiguity", ids: conflicting_ids });
        }

        return { resolution, notes, results };
    },
});

export const validateCanonConsistencyTool = createTool({
    id: "validate_canon_consistency",
    description: "Run a full consistency check on a lore node against the entire lore graph. Always run before finalizing major lore updates — especially concept promotions and character revelation nodes.",
    inputSchema: z.object({
        node_id: z.string(),
    }),
    execute: async ({ node_id }) => {
        const db = await getDB();
        const rid = new StringRecordId(node_id);

        const [nodeRows] = await db.query<[LoreNode[]]>(`SELECT * FROM $id`, { id: rid });
        const node = nodeRows?.[0];
        if (!node) return { consistent: false, issues: ["Node not found"] };

        const issues: string[] = [];

        // Check for direct contradicts relations
        const [contradicts] = await db.query<[{ id: string; name: string }[]]>(
            `SELECT id, name FROM lore_node WHERE ->lore_relation[WHERE relation_type = 'contradicts']->(lore_node WHERE id = $id)`,
            { id: rid }
        );
        if ((contradicts ?? []).length > 0) {
            issues.push(`Contradicted by: ${contradicts.map(n => n.name).join(", ")}`);
        }

        // Check for duplicate names
        const [dupes] = await db.query<[{ count: number }[]]>(
            `SELECT count() FROM lore_node WHERE string::lowercase(name) = string::lowercase($n) GROUP ALL`,
            { n: node.name }
        );
        if ((dupes?.[0]?.count ?? 0) > 1) {
            issues.push(`Duplicate name detected: ${node.name}`);
        }

        // Check it has at least one relation (isolated nodes are suspicious)
        const [relCount] = await db.query<[{ count: number }[]]>(
            `SELECT count() FROM lore_relation WHERE in = $id OR out = $id GROUP ALL`,
            { id: rid }
        );
        if ((relCount?.[0]?.count ?? 0) === 0) {
            issues.push("Node has no lore relations — isolated nodes may be orphaned duplicates");
        }

        return { consistent: issues.length === 0, issues, node_id, node_name: node.name };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATOR (WITNESS) — QUERY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const loreGetByKindTool = createTool({
    id: "lore_get_by_kind",
    description: "Fetch all lore by entity type. Use sparingly — only when needing a full census of a category to verify no canon conflict before introducing a new character or location.",
    inputSchema: z.object({
        kind: z.enum(["character", "faction", "location", "item", "event", "concept"]),
        limit: z.number().int().default(20),
    }),
    execute: async ({ kind, limit }) => {
        const db = await getDB();
        const [rows] = await db.query<[LoreNode[]]>(
            `SELECT id, kind, name, description FROM lore_node WHERE kind = $kind AND canon = true LIMIT $lim`,
            { kind, lim: limit }
        );
        return rows ?? [];
    },
});

export const worldQueryNearbyAgentsTool = createTool({
    id: "world_query_nearby_agents",
    description: "Get all agents currently at or near a location. Call every turn — every NPC in the scene has mood, goals, and beliefs that directly constrain what choices make sense.",
    inputSchema: z.object({
        location_id: z.string().describe("world_location record ID — the player's current location"),
        radius: z.number().int().min(1).max(2).default(1).describe("1=same location only, 2=adjacent locations included"),
    }),
    execute: async ({ location_id, radius }) => {
        const db = await getDB();
        const rid = new StringRecordId(location_id);
        // Uses denormalized location_id field for fast lookup — the located_at relation
        // is still maintained as the semantic record with full metadata
        const [atLocation] = await db.query<[Record<string, unknown>[]]>(
            `SELECT id, name, kind, disposition, awareness, goal_current, emotional_charge, agency_quota, drama_debt
             FROM world_agent WHERE location_id = $loc AND active = true`,
            { loc: rid }
        );
        if ((radius ?? 1) < 2) return atLocation ?? [];
        const [adjacent] = await db.query<[Record<string, unknown>[]]>(`
            SELECT id, name, kind, disposition, awareness, goal_current, emotional_charge, agency_quota
            FROM world_agent
            WHERE location_id IN (
                SELECT out FROM world_edge WHERE in = $loc AND edge_type = 'LEADS_TO' AND active = true
            ) AND active = true
        `, { loc: rid });
        return [...(atLocation ?? []), ...(adjacent ?? [])];
    },
});

export const worldQueryActiveEventsTool = createTool({
    id: "world_query_active_events",
    description: "Find unresolved events at the current location. Events have weight, spotlight, and ideas_spawned that describe what's in the atmosphere. Call after world_query_nearby_agents every turn.",
    inputSchema: z.object({
        location_id: z.string().describe("world_location record ID"),
    }),
    execute: async ({ location_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[WorldEvent[]]>(
            `SELECT * FROM world_event WHERE location_id = $loc AND resolved = false ORDER BY significance DESC`,
            { loc: location_id }
        );
        return rows ?? [];
    },
});

export const worldGetAgentGoalsTool = createTool({
    id: "world_get_agent_goals",
    description: "Read an NPC's visible and hidden agenda. The gap between goal_current and goal_hidden is where drama lives. Never write an option involving an NPC without calling this first.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[{ id: string; name: string; goal_current: string; goal_hidden: string }[]]>(
            `SELECT id, name, goal_current, goal_hidden FROM $id`,
            { id: new StringRecordId(agent_id) }
        );
        return rows?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const worldQueryConceptsByAdoptionTool = createTool({
    id: "world_query_concepts_by_adoption",
    description: "Find concepts at or above an adoption threshold. Below 0.4 = fringe. 0.4–0.75 = contested. Above 0.75 = canonical world truth. Call with 0.4 when writing options involving persuasion or ideology.",
    inputSchema: z.object({
        threshold: z.number().min(0).max(1).describe("Minimum swarm_coherence score"),
        limit: z.number().int().default(10),
    }),
    execute: async ({ threshold, limit }) => {
        const db = await getDB();
        const [rows] = await db.query<[WorldConcept[]]>(
            `SELECT * FROM world_concept WHERE swarm_coherence >= $t AND active = true ORDER BY swarm_coherence DESC LIMIT $lim`,
            { t: threshold, lim: limit }
        );
        return rows ?? [];
    },
});

export const worldGetFactionTensionsTool = createTool({
    id: "world_get_faction_tensions",
    description: "Query current faction relationships — standings, alliances, hostilities, player_standing. Call when the scene involves faction politics or when writing options involving allegiance.",
    inputSchema: z.object({}),
    execute: async () => {
        const db = await getDB();
        const [factions] = await db.query<[Record<string, unknown>[]]>(
            `SELECT id, name, player_standing, internal_coherence, emotional_charge, alliances, hostilities, narrative_weight
             FROM world_faction ORDER BY narrative_weight DESC`
        );
        return factions ?? [];
    },
});

export const checkStoryPhaseTool = createTool({
    id: "check_story_phase",
    description: "Read the Hero's Journey phase, phase_charge accumulation, and breaking_point proximity. First Witness call every turn — constraints it sets drive option generation.",
    inputSchema: z.object({ session_id: z.string() }),
    execute: async ({ session_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[NarrativePhaseState[]]>(
            `SELECT * FROM narrative_state WHERE session_id = $sid LIMIT 1`,
            { sid: session_id }
        );
        return rows?.[0] ?? {
            session_id,
            current_phase: "ordinary_world",
            phase_charge: 0,
            narrative_entropy: 0,
            archetype_cohesion: 0.8,
            player_resonance: 0,
            inertia_resistance: 0.5,
            point_of_no_return: 0,
            pull_conflict: 0,
            story_pace: 1.0,
            breaking_point: 0,
            event_distortion: 0,
            world_awareness: 0,
        };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATOR (WITNESS) — GENERATE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const generateActionOptionsTool = createTool({
    id: "generate_action_options",
    description: "The Witness's primary output. Produces 3–5 player choices grounded in the current world state. Must include: text, tone, lore_references, consequence_preview, and weight. Balance: one escalates tension, one builds connection, one gathers information, one avoids commitment, fifth is a wildcard.",
    inputSchema: z.object({
        session_id: z.string(),
        location_id: z.string(),
        nearby_agent_ids: z.array(z.string()).default([]),
        active_event_ids: z.array(z.string()).default([]),
        lore_context: z.array(z.string()).default([]),
        phase_constraint: z.object({
            current_phase: z.string(),
            breaking_point: z.number(),
            narrative_entropy: z.number(),
        }).optional(),
        options: z.array(z.object({
            text: z.string(),
            tone: z.enum(["aggressive", "diplomatic", "cautious", "curious", "compassionate", "deceptive", "heroic", "cowardly"]),
            lore_references: z.array(z.string()).default([]),
            consequence_preview: z.string(),
            weight: z.number().min(0).max(1),
            vector_deltas: z.object({
                moral: z.number().min(-1).max(1).default(0),
                method: z.number().min(-1).max(1).default(0),
                social: z.number().min(-1).max(1).default(0),
            }).optional(),
        })).min(3).max(5),
    }),
    execute: async ({ session_id, options }) => {
        const db = await getDB();
        await db.query(`
            UPDATE world_thread
            SET state = { options: $opts }, active = true, updated_at = time::now()
            WHERE name = 'options_checkpoint' AND session_id = $sid
        `, { sid: session_id, opts: options });
        return options.map((opt, i) => ({ id: `opt_${Date.now()}_${i}`, ...opt }));
    },
});

export const generateDialogueOptionsTool = createTool({
    id: "generate_dialogue_options",
    description: "Produce conversation choices for a direct NPC interaction. Each option reflects a different conversational approach with meaningfully different effects on trust and shared_beliefs.",
    inputSchema: z.object({
        npc_id: z.string(),
        context: z.string(),
        options: z.array(z.object({
            text: z.string(),
            tone: z.enum(["aggressive", "diplomatic", "cautious", "curious", "compassionate", "deceptive", "heroic", "cowardly"]),
            effect_on_trust: z.number().min(-1).max(1),
            effect_on_shared_beliefs: z.number().min(-1).max(1),
            consequence_preview: z.string(),
        })).min(3).max(5),
    }),
    execute: async ({ npc_id, options }) => {
        const db = await getDB();
        const [agentRows] = await db.query<[{ name: string }[]]>(`SELECT name FROM $id`, { id: new StringRecordId(npc_id) });
        return {
            npc_id,
            npc_name: agentRows?.[0]?.name ?? "Unknown",
            options: options.map((opt, i) => ({ id: `dlg_${Date.now()}_${i}`, ...opt })),
        };
    },
});

export const calculateOptionConsequencesTool = createTool({
    id: "calculate_option_consequences",
    description: "Calculate the predicted consequence of an option before finalizing it. Returns: immediate effect, which agents will react, which concepts will shift, and whether events will be created. Always run on every option before returning.",
    inputSchema: z.object({
        option_text: z.string(),
        option_tone: z.enum(["aggressive", "diplomatic", "cautious", "curious", "compassionate", "deceptive", "heroic", "cowardly"]),
        affected_agent_ids: z.array(z.string()).default([]),
        vector_deltas: z.object({
            moral: z.number().min(-1).max(1).default(0),
            method: z.number().min(-1).max(1).default(0),
            social: z.number().min(-1).max(1).default(0),
        }).optional(),
    }),
    execute: async ({ option_text, option_tone, affected_agent_ids, vector_deltas }) => {
        const db = await getDB();
        const agentPreviews: { id: string; name: string; predicted_reaction: string }[] = [];

        for (const id of affected_agent_ids ?? []) {
            const [rows] = await db.query<[Record<string, unknown>[]]>(
                `SELECT name, disposition, awareness FROM $id`, { id: new StringRecordId(id) }
            );
            const agent = rows?.[0];
            if (!agent) continue;
            let predictedReaction = "observes";
            if (option_tone === "aggressive" && agent.disposition === "neutral") predictedReaction = "becomes wary";
            if (option_tone === "diplomatic" && agent.disposition === "hostile") predictedReaction = "may soften";
            if (option_tone === "deceptive") predictedReaction = "may become suspicious";
            if (option_tone === "heroic") predictedReaction = "may increase trust";
            agentPreviews.push({ id, name: agent.name as string, predicted_reaction: predictedReaction });
        }

        const toneConcepts: Record<string, string[]> = {
            aggressive: ["dominance", "fear"], diplomatic: ["cooperation", "trust"],
            deceptive: ["betrayal", "manipulation"], heroic: ["courage", "hope"],
            cowardly: ["fear", "shame"], compassionate: ["mercy", "connection"],
            cautious: ["survival", "caution"], curious: ["discovery", "knowledge"],
        };

        return {
            immediate_effect: `Player: ${option_text.slice(0, 80)}`,
            agents_affected: agentPreviews,
            concepts_likely_seeded: toneConcepts[option_tone] ?? [],
            vector_impact: vector_deltas ?? { moral: 0, method: 0, social: 0 },
            will_create_event: agentPreviews.length > 0 && option_tone !== "cautious",
            will_resolve_event: false,
        };
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// NPC AGENT — SELF TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const selfGetStatsTool = createTool({
    id: "self_get_stats",
    description: "Read the NPC's own world_agent record. Always the first call — an NPC that doesn't know its own state cannot make meaningful decisions.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[Record<string, unknown>[]]>(`SELECT * FROM $id`, { id: new StringRecordId(agent_id) });
        return rows?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const selfUpdateStatsTool = createTool({
    id: "self_update_stats",
    description: "Modify the NPC's own emotional charge, beliefs, goals, or drama_debt. Called when the NPC processes an event they witnessed.",
    inputSchema: z.object({
        agent_id: z.string(),
        changes: z.object({
            emotional_charge: z.number().min(-1).max(1).optional(),
            concept_affinity: z.record(z.string(), z.number()).optional(),
            awareness: z.enum(["unaware", "suspicious", "alerted", "hostile", "allied"]).optional(),
            disposition: z.enum(["hostile", "neutral", "friendly", "unknown"]).optional(),
            state: z.record(z.string(), z.unknown()).optional(),
        }),
    }),
    execute: async ({ agent_id, changes }) => {
        const db = await getDB();
        const rid = new StringRecordId(agent_id);
        const sets: string[] = ["updated_at = time::now()"];
        const params: Record<string, unknown> = { id: rid };
        if (changes.emotional_charge !== undefined) { sets.push("emotional_charge = math::clamp(emotional_charge + $ec, -1.0, 1.0)"); params.ec = changes.emotional_charge; }
        if (changes.concept_affinity !== undefined) { sets.push("concept_affinity = object::merge(concept_affinity, $ca)"); params.ca = changes.concept_affinity; }
        if (changes.awareness !== undefined) { sets.push("awareness = $aw"); params.aw = changes.awareness; }
        if (changes.disposition !== undefined) { sets.push("disposition = $disp"); params.disp = changes.disposition; }
        if (changes.state !== undefined) { sets.push("state = object::merge(state, $st)"); params.st = changes.state; }
        const [result] = await db.query<[Record<string, unknown>[]]>(`UPDATE $id SET ${sets.join(", ")} RETURN AFTER`, params);
        return result?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const selfDepleteAgencyTool = createTool({
    id: "self_deplete_agency",
    description: "Reduce energy (agency_quota) by the specified amount. Every significant action or decision costs energy. An NPC at 0 cannot initiate anything.",
    inputSchema: z.object({
        agent_id: z.string(),
        amount: z.number().int().min(1).max(100),
    }),
    execute: async ({ agent_id, amount }) => {
        const db = await getDB();
        const [result] = await db.query<[Record<string, unknown>[]]>(
            `UPDATE $id SET agency_quota = math::max(0, agency_quota - $amt), updated_at = time::now() RETURN AFTER`,
            { id: new StringRecordId(agent_id), amt: amount }
        );
        return result?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const selfGetGoalsTool = createTool({
    id: "self_get_goals",
    description: "Read the NPC's current and hidden goals. The hidden goal is what the NPC never says aloud — but always acts toward.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[{ goal_current: string; goal_hidden: string }[]]>(
            `SELECT goal_current, goal_hidden FROM $id`, { id: new StringRecordId(agent_id) }
        );
        return rows?.[0] ?? { goal_current: "", goal_hidden: "" };
    },
});

export const selfUpdateGoalsTool = createTool({
    id: "self_update_goals",
    description: "Modify the NPC's goals based on what just happened. A character who discovers betrayal updates goal_hidden. A character who accomplishes their visible goal needs a new goal_current.",
    inputSchema: z.object({
        agent_id: z.string(),
        goal_current: z.string().optional(),
        goal_hidden: z.string().optional(),
    }),
    execute: async ({ agent_id, goal_current, goal_hidden }) => {
        const db = await getDB();
        const sets: string[] = ["updated_at = time::now()"];
        const params: Record<string, unknown> = { id: new StringRecordId(agent_id) };
        if (goal_current !== undefined) { sets.push("goal_current = $gc"); params.gc = goal_current; }
        if (goal_hidden !== undefined) { sets.push("goal_hidden = $gh"); params.gh = goal_hidden; }
        const [result] = await db.query<[Record<string, unknown>[]]>(`UPDATE $id SET ${sets.join(", ")} RETURN AFTER`, params);
        return result?.[0] ?? { error: "Agent not found", agent_id };
    },
});

export const queryRelationshipsTool = createTool({
    id: "query_relationships",
    description: "Get all relationship edges for this NPC. Understand who they trust, who they're in tension with, and who they can transmit influence through.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[AgentRelationship[]]>(
            `SELECT *, out.name AS target_name FROM relationship WHERE in = $id`,
            { id: new StringRecordId(agent_id) }
        );
        return rows ?? [];
    },
});

export const queryRelationshipWithTool = createTool({
    id: "query_relationship_with",
    description: "Get the specific relationship between this NPC and a named agent. More targeted than query_relationships — used when deciding how to respond to a specific character.",
    inputSchema: z.object({
        agent_id: z.string(),
        target_id: z.string(),
    }),
    execute: async ({ agent_id, target_id }) => {
        const db = await getDB();
        const [rows] = await db.query<[AgentRelationship[]]>(
            `SELECT * FROM relationship WHERE in = $a1 AND out = $a2 LIMIT 1`,
            { a1: new StringRecordId(agent_id), a2: new StringRecordId(target_id) }
        );
        return rows?.[0] ?? { error: "No relationship found", agent_id, target_id };
    },
});

export const updateRelationshipTool = createTool({
    id: "update_relationship",
    description: "Modify this NPC's relationship with another agent — trust, tension, or shared beliefs. Called when the NPC processes an interaction.",
    inputSchema: z.object({
        agent_id: z.string(),
        target_id: z.string(),
        changes: z.object({
            trust: z.number().min(0).max(1).optional(),
            tension: z.number().min(0).max(1).optional(),
            conceptual_resonance: z.number().min(-1).max(1).optional(),
            narrative_entanglement: z.number().int().optional(),
        }),
    }),
    execute: async ({ agent_id, target_id, changes }) => {
        const db = await getDB();
        const a1 = new StringRecordId(agent_id);
        const a2 = new StringRecordId(target_id);
        const sets: string[] = ["updated_at = time::now()"];
        const params: Record<string, unknown> = { a1, a2 };
        if (changes.trust !== undefined) { sets.push("trust = $trust"); params.trust = changes.trust; }
        if (changes.tension !== undefined) { sets.push("tension = $tension"); params.tension = changes.tension; }
        if (changes.conceptual_resonance !== undefined) { sets.push("conceptual_resonance = $cr"); params.cr = changes.conceptual_resonance; }
        if (changes.narrative_entanglement !== undefined) { sets.push("narrative_entanglement = $ne"); params.ne = changes.narrative_entanglement; }
        const [result] = await db.query<[AgentRelationship[]]>(
            `UPDATE relationship SET ${sets.join(", ")} WHERE in = $a1 AND out = $a2 RETURN AFTER`, params
        );
        return result?.[0] ?? { error: "Relationship not found", agent_id, target_id };
    },
});

export const queryLocationTool = createTool({
    id: "query_location",
    description: "Get the NPC's current location and who else is there. Informs movement decisions and social actions.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        // location is a typed relation (located_at) — fetch via graph traversal
        const [locRows] = await db.query<[WorldLocation[]]>(
            `SELECT * FROM world_location WHERE <-(located_at WHERE in = $agent)`,
            { agent: agentRid }
        );
        const location = locRows?.[0];
        if (!location) return { error: "Agent or location not found", agent_id };
        const locRid = new StringRecordId(String(location.id));
        const [nearbyRows] = await db.query<[Record<string, unknown>[]]>(
            `SELECT id, name, kind, disposition, awareness FROM world_agent
             WHERE ->(located_at WHERE out = $loc) AND active = true AND id != $self`,
            { loc: locRid, self: agentRid }
        );
        return { location, nearby_agents: nearbyRows ?? [] };
    },
});

export const queryNearbyAgentsTool = createTool({
    id: "query_nearby_agents",
    description: "Find other agents near this NPC — same location (radius 1) or adjacent locations (radius 2).",
    inputSchema: z.object({
        agent_id: z.string(),
        radius: z.number().int().min(1).max(2).default(1),
    }),
    execute: async ({ agent_id, radius }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        // Resolve current location via typed relation
        const [locRows] = await db.query<[{ id: string }[]]>(
            `SELECT id FROM world_location WHERE <-(located_at WHERE in = $agent)`,
            { agent: agentRid }
        );
        const locId = locRows?.[0]?.id;
        if (!locId) return [];
        const locRid = new StringRecordId(locId);
        const [atLocation] = await db.query<[Record<string, unknown>[]]>(
            `SELECT id, name, kind, disposition, emotional_charge FROM world_agent
             WHERE ->(located_at WHERE out = $loc) AND active = true AND id != $self`,
            { loc: locRid, self: agentRid }
        );
        if ((radius ?? 1) < 2) return atLocation ?? [];
        const [adjacent] = await db.query<[Record<string, unknown>[]]>(`
            SELECT id, name, kind, disposition FROM world_agent
            WHERE ->(located_at WHERE out IN (
                SELECT out FROM world_edge WHERE in = $loc AND edge_type = 'LEADS_TO'
            )) AND active = true
        `, { loc: locRid });
        return [...(atLocation ?? []), ...(adjacent ?? [])];
    },
});

export const queryNearbyEventsTool = createTool({
    id: "query_nearby_events",
    description: "Find active unresolved events at this NPC's location. Events with high weight matching the NPC's drawn_to pull the NPC toward them.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        const [locRows] = await db.query<[{ id: string }[]]>(
            `SELECT id FROM world_location WHERE <-(located_at WHERE in = $agent)`,
            { agent: agentRid }
        );
        const locId = locRows?.[0]?.id;
        if (!locId) return [];
        const [rows] = await db.query<[WorldEvent[]]>(
            `SELECT * FROM world_event WHERE location_id = $loc AND resolved = false ORDER BY significance DESC`,
            { loc: locId }
        );
        return rows ?? [];
    },
});

export const queryNearbyItemsTool = createTool({
    id: "query_nearby_items",
    description: "Find items at the NPC's location. Used when the NPC's goals or leverage profile involves an item.",
    inputSchema: z.object({ agent_id: z.string() }),
    execute: async ({ agent_id }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        const [locRows] = await db.query<[{ id: string }[]]>(
            `SELECT id FROM world_location WHERE <-(located_at WHERE in = $agent)`,
            { agent: agentRid }
        );
        const locId = locRows?.[0]?.id;
        if (!locId) return [];
        const [rows] = await db.query<[WorldItem[]]>(`SELECT * FROM world_item WHERE location_id = $loc`, { loc: locId });
        return rows ?? [];
    },
});

export const evaluateEventAttractionTool = createTool({
    id: "evaluate_event_attraction",
    description: "Dot-product: event weight vs NPC drawn_to (gravitational_signature). Returns whether the NPC is attracted to this event. Core SAINT NGE calculation.",
    inputSchema: z.object({
        agent_id: z.string(),
        event_id: z.string(),
    }),
    execute: async ({ agent_id, event_id }) => {
        const db = await getDB();
        const [agentRows] = await db.query<[WorldAgent[]]>(
            `SELECT gravitational_signature, plausibility_threshold FROM $id`, { id: new StringRecordId(agent_id) }
        );
        const [eventRows] = await db.query<[WorldEvent[]]>(`SELECT gravitational_mass, temporal_ripple FROM $id`, { id: new StringRecordId(event_id) });
        const agent = agentRows?.[0];
        const event = eventRows?.[0];
        if (!agent || !event) return { attracted: false, pull_strength: 0, reason: "Not found" };
        const drawn = agent.gravitational_signature ?? [0.3, 0.3, 0.3];
        const weight = (event.gravitational_mass as number[]) ?? [0, 0, 0];
        const dot = drawn[0] * weight[0] + drawn[1] * weight[1] + drawn[2] * weight[2];
        const pull_strength = dot / ((event.temporal_ripple ?? 0) + 1);
        const threshold = (agent.plausibility_threshold ?? 0.6) * 0.3;
        return {
            attracted: pull_strength > threshold,
            pull_strength: Math.round(pull_strength * 1000) / 1000,
            reason: pull_strength > threshold ? `Pull ${pull_strength.toFixed(3)} > threshold ${threshold.toFixed(3)}` : `Pull ${pull_strength.toFixed(3)} < threshold ${threshold.toFixed(3)}`,
        };
    },
});

export const evaluateConceptAlignmentTool = createTool({
    id: "evaluate_concept_alignment",
    description: "Compares a concept against the NPC's beliefs (concept_affinity). Returns whether the NPC is ideologically receptive. Use before adopt_concept or reject_concept.",
    inputSchema: z.object({
        agent_id: z.string(),
        concept_id: z.string(),
    }),
    execute: async ({ agent_id, concept_id }) => {
        const db = await getDB();
        const [agentRows] = await db.query<[WorldAgent[]]>(
            `SELECT concept_affinity, plausibility_threshold FROM $id`, { id: new StringRecordId(agent_id) }
        );
        const [conceptRows] = await db.query<[WorldConcept[]]>(`SELECT * FROM $id`, { id: new StringRecordId(concept_id) });
        const agent = agentRows?.[0];
        const concept = conceptRows?.[0];
        if (!agent || !concept) return { aligned: false, resonance: 0 };
        const affinity = agent.concept_affinity ?? {};
        const existingBelief = affinity[concept.name] ?? 0;
        const opposingScore = concept.opposes.reduce((acc, opp) => acc + Math.abs(affinity[opp] ?? 0), 0);
        const resonance = existingBelief - opposingScore * 0.5;
        const threshold = agent.plausibility_threshold ?? 0.6;
        return {
            aligned: resonance > -0.5 && concept.swarm_coherence > threshold * 0.3,
            resonance: Math.round(resonance * 1000) / 1000,
            existing_belief: existingBelief,
            opposing_resistance: opposingScore,
        };
    },
});

export const adoptConceptTool = createTool({
    id: "adopt_concept",
    description: "Add a concept to the NPC's beliefs. Creates influenced_by relation and increments swarm_coherence. Only call after evaluate_concept_alignment returns receptive.",
    inputSchema: z.object({
        agent_id: z.string(),
        concept_id: z.string(),
        strength: z.number().min(0.1).max(1),
    }),
    execute: async ({ agent_id, concept_id, strength }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        const conceptRid = new StringRecordId(concept_id);
        const [conceptRows] = await db.query<[WorldConcept[]]>(`SELECT name, swarm_coherence FROM $id`, { id: conceptRid });
        const concept = conceptRows?.[0];
        if (!concept) return { error: "Concept not found", concept_id };
        await db.query(`UPDATE $id SET concept_affinity = object::merge(concept_affinity, $ca), updated_at = time::now()`, { id: agentRid, ca: { [concept.name]: strength } });
        await db.query(`RELATE $agent->influenced_by->$concept SET strength = $s, adopted_at = time::now()`, { agent: agentRid, concept: conceptRid, s: strength });
        const [total] = await db.query<[{ count: number }[]]>(`SELECT count() FROM world_agent GROUP ALL`);
        const [adopted] = await db.query<[{ count: number }[]]>(`SELECT count() FROM influenced_by WHERE out = $id GROUP ALL`, { id: conceptRid });
        const newCoherence = Math.min((adopted?.[0]?.count ?? 1) / (total?.[0]?.count ?? 1), 1.0);
        await db.query(`UPDATE $id SET swarm_coherence = $sc, updated_at = time::now()`, { id: conceptRid, sc: newCoherence });
        return { status: "adopted", agent_id, concept_name: concept.name, strength, new_swarm_coherence: newCoherence };
    },
});

export const rejectConceptTool = createTool({
    id: "reject_concept",
    description: "Remove a concept from the NPC's beliefs and decrement swarm_coherence. Called when plausibility_threshold rejects an idea or counter-evidence displaces an existing belief.",
    inputSchema: z.object({
        agent_id: z.string(),
        concept_id: z.string(),
    }),
    execute: async ({ agent_id, concept_id }) => {
        const db = await getDB();
        const agentRid = new StringRecordId(agent_id);
        const conceptRid = new StringRecordId(concept_id);
        const [conceptRows] = await db.query<[WorldConcept[]]>(`SELECT name FROM $id`, { id: conceptRid });
        const concept = conceptRows?.[0];
        if (!concept) return { error: "Concept not found", concept_id };
        await db.query(`UPDATE $id SET concept_affinity = object::merge(concept_affinity, $ca), updated_at = time::now()`, { id: agentRid, ca: { [concept.name]: 0 } });
        await db.query(`DELETE influenced_by WHERE in = $agent AND out = $concept`, { agent: agentRid, concept: conceptRid });
        const [total] = await db.query<[{ count: number }[]]>(`SELECT count() FROM world_agent GROUP ALL`);
        const [adopted] = await db.query<[{ count: number }[]]>(`SELECT count() FROM influenced_by WHERE out = $id GROUP ALL`, { id: conceptRid });
        const newCoherence = Math.min((adopted?.[0]?.count ?? 0) / (total?.[0]?.count ?? 1), 1.0);
        await db.query(`UPDATE $id SET swarm_coherence = $sc, updated_at = time::now()`, { id: conceptRid, sc: newCoherence });
        return { status: "rejected", agent_id, concept_name: concept.name, new_swarm_coherence: newCoherence };
    },
});

export const formAllianceTool = createTool({
    id: "form_alliance",
    description: "Strengthen the relationship with another agent — increases trust and gravitational_coupling. Creates the relationship typed relation if it doesn't exist.",
    inputSchema: z.object({
        agent_id: z.string(),
        target_id: z.string(),
        trust_boost: z.number().min(0).max(0.3).default(0.1),
        bond_boost: z.number().min(0).max(0.3).default(0.1),
    }),
    execute: async ({ agent_id, target_id, trust_boost, bond_boost }): Promise<{
        status: string;
        relationship?: AgentRelationship;
        agent_id?: string;
        target_id?: string;
    }> => {
        const db = await getDB();
        const a1 = new StringRecordId(agent_id);
        const a2 = new StringRecordId(target_id);
        const [existing] = await db.query<[AgentRelationship[]]>(`SELECT * FROM relationship WHERE in = $a1 AND out = $a2 LIMIT 1`, { a1, a2 });
        if (existing?.[0]) {
            const [result] = await db.query<[AgentRelationship[]]>(`
                UPDATE relationship SET
                    trust = math::clamp(trust + $tb, 0, 1),
                    gravitational_coupling = math::clamp(gravitational_coupling + $bb, 0, 1),
                    narrative_entanglement = narrative_entanglement + 1,
                    tension = math::clamp(tension - 0.05, 0, 1),
                    updated_at = time::now()
                WHERE in = $a1 AND out = $a2 RETURN AFTER
            `, { a1, a2, tb: trust_boost, bb: bond_boost });
            return { status: "strengthened", relationship: result?.[0] };
        }
        await db.query(`
            RELATE $a1->relationship->$a2 SET relation_type = 'ally', trust = $tb, tension = 0.0,
            conceptual_resonance = 0.3, narrative_entanglement = 1, influence_conduit = 0.6,
            gravitational_coupling = $bb, temporal_sync = 0.5, vector_refraction = [0.5,0.5,0.5],
            plausibility_anchor = 0.7, updated_at = time::now()
        `, { a1, a2, tb: 0.5 + trust_boost!, bb: 0.3 + bond_boost! });
        return { status: "created", agent_id, target_id };
    },
});

export const breakAllianceTool = createTool({
    id: "break_alliance",
    description: "Weaken or sever a relationship — decreases trust, increases tension. When trust drops below 0.2 and tension above 0.7, betrayal events become available.",
    inputSchema: z.object({
        agent_id: z.string(),
        target_id: z.string(),
        trust_drop: z.number().min(0).max(0.5).default(0.2),
        tension_rise: z.number().min(0).max(0.5).default(0.2),
    }),
    execute: async ({ agent_id, target_id, trust_drop, tension_rise }) => {
        const db = await getDB();
        const a1 = new StringRecordId(agent_id);
        const a2 = new StringRecordId(target_id);
        const [result] = await db.query<[AgentRelationship[]]>(`
            UPDATE relationship SET
                trust = math::clamp(trust - $td, 0, 1),
                tension = math::clamp(tension + $tr, 0, 1),
                gravitational_coupling = math::clamp(gravitational_coupling - 0.1, 0, 1),
                narrative_entanglement = narrative_entanglement + 1,
                updated_at = time::now()
            WHERE in = $a1 AND out = $a2 RETURN AFTER
        `, { a1, a2, td: trust_drop, tr: tension_rise });
        const rel = result?.[0] as AgentRelationship | undefined;
        const mayBetray = rel && rel.trust < 0.2 && rel.tension > 0.7;
        return {
            status: "weakened",
            relationship: rel,
            betrayal_risk: mayBetray ? "HIGH — trust < 0.2 and tension > 0.7, consider world_create_event" : "low",
        };
    },
});

