# ACE System - Agentic Context Engineering for The SAINT Framework

## Flow Diagram
### Player choose an option and takes action --> Reflector's change the world based on that action --> Curator updates lore graph while agents react to the changes --> Generator creates new options for the player to choose from after reading the lore graph state. 
┌─────────────────────────────────────────────────────────────────────────┐
│                            PLAYER ACTION                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              REFLECTOR                                  │
│  • Updates world_actor, world_event, world_concept                      │
│  • Propagates emotional_charge + concepts                               │
│  • Calculates significance + coherence_stress                           │
│  • Notifies Curator if threshold met                                    │
└─────────────────────────────────────────────────────────────────────────┘
           │                                           │
           │ notify_curator()                          │ world changes
           ▼                                           ▼
┌─────────────────────────┐               ┌───────────────────────────────┐
│        CURATOR          │               │         NPC AGENTS            │
│  • Reads world event    │               │  • React to nearby events     │
│  • Creates lore_node    │               │  • Update own stats           │
│  • Resolves conflicts   │               │  • Communicate with others    │
│  • Maintains canon      │               │  • Adopt/reject concepts      │
└─────────────────────────┘               └───────────────────────────────┘
           │                                           │
           │ lore updated                              │ world state changed
           ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              GENERATOR                                  │
│  • Reads lore for context                                               │
│  • Reads world state                                                    │
│  • Generates player options                                             │
│  • Presents choices to player                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            [PLAYER CHOOSES]
                                    │
                                    └──────────► (loop back to Reflector)


## Stat Reference

# SAINT Framework — Stat Reference

All stats use human-readable names in code comments and agent prompts.
Schema field names remain unchanged for database consistency.

---

## Agent Stats
*Who this character is and how they move through the world.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `narrative_weight` | **story_weight** | How central is this character to the current story? High = the story bends toward them. Low = they are background. |
| `gravitational_signature` | **drawn_to [3]** | What kinds of events pull at them? Three values: [wounds, hope, mysteries]. A traumatized character scores high on wounds. A dreamer scores high on hope. |
| `emotional_charge` | **mood** | How are they feeling right now? -1.0 = despair, 0.0 = neutral, 1.0 = elated. Mood is contagious — it spreads to nearby characters through relationships. |
| `influence_resonance` | **player_pull** | How strongly does the player's behavior affect this character? High = easily shaped by what the player does. Low = largely indifferent to the player's presence. |
| `vector_susceptibility` | **responds_to [3]** | What kinds of player choices land hardest on them? Three values: [moral choices, method choices, social choices]. |
| `concept_affinity` | **beliefs** | What ideas does this character care about? +0.8 on "revenge" means they champion it. -0.5 on "mercy" means they resist it. The map of their ideology. |
| `plausibility_threshold` | **credulity** | How easily do they accept surprising events? Low = skeptical, hard to convince. High = believes almost anything if it fits their worldview. |
| `coherence_contribution` | **peacemaker** | Do they tend to resolve conflict or let it stand? High = they try to make sense of contradictions. Low = they let chaos be chaos. |
| `agency_quota` | **energy** | How much can they do today? Depletes as they act or witness significant events. Resets each session. An NPC at 0 energy cannot initiate anything. |
| `emergence_potential` | **initiative** | How likely are they to start something new on their own? High = they create drama unprompted. Low = they react to the drama others create. |
| `temporal_focus` | **time_horizon** | Are they living in the past or planning for the future? 0.0 = haunted by history. 1.0 = focused entirely on what's coming. |

---

## Relationship Stats
*What exists between two characters.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `conceptual_resonance` | **shared_beliefs** | How much do they agree on the big ideas? High = ideological allies who reinforce each other. Low = fundamentally incompatible worldviews. |
| `narrative_entanglement` | **history** | How much have they been through together? Grows by 1 with every shared event. High history predicts whether they will act together under pressure. |
| `influence_conduit` | **transmission** | How efficiently does the player's influence pass through this relationship? High = one conversation with a friend changes how the friend's friend sees the player. |
| `gravitational_coupling` | **bond_strength** | How synchronized are they during big events? High = they move together, react together. Low = they scatter under pressure and pursue separate agendas. |
| `temporal_sync` | **memory_alignment** | Do they remember shared events the same way? Low = their accounts of the same moment contradict each other. High = consistent, mutually reinforcing histories. |
| `vector_refraction` | **influence_bend [3]** | How much does this relationship distort the player's choices as they pass through it? [moral bend, method bend, social bend]. A cynical mentor bends a moral choice into something harder. |
| `plausibility_anchor` | **reality_check** | Does this relationship keep both parties grounded in the same version of reality? High = they reinforce each other's perception of what is true. Low = they drift into incompatible realities. |

---

## Event Stats
*What happened and how much it matters.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `gravitational_mass` | **weight [3]** | How heavy is this event emotionally? Three values: [wounds it caused, hope it sparked, mystery it left behind]. Heavy events pull nearby characters toward them. |
| `swarm_attention` | **spotlight** | What fraction of characters are currently focused on this event? High = everyone is talking about it. Low = only the people who were there know. |
| `coherence_stress` | **contradiction** | How much does this event strain the world's internal logic? High = the story needs to explain itself before moving on. |
| `plausibility_decay` | **fade_rate** | How quickly does this event lose its believability in memory? High = it gets distorted fast as time passes. Low = it stays sharp and clear. |
| `vector_imprint` | **player_mark [3]** | The signature the player left on this event. Three values: [moral stamp, method stamp, social stamp]. Readable by future agents — this is how the world remembers how the player acted, not just what they did. |
| `concept_seeding` | **ideas_spawned** | What new ideas did this event plant in the world? e.g. `{"betrayal": 0.8}` means betrayal is now in the air — agents nearby will start adopting it. |
| `temporal_ripple` | **long_shadow** | How far into the future will this event echo? 0 = forgotten quickly. 10 = shapes events for the rest of the game. |
| `phase_charge` | **story_progress** | How much does this event push the story toward its next major turn? Accumulates until the story shifts to the next phase. |
| `significance` | **significance** | Overall importance score. Used by the Tremor and the Eternal to decide whether an event deserves to become permanent lore. |

---

## Concept Stats
*Ideas that spread through the world like a virus.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `emotional_valence` | **feeling** | Is this idea dark or hopeful? -1.0 = deeply troubling. 0.0 = neutral. 1.0 = genuinely uplifting. Affects the mood of every character who adopts it. |
| `narrative_density` | **story_fuel** | How much drama does this idea generate on its own? High = rich source of conflict, betrayal, revelation. Low = a background detail that rarely drives action. |
| `vector_amplification` | **amplifies [3]** | Does this idea make the player's choices hit harder? Three multipliers: [moral choices, method choices, social choices]. A concept like "power corrupts" amplifies moral choices. |
| `gravitational_drag` | **staying_power** | How hard is this idea to displace once it takes hold? High = deeply entrenched, resists counter-narratives. Low = fragile, easily replaced by a stronger idea. |
| `plausibility_anchor` | **common_sense** | Does this idea reinforce the world's logic? High = it feels obviously true to everyone who hears it. Low = it challenges accepted reality and invites contradiction. |
| `mutation_rate` | **drift** | How much does this idea change as it spreads from person to person? High = it evolves into something different with each telling. Low = stable and consistent across the swarm. |
| `swarm_coherence` | **adoption** | What fraction of characters have accepted this idea? Below 0.4 = fringe. 0.4–0.75 = contested and volatile. Above 0.75 = the world's accepted truth. |

---

## Player Influence Vectors
*The player's footprint in the world — how their choices accumulate into a signature.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `moral_polarity` | **moral_stance** | Are the player's choices trending merciful or ruthless? -1.0 = consistent mercy and compassion. 1.0 = consistent ruthlessness and self-interest. NPCs read this and adjust their behavior. |
| `method_intensity` | **approach** | Do they talk their way through things or force their way? 0.0 = always diplomacy and persuasion. 1.0 = always force and violence. |
| `social_focus` | **scale** | Do they act for themselves or for the group? 0.0 = purely personal gain. 1.0 = collective benefit. Shapes how factions perceive the player's alignment. |
| `temporal_reach` | **foresight** | How far ahead do their choices ripple? 0 = only immediate effects. 10 = choices that echo for the entire game. |
| `gravitational_distortion` | **pull_on_world [3]** | How is the player shifting the emotional atmosphere of the world? Three values: [wounds they're adding, hope they're adding, mystery they're adding]. |
| `concept_resonance` | **idea_amplification** | Which ideas does the player's presence make stronger? Concepts they interact with spread faster through the swarm. |
| `coherence_impact` | **stability_effect** | Does the player stabilize or destabilize the world's internal logic? Positive = their choices make the world feel more coherent. Negative = their choices create contradictions that need resolution. |

---

## Narrative Gravity System Stats
*The engine's global state — what the world feels like as a whole right now.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `event_horizon_radius` | **point_of_no_return** | How close is the story to a moment characters cannot avoid? When high, everything converges on one unavoidable crisis. |
| `spaghettification_factor` | **pull_conflict** | How many competing events are pulling characters in different directions at once? High = everyone is stretched thin, unable to fully commit to anything. |
| `temporal_dilation` | **story_pace** | Is the story accelerating or slowing? Below 1.0 = events feel compressed and urgent. Above 1.0 = breathing room, slower accumulation. |
| `singularity_threshold` | **breaking_point** | How close is the world to a major irreversible story shift? At 1.0 something big and permanent happens — a phase transition, a revelation, a point of no return. |
| `gravitational_lensing` | **event_distortion** | Are nearby events warping each other's meaning? High = one major crisis makes every other event feel connected to it, even tangentially. |
| `swarm_consciousness` | **world_awareness** | How much do characters collectively sense that something significant is happening? High = the whole world feels the tension, even those not directly involved. |

---

## Faction Stats
*Swarm dynamics for organizations and groups.*

| Schema Field | Human Name | Plain English |
|---|---|---|
| `narrative_weight` | **story_weight** | How central is this faction to the current story? Same as agent story_weight, but for organizations. |
| `gravitational_mass` | **weight [3]** | What emotional pull does this faction exert on events? [trauma they carry, hope they represent, mystery they hold]. |
| `emotional_charge` | **mood** | The faction's collective emotional state. Spreads to member agents and affects recruitment. |
| `swarm_coherence` | **unity** | How ideologically unified is the faction right now? High = monolithic and disciplined. Low = fractured, members pursuing conflicting agendas. |
| `concept_affinity` | **champions** | List of concepts this faction actively promotes and defends. |
| `concept_orthodoxy` | **rigidity** | How strictly does the faction enforce ideological conformity? High = members who deviate are punished. Low = the faction tolerates internal dissent. |
| `concept_propagation_rate` | **spread_rate** | How aggressively does this faction push its ideas onto others? High = active recruitment and propaganda. Low = keeps its beliefs internal. |
| `internal_coherence` | **solidarity** | How well do faction members hold together under pressure? Different from unity — solidarity is about loyalty under stress, not ideological agreement. |
| `vector_doctrine` | **doctrine** | The faction's official stance on [moral choices, method choices, social choices]. Shapes how members respond to the player's approach. |
| `vector_enforcement` | **enforcement** | How hard does the faction push members to conform to its doctrine? High = strong consequences for deviating from faction values. |
| `player_standing` | **reputation** | How does this faction currently view the player? -1.0 = enemy. 0.0 = unknown or neutral. 1.0 = trusted ally. |
| `player_perceived_alignment` | **perceived_alignment** | Does the faction think the player shares their values? Independent of reputation — a faction can distrust someone they think agrees with them. |