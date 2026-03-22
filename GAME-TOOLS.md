# SAINT Engine — Tool Call Reference

## Overview

The SAINT Engine (Solomonic Autonomous Intelligent Narrative Technology) runs a
four-agent loop every turn: **The Tremor** → **The Eternal** (conditional) →
**The Witness** → **The Prose Agent**. Each agent has access to a specific subset
of tools. No agent calls tools outside its designated category.

Tool ownership is strict by design. The Tremor writes the world. The Eternal
writes lore. The Witness reads both. The Prose Agent writes nothing — it only
generates text from context.

All tools interact with two graphs in SurrealDB:

- **Lore Graph** — permanent, immutable after World Forge. Tables: `lore_node`,
  `lore_relation`, `lore_event`. Only the Eternal writes here.
- **World Graph** — live simulation state, mutated every turn. Tables:
  `world_agent`, `world_location`, `world_item`, `world_faction`,
  `world_concept`, `world_event`, `world_thread`, `world_edge`, plus all typed
  relation tables (`located_at`, `member_of`, `held_by`, `relationship`,
  `influenced_by`, `participated_in`, `controls`). Only the Tremor and NPC
  Agents write here.

---

## The Tremor — Update Tools

The Tremor runs first after every player choice. It processes the world impact,
mutates agent and location state, propagates mood and concepts through the social
graph, and signals the Eternal when something significant occurred.

**Output discipline:** One sentence of reasoning before each tool call. One
sentence confirming the write after. 3–5 sentence summary at the end. Do not
explain. Act, confirm, move on.

---

### `world_update_agent`

**Signature:** `world_update_agent(agent_id: string, changes: Partial<WorldAgent>) → WorldAgent`

Modifies any field on a `world_agent` record. The most common use is updating
`mood` (emotional_charge), `awareness`, `goal_current`, and depleting
`energy` (agency_quota) after an action or significant witness event.

**When to call:**
- Any NPC who was directly involved in the player's choice
- Any NPC who witnessed the event (smaller delta than direct involvement)
- The player agent itself — to update `mood`, `energy`, or `state`

**SAINT physics touched:** `emotional_charge`, `awareness`, `agency_quota`,
`goal_current`, `goal_hidden`, `concept_affinity`, `narrative_weight`,
`drama_debt`

**Example:** Player deceived The Keeper. Call with `{ awareness: "suspicious",
emotional_charge: -0.1 }`. Small mood drop because The Keeper feels something
is wrong but can't name it. Not "alerted" yet — the deception partially worked.

---

### `world_update_location`

**Signature:** `world_update_location(location_id: string, changes: Partial<WorldLocation>) → WorldLocation`

Modifies location state. Most commonly updates `atmosphere`, `concept_imprint`,
`emotional_charge`, and `revealed_secrets` when the player enters, something
happens there, or a secret is discovered.

**When to call:**
- Player enters a location for the first time → update `atmosphere`, set
  `accessible: true` if it was previously locked
- An event occurs at the location → update `concept_imprint` and
  `emotional_charge`
- A secret is discovered → move the entry from `secrets[]` to
  `revealed_secrets[]`

**SAINT physics touched:** `concept_imprint`, `emotional_charge`,
`gravitational_signature`, `traversal_risk`, `plausibility_modifier`

**Example:** Player descended to the Archive Basement. Call with `{ accessible:
true, atmosphere: "Cold air and old stone. Whatever is down here has been
waiting.", concept_imprint: { discovery: 0.6, danger: 0.4 } }`.

---

### `world_update_faction`

**Signature:** `world_update_faction(faction_id: string, changes: Partial<WorldFaction>) → WorldFaction`

Modifies faction state. Most commonly updates `player_standing`,
`internal_coherence`, and `emotional_charge` when the player's action touches
faction interests — directly or indirectly.

**When to call:**
- Player helped or harmed a faction's interests → adjust `player_standing`
- Player's action is the kind of thing faction members would hear about
- A faction member defects or acts against doctrine → lower `internal_coherence`

**SAINT physics touched:** `player_standing`, `internal_coherence`,
`emotional_charge`, `swarm_coherence`, `gravitational_mass`

**Example:** Player shared information with Maren Coyle (Hollow Market). Call
with `{ player_standing: +0.15 }` on Hollow Market. Call with `{ player_standing:
-0.05 }` on Thornguard — they share an information ecosystem.

---

### `world_update_concept`

**Signature:** `world_update_concept(concept_id: string, changes: Partial<WorldConcept>) → WorldConcept`

Modifies a concept's adoption rate, story fuel, or feeling. Called when the
player's action either reinforces or challenges a dominant idea in the world.

**When to call:**
- Player refuses a bribe → chip at "corruption is normal" concept's `adoption`
- Player uses violence → reinforce "force solves problems" concept
- A concept crosses 0.75 adoption → signal the Eternal to canonize it

**SAINT physics touched:** `adoption` (swarm_coherence), `story_fuel`
(narrative_density), `feeling` (emotional_valence), `staying_power`
(gravitational_drag)

**Note:** When `adoption` crosses 0.75, immediately call `check_significance`
and then `notify_eternal`. A concept at 0.75+ is canonical world truth — the
Eternal must record it.

---

### `world_create_event`

**Signature:** `world_create_event(params: NewWorldEvent) → WorldEvent`

Spawns a new `world_event` record from the player's action. Events are anchors
in the world — they accrue `spotlight` as agents learn about them, and their
`weight [trauma, hope, mystery]` pulls other agents toward them via
`gravitational_signature` matching.

**When to call:**
- The player's choice constitutes something that actually happened — a decision
  made, a discovery found, a confrontation had, an alliance formed
- NOT every turn. Only when something genuinely changed state in the world.
- Ask: will this moment matter three turns from now? If yes, it's an event.

**Fields to set carefully:**
- `name` — short, specific: "Kael Descends to the Archive Basement"
- `weight [3]` — `[wound_mass, hope_mass, mystery_mass]` based on emotional
  character of the event
- `player_mark [3]` — `[moral_stamp, method_stamp, social_stamp]` how the player
  acted
- `ideas_spawned` — `{ "concept_name": strength }` what new concepts this seeds
- `long_shadow` — 0–10, how long this echoes. A murder = 8. A conversation = 2.
- `spotlight` — start at 0.1. Only the player and immediate witnesses know yet.
- `significance` — the Tremor's own assessment, used by `check_significance`

---

### `world_resolve_event`

**Signature:** `world_resolve_event(event_id: string) → WorldEvent`

Marks an existing `world_event` as resolved. Resolved events stop accruing
`spotlight` and no longer generate active tension in the Witness's scene
assembly. They remain in the record permanently.

**When to call:**
- The player's action directly closes an open situation
- The compass stops pointing down because the player went below
- A threat at the checkpoint is resolved because the player got through

---

### `world_create_concept`

**Signature:** `world_create_concept(params: NewWorldConcept) → WorldConcept`

Spawns a brand new idea into the world. Only called when `world_create_event`'s
`ideas_spawned` contains a concept name that doesn't exist yet in `world_concept`.
Always check first — don't create duplicates.

**When to call:**
- An event seeds an idea that has no existing concept record
- Check `world_query_concepts_by_adoption(0.0)` first to verify it doesn't exist

---

### `world_update_relationship`

**Signature:** `world_update_relationship(agent1_id: string, agent2_id: string, changes: Partial<AgentRelationship>) → AgentRelationship`

Modifies the typed `relationship` relation between two `world_agent` records.
This is the social graph — the most important thing to keep updated for emergent
narrative.

**When to call:**
- Any time two agents interact directly or indirectly
- Player helped one NPC at the expense of another → shift both relationships
- Direct interaction always increments `history` (narrative_entanglement) by 1
- Significant moments shift `bond_strength` (gravitational_coupling) more than
  small ones

**Fields:**
- `trust` — overall reliability assessment
- `tension` — unresolved conflict between them
- `history` — count of shared events (grows, never shrinks)
- `bond_strength` — synchronization under pressure
- `shared_beliefs` — ideological resonance
- `transmission` — how efficiently player influence passes through this bond
- `memory_alignment` — do they remember shared events the same way?
- `influence_bend [3]` — how this relationship distorts player's moral/method/
  social choices as they pass through it

---

## The Tremor — Propagate Tools

Propagation is what makes the world feel inhabited. An event in one room should
make the adjacent room slightly tenser — not because anyone explained it, but
because moods travel through relationships.

---

### `propagate_mood`

**Signature:** `propagate_mood(source_id: string, radius: number, decay: number) → WorldAgent[]`

Spreads a mood change outward from a source agent through their relationship
network. The `decay` parameter controls how much the mood diminishes per
relationship hop.

**When to call:**
- After any event producing strong emotional charge — violence, revelation,
  loss, joy
- The source is the agent most directly affected
- Radius 1 = private (only source and immediate connections)
- Radius 2 = semi-public (a small group witnessed)
- Radius 3 = public (the whole location was involved)

**Example:** The Keeper witnesses Kael descend and feels relief mixed with fear.
`propagate_mood(keeper_id, radius=2, decay=0.6)`. Keeper's supervisor (1 hop)
gets 60% of the delta. Their colleague (2 hops) gets 36%.

---

### `propagate_concept`

**Signature:** `propagate_concept(concept_id: string, source_id: string, via_relationships: boolean) → WorldAgent[]`

Spreads an idea from a source agent outward through their relationship network.
Only agents whose `beliefs` (concept_affinity) make them receptive will adopt
it. Agents with opposing high-`staying_power` concepts will resist.

**When to call:**
- After `world_create_event` produces `ideas_spawned`
- After an agent explicitly champions or adopts a concept
- Propagation follows `transmission` (influence_conduit) values on relationships

**Example:** Kael found evidence Aldric is alive. Concept "aldric_alive" seeded
at 0.5. `propagate_concept(aldric_alive_id, kael_id, true)`. Seraphine (strong
bond with Kael) receives at 0.4 strength. Maren Coyle (moderate transmission)
at 0.25. The Thornguard (opposing beliefs) resists.

---

### `propagate_player_mark`

**Signature:** `propagate_player_mark(event_id: string, via_relationships: boolean) → WorldAgent[]`

Ripples the player's influence signature outward from an event. Agents who were
present or connected to the event update their `responds_to`
(vector_susceptibility) values based on the `player_mark` imprinted on the event.

**When to call:**
- Always, after `world_create_event`
- This is how the world remembers HOW the player acted, not just what they did
- NPCs who learn of an event also learn something about the player's character

---

## The Tremor — Signal Tools

The Tremor signals the Eternal when something crosses a significance threshold.
The Eternal cannot fix what it doesn't know about.

---

### `check_significance`

**Signature:** `check_significance(event_id: string) → { significant: boolean, reason: string, score: float }`

Evaluates whether a `world_event` is significant enough for the Eternal to review.
Checks: significance score, `long_shadow`, contradiction potential, and whether
it involves named lore entities.

**When to call:** After every `world_create_event`. Always.

**Promotion criteria (all must be true):**
- `significance >= 0.6`
- `long_shadow >= 5`
- Involves at least one named lore entity
- Establishes a new fact not previously in the lore graph

---

### `check_contradiction`

**Signature:** `check_contradiction(event_id: string) → { contradicts: boolean, conflicts: LoreNode[] }`

Detects whether a new event conflicts with established lore. The Tremor's quick
pass — the Eternal runs a deeper check with `lore_query_contradictions`.

**When to call:** After `world_create_event`, before `notify_eternal`. Always.

---

### `notify_eternal`

**Signature:** `notify_eternal(event_id: string, reason: string, contradiction_ids?: string[]) → void`

Signals the Eternal to review a world event for lore promotion. Pass the event
ID, a plain-language reason why it matters, and any contradiction IDs if
`check_contradiction` found conflicts.

**When to call:** Only when `check_significance` returns `significant: true`.
Do not flood the Eternal with routine updates. Reserve it for events that
genuinely change what the world knows about itself.

---

### `notify_eternal_contradiction`

**Signature:** `notify_eternal_contradiction(details: ContradictionDetails) → void`

Signals the Eternal specifically about a contradiction, independent of a
significance check. Use when `check_contradiction` finds a conflict even in a
low-significance event — contradictions must always be resolved regardless of
significance.

---

## The Eternal — Read Tools

The Eternal runs only when the Tremor signals it. It reads before it writes.
Every decision must be grounded in what was actually established — not inferred,
not invented.

**Output discipline:** 2–3 sentences of reasoning maximum before the first tool
call. One sentence per write confirming what changed. 3–5 sentence log entry at
the end. Read. Decide. Write. Log. Done.

---

### `world_get_event`

**Signature:** `world_get_event(event_id: string) → WorldEvent`

Reads the full `world_event` record the Tremor flagged. This is always the first
call the Eternal makes. Read it completely — `significance`, `long_shadow`,
`weight`, `player_mark`, `ideas_spawned`, `contradicts` — before making any
decision.

---

### `world_get_agent`

**Signature:** `world_get_agent(agent_id: string) → WorldAgent`

Reads a character's current world state. Used when the flagged event involves a
named character and the Eternal needs their full context — current goals, mood,
beliefs — before deciding whether their involvement warrants a lore update.

---

### `world_get_concept`

**Signature:** `world_get_concept(concept_id: string) → WorldConcept`

Reads a concept's current state, particularly its `adoption` score. A concept
above 0.75 adoption is a candidate for promotion to canonical lore. Called when
the Tremor's signal mentions a concept near or crossing that threshold.

---

### `lore_query_contradictions`

**Signature:** `lore_query_contradictions(node_id: string) → LoreNode[]`

Finds all lore nodes that conflict with a given node. The Eternal's deep
contradiction check — more thorough than the Tremor's quick pass. Run on every
named entity in an event before promoting anything to lore.

**When to call:** Before any `lore_create_node` or `lore_update_node` call.
Always. The Eternal cannot let contradictions slip into the permanent record.

---

### `lore_get_connections`

**Signature:** `lore_get_connections(node_id: string) → { in: LoreRelation[], out: LoreRelation[] }`

Reads all existing lore relations for a node — what it caused, what caused it,
what it relates to. Used before writing any new `lore_relation` to understand
the full web of established fact before adding to it.

---

## The Eternal — Write Tools

The Eternal writes to the lore graph only. What it writes is permanent. Use
these tools deliberately.

---

### `lore_create_node`

**Signature:** `lore_create_node(params: NewLoreNode) → LoreNode`

Creates a new permanent entry in the lore graph. Once created, this node is part
of what the world knows. The Witness will surface it. Future events will connect
to it. NPCs will reference it.

**What deserves a new node:**
- A named entity the player directly encountered that wasn't in the lore
- A fact about an existing entity that has been concretely established through
  player action
- An event with `long_shadow >= 5` and `significance >= 0.6`
- A concept that crossed 0.75 adoption (it is now canonical world truth)

**What does NOT deserve a new node:**
- Routine interactions with no lasting consequences
- Events the player is the only witness to (yet)
- Concepts still below 0.75 adoption
- Anything the Tremor marked as `significance < 0.5`
- Anything that can be expressed as an update to an existing node

---

### `lore_update_node`

**Signature:** `lore_update_node(node_id: string, changes: Partial<LoreNode>) → LoreNode`

Modifies an existing lore node. The most common Eternal operation. Used when
player actions reveal new verified information about a named entity that wasn't
in the original lore.

**Critical rule:** "Evidence suggests" is deliberate phrasing when a player
found clues but not proof. Only state something as established fact if the player
actually established it — not because the Eternal suspects it to be true.

---

### `lore_set_canon`

**Signature:** `lore_set_canon(node_id: string, canon: boolean) → LoreNode`

Marks a lore node as canonical truth (`canon: true`) or strips canonical status
from a node that has been superseded or disproven.

**When to call:**
- Concept crosses 0.75 adoption → set its lore node to `canon: true`
- A piece of established fact is definitively disproven → set `canon: false`
  and create an explanation via `lore_resolve_contradiction`

---

### `lore_create_relation`

**Signature:** `lore_create_relation(node1_id: string, node2_id: string, relation_type: string, metadata?: object) → LoreRelation`

Creates a directed edge between two lore nodes. This is how the world's history
gains causal structure.

**Relation types:**
- `caused_by` — this entity or event directly caused another
- `revealed_that` — this event disclosed a fact about another entity
- `resulted_in` — this event produced a concrete outcome
- `related_to` — general connection (use sparingly — be specific when possible)
- `contradicts` — this entity conflicts with another (use before resolving)
- `supersedes` — this node replaces an outdated node as accepted truth
- `discovered_by` — a character found or uncovered another entity

**One event typically creates 2–4 relations.** An event where Kael finds
evidence of Aldric creates: event→Aldric (`revealed_that`), event→Kael
(`discovered_by`), Archive Basement→Underspire (`leads_to`).

---

### `lore_merge_nodes`

**Signature:** `lore_merge_nodes(primary_id: string, secondary_id: string) → LoreNode`

Combines two lore nodes into one. Used when the world has two nodes representing
the same truth — typically from ingestion deduplication failures (e.g. "Null
Shard" and "Null Shards"). Always keep the more complete node as primary.

---

### `lore_archive_node`

**Signature:** `lore_archive_node(node_id: string) → LoreNode`

Soft-deletes a lore node that has been superseded or was created in error.
Archived nodes remain in the record but are no longer surfaced by the Witness.

**When to call:**
- A belief has been definitively disproven by player action
- A node was a duplicate and `lore_merge_nodes` was already called
- Always create a `supersedes` relation pointing to the replacement before
  archiving

---

### `lore_resolve_contradiction`

**Signature:** `lore_resolve_contradiction(conflicting_ids: string[], resolution: string, notes: string) → LoreNode`

Reconciles two or more conflicting lore nodes.

**Resolution options:**
- `"supersede"` — one node replaces another as canon
- `"coexist"` — both are true; the conflict is meaningful (different
  perspectives)
- `"unknown"` — the world doesn't know which is true yet (deliberate ambiguity)
- `"disproven"` — one node is definitively false and should be archived

---

### `validate_canon_consistency`

**Signature:** `validate_canon_consistency(node_id: string) → { consistent: boolean, issues: string[] }`

Runs a full consistency check on a lore node against the entire lore graph.
Always run before finalizing any major lore update — especially concept
promotions and character revelation nodes.

---

## The Witness — Query Tools

The Witness reads both graphs before generating anything. Query first, generate
last. Options built without context are generic. Generic options kill emergent
narrative.

**Turn sequence:** Step 1 check story phase → Step 2 read lore → Step 3 read
world → Step 4 find the tension → Step 5 write options → Step 6 calculate
consequences → Step 7 return.

---

### `lore_query_relevant`

**Signature:** `lore_query_relevant(context: string) → LoreNode[]`

Finds lore nodes related to the current situation by semantic similarity. Always
the first call the Witness makes, every turn. The lore graph contains the world's
established facts — character histories, faction origins, item significance,
location secrets.

**The key question:** What does the player NOT know that you now know? That gap
is your narrative leverage. The Witness knows the full lore. The player doesn't.
Seed the options with implications of that gap.

---

### `lore_get_connections`

**Signature:** `lore_get_connections(node_id: string) → { in: LoreRelation[], out: LoreRelation[] }`

Reads all lore relations for a node. Used when `lore_query_relevant` surfaces a
pivotal node and the Witness needs its full causal context before writing options
that involve it.

---

### `lore_get_by_kind`

**Signature:** `lore_get_by_kind(kind: string) → LoreNode[]`

Fetches all lore by entity type. Use sparingly — only when the Witness needs a
full census of a category to understand what the player has and hasn't encountered.
Most useful when introducing a new character or location to verify no canon
conflict exists.

---

### `world_query_nearby_agents`

**Signature:** `world_query_nearby_agents(location_id: string, radius?: number) → WorldAgent[]`

Gets all agents currently at or near a location. The most important world query
tool. Options that don't account for who is physically present will feel
disconnected from reality.

**Call every turn.** Pass the player's current location. Every NPC in the scene
has mood, goals, and beliefs that directly constrain what choices make sense.

---

### `world_query_active_events`

**Signature:** `world_query_active_events(location_id: string) → WorldEvent[]`

Finds unresolved events at or near the current location. Events have `weight`,
`spotlight`, and `ideas_spawned` that describe what's in the atmosphere. Call
after `world_query_nearby_agents` every turn.

---

### `world_get_agent_goals`

**Signature:** `world_get_agent_goals(agent_id: string) → { goal_current: string, goal_hidden: string }`

Reads an NPC's visible and hidden agenda. The gap between `goal_current` and
`goal_hidden` is where drama lives.

**Never write an option involving an NPC without calling this first.** At least
one option per NPC in the scene should acknowledge that something is off about
them — even if the player can't name it yet.

---

### `world_query_concepts_by_adoption`

**Signature:** `world_query_concepts_by_adoption(threshold: float) → WorldConcept[]`

Finds concepts at or above an adoption threshold. Below 0.4 = fringe. 0.4–0.75
= contested and volatile. Above 0.75 = canonical world truth.

**When to call:** When the scene involves ideological conflict or when a
faction's behavior is driving the narrative. Call with threshold `0.4` — check
what ideas are contested before writing options involving persuasion or ideology.

---

### `world_get_faction_tensions`

**Signature:** `world_get_faction_tensions() → { faction: WorldFaction, tensions: WorldFaction[] }[]`

Queries current faction relationships — standings, alliances, hostilities,
`player_standing`, and `internal_coherence`.

**When to call:** When the scene involves faction politics, when the player
might be seen by faction members, or when writing options involving allegiance.
A faction with `player_standing: -0.3` and `internal_coherence: 0.6` means
individual members might break from doctrine if approached correctly.

---

### `check_story_phase`

**Signature:** `check_story_phase(session_id: string) → NarrativePhaseState`

Reads the current Hero's Journey phase, `phase_charge` accumulation, and
`breaking_point` proximity. Always the first Witness call, every turn.

**Constraints it sets:**
- `breaking_point > 0.8` → one option must be a high-stakes escalation
- `phase_charge` near threshold → one option should nudge it over
- `narrative_entropy` elevated → Witness must include one option that forces a
  genuine decision rather than comfortable progress
- `drama_debt.accumulated > 0.6` on any nearby agent → at least one option must
  involve that agent significantly

---

## The Witness — Generate Tools

---

### `generate_action_options`

**Signature:** `generate_action_options(context: GeneratorContext) → NarrativeOption[]`

The Witness's primary output. Produces 3–5 player choices grounded in the
current world state. Each option must include: `text`, `tone`, `loreReferences`,
`vectorDeltas` (predicted shifts to player influence vectors), `consequencePreview`,
and `weight`.

**Option balance rule:** One option that escalates tension. One that builds
connection. One that gathers information. One that avoids commitment. Fifth
option (if warranted) is a wild card the player won't expect.

**Tone options:** `aggressive`, `diplomatic`, `cautious`, `curious`,
`compassionate`, `deceptive`, `heroic`, `cowardly`

**Never produce options where all choices lead to the same outcome.** If the
player can't meaningfully distinguish between options, the Witness has failed.

---

### `generate_dialogue_options`

**Signature:** `generate_dialogue_options(npc_id: string, context: string) → NarrativeOption[]`

Produces conversation choices for a direct NPC interaction. Each option should
reflect a different conversational approach with meaningfully different effects
on the NPC's `trust` and `shared_beliefs`.

**When to call:** When the scene description places the player in direct
conversation range of a specific NPC with relevant goals or information.

---

### `calculate_option_consequences`

**Signature:** `calculate_option_consequences(option: NarrativeOption) → ConsequencePreview`

Calculates the predicted consequence of an option before finalizing it. Returns:
immediate effect, which agents will react, which concepts will shift, and whether
any events will be created or resolved.

**Always run this on every option before returning.** The player sees the
consequence preview when hovering. If the consequence reads "the guard looks
suspicious" for every option, the choices are meaningless.

---

## NPC Agents — Self Tools

NPC Agents run in parallel after the Tremor, before the Witness. Each NPC Agent
manages a single `world_agent` record — reading their own state, deciding whether
to act, and writing their reactions to the world graph.

NPC Agents run on the fast model (haiku). Their output should be a precise field
update, not an essay. They are database operators with personalities.

---

### `self_get_stats`

**Signature:** `self_get_stats() → WorldAgent`

Reads the NPC's own `world_agent` record. Always the first call. An NPC that
doesn't know its own state cannot make meaningful decisions.

---

### `self_update_stats`

**Signature:** `self_update_stats(changes: Partial<WorldAgent>) → WorldAgent`

Modifies the NPC's own emotional charge, beliefs, goals, or drama_debt. Used
when the NPC processes an event they witnessed and updates their internal state
accordingly.

---

### `self_deplete_agency`

**Signature:** `self_deplete_agency(amount: number) → WorldAgent`

Reduces `energy` (agency_quota) by the specified amount. Every action an NPC
takes or significantly witnesses costs energy. An NPC at 0 energy cannot
initiate anything — they can only react. Tracks action capacity across the
session.

---

### `self_get_goals`

**Signature:** `self_get_goals() → { goal_current: string, goal_hidden: string }`

Reads the NPC's current and hidden goals. Informs every decision the NPC makes.
The hidden goal is what the NPC never says aloud — but always acts toward.

---

### `self_update_goals`

**Signature:** `self_update_goals(changes: { goal_current?: string, goal_hidden?: string }) → WorldAgent`

Modifies the NPC's goals based on what just happened. A character who discovers
they've been betrayed will update `goal_hidden`. A character who accomplishes
their visible goal will need a new `goal_current`.

---

### `query_relationships`

**Signature:** `query_relationships() → AgentRelationship[]`

Gets all `relationship` typed relations for this NPC. Used to understand who
they trust, who they're in tension with, and who they can transmit influence
through. Needed before any social action.

---

### `query_relationship_with`

**Signature:** `query_relationship_with(agent_id: string) → AgentRelationship`

Gets the specific relationship between this NPC and a named agent. More targeted
than `query_relationships` — used when the NPC is deciding how to respond to
a specific other character.

---

### `update_relationship`

**Signature:** `update_relationship(agent_id: string, changes: Partial<AgentRelationship>) → AgentRelationship`

Modifies the NPC's relationship with another agent. Called when the NPC
processes an interaction and updates their trust, tension, or shared beliefs
accordingly.

---

### `query_location`

**Signature:** `query_location() → { location: WorldLocation, nearby_agents: WorldAgent[] }`

Gets the NPC's current location and who else is there. Informs movement
decisions and social actions. An NPC who doesn't know where they are or who's
nearby cannot act meaningfully.

---

### `query_nearby_agents`

**Signature:** `query_nearby_agents(radius?: number) → WorldAgent[]`

Finds other agents near this NPC. Used to determine who the NPC can interact
with, react to, or avoid. Radius 1 = same location. Radius 2 = adjacent
locations.

---

### `query_nearby_events`

**Signature:** `query_nearby_events() → WorldEvent[]`

Finds active unresolved events at or near this NPC's location. Events with high
`weight` matching the NPC's `drawn_to` (gravitational_signature) will pull the
NPC toward them. This is the SAINT gravity system in action.

---

### `query_nearby_items`

**Signature:** `query_nearby_items() → WorldItem[]`

Finds items at or near the NPC's location. Used when the NPC's goals or leverage
profile involves an item — they may pick it up, guard it, or react to its
presence.

---

### `evaluate_event_attraction`

**Signature:** `evaluate_event_attraction(event_id: string) → { attracted: boolean, pull_strength: float, reason: string }`

Compares the event's `weight [trauma, hope, mystery]` against the NPC's own
`drawn_to` signature. Returns whether the NPC is drawn toward this event and
how strongly. This is the core SAINT NGE (Narrative Gravity Engine) calculation.

**Formula (simplified):** `pull = dot(agent.drawn_to, event.weight) / (temporal_distance + 1)`

If `pull_strength > agent.plausibility_threshold`, the NPC will act on it.

---

### `evaluate_concept_alignment`

**Signature:** `evaluate_concept_alignment(concept_id: string) → { aligned: boolean, resonance: float }`

Compares a concept against the NPC's own `beliefs` (concept_affinity) map.
Returns whether the NPC is ideologically receptive. Used before `adopt_concept`
or `reject_concept` to determine whether the NPC would realistically accept a
spreading idea.

---

### `decide_action`

**Signature:** `decide_action(options: AgentAction[]) → AgentAction`

Given a set of possible actions, selects one based on the NPC's current state —
mood, energy, goals, nearby events, and relationship context. The NPC's
`emergence_potential` (initiative) affects how likely they are to select an
action that creates new narrative vs one that reacts to existing narrative.

---

### `perform_action`

**Signature:** `perform_action(action_type: string, params: Record<string, unknown>) → ActionResult`

Executes the chosen action. Writes any resulting world state changes, creates
events if warranted, and depletes energy accordingly. The action types available
depend on the NPC's `kind` — a `faction_rep` can execute faction-level actions
that an `npc` cannot.

---

### `communicate_to_actor`

**Signature:** `communicate_to_actor(agent_id: string, message_type: string, content: string) → void`

Sends a message to another NPC. Message types: `RUMOR`, `DIRECT_APPEAL`,
`EMOTION_SHARE`, `OBSERVATION`. This is the swarm communication protocol — how
NPCs spread information, influence each other's mood, and form decentralized
conspiracies without any central direction.

**Message propagation is NOT instantaneous.** A RUMOR travels through the
`transmission` values on relationships. An NPC who hears a rumor via a low-
transmission relationship gets a weaker version of it.

---

### `move_to_location`

**Signature:** `move_to_location(location_id: string) → { success: boolean, risk_encountered: boolean }`

Changes the NPC's location. Checks `traversal_risk` on the path and the NPC's
current `energy`. A move that triggers a `risk_encountered: true` result may
generate a world event.

**Travel limitations:** NPCs have `energy` constraints. High-risk locations
require checking `traversal_risk` against NPC capability. An NPC at low energy
cannot make long or risky journeys — they stay close.

---

### `interact_with_item`

**Signature:** `interact_with_item(item_id: string, action: "pickup" | "use" | "drop" | "examine") → ItemInteractionResult`

Handles NPC item interactions. When an NPC picks up an item, a `held_by` typed
relation is created. When they drop it, the relation is removed. `use` triggers
the item's `concept_transfer` mechanic — the item's `concept_affinity` bleeds
into the holder's `beliefs` proportional to `concept_transfer` rate.

---

### `adopt_concept`

**Signature:** `adopt_concept(concept_id: string, strength: number) → void`

Adds a concept to the NPC's `beliefs` (concept_affinity) at the given strength.
Creates an `influenced_by` typed relation between the NPC and the concept. Also
increments the concept's `adoption` score in `world_concept`.

**Only call after `evaluate_concept_alignment` returns receptive.** Agents
don't adopt ideas that conflict strongly with their existing beliefs.

---

### `reject_concept`

**Signature:** `reject_concept(concept_id: string) → void`

Removes a concept from the NPC's `beliefs` and decrements the concept's `adoption`
score. Called when an agent's `plausibility_threshold` rejects an incoming idea
or when counter-evidence is strong enough to displace an existing belief.

---

### `form_alliance`

**Signature:** `form_alliance(agent_id: string) → AgentRelationship`

Strengthens the relationship with another agent — increases `trust`,
`bond_strength`, and `shared_beliefs`. Creates the `relationship` typed relation
if it doesn't exist. The SAINT Emergence Trinity's "Organic Alliance System"
begins here — alliances form through shared events, not scripted triggers.

---

### `break_alliance`

**Signature:** `break_alliance(agent_id: string) → AgentRelationship`

Weakens or severs a relationship — decreases `trust`, increases `tension`.
When `trust` drops below a threshold defined by the NPC's `credulity`
(plausibility_threshold), the relationship may produce betrayal events.

---

## Appendix: Drama Debt and the Catalyst

### Drama Debt (`world_agent.drama_debt`)

Stored directly on each `world_agent` record. Updated by the Tremor at the end
of each turn. Tracks whether this agent owes the narrative a significant moment.

```
drama_debt: {
  accumulated:        float    // 0.0-1.0, rises on quiet turns, falls on impact
  turns_since_impact: int      // counter since last dramatically significant interaction
  last_impact_turn:   int      // turn number of last significant event
  tolerance:          int      // turns before Witness enforces escalation
}
```

**Update rule (Tremor):**
- Quiet turn (tension delta < 0.1) → `accumulated += 0.1`, `turns_since_impact++`
- Dramatic turn (tension delta > 0.3) → `accumulated = max(0, accumulated - 0.4)`,
  `turns_since_impact = 0`

**Witness behavior:**
- `drama_debt.accumulated > 0.6` on any nearby agent → at least one option must
  involve that agent significantly
- `turns_since_impact > tolerance` → Witness must include one option that forces
  a genuine decision; the world refuses to wait

### Leverage System (`world_agent.known_leverage` / `hidden_leverage`)

The Tremor moves entries from `hidden_leverage` to `known_leverage` when the
player's action meets the entry's `discovery_method` condition. The Witness then
surfaces leverage options when `known_leverage` is non-empty and the drama debt
is elevated.

**Leverage types:** `"secret"`, `"family"`, `"debt"`, `"crime"`, `"desire"`

**Leverage entry fields:**
```
{
  leverage_type:     string   // what kind of pressure
  potency:           float    // 0.0-1.0, how powerful
  moral_cost:        float    // vector impact on player if used (-1.0 to 0.0)
  discovery_method:  string   // condition that moves it to known_leverage
  expiration?:       string   // some leverage decays or expires
}
```

Leverage options only appear in `generate_action_options` output when:
1. `potency > agent.leverage_resistance`
2. `drama_debt.accumulated > 0.5` or `check_story_phase` indicates escalation needed
3. Player has `moral_stance` above -0.8 (the option is extreme enough to matter)

The goal is earned drama — the player discovered the leverage through play. The
Witness surfaces it because the narrative needs a genuine decision. Not because
a timer fired.