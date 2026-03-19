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

### WorldEvent
| Field | Emergent Behavior |
| --- | --- |
| gravitational_mass | Pulls agents with matching gravitational_signature toward this event |
| swarm_attention | Limits other events when many agents focus here |
| coherence_stress | Triggers Coherence Engine when > 0.7 |
| vector_imprint | Ripples through relationships via influence_conduit |
| concept_seeding | Spawns/strengthens world_concept entries |
| temporal_ripple | High values (7+) affect future generations |
| phase_charge | Accumulates toward hero's journey phase transitions |
| significance | When > 0.7 + resolved, Curator promotes to lore_node |

### WorldConcept
| Field | Emergent Behavior |
| --- | --- |
| emotional_valence | Modifies emotional_charge of adopting agents |
| narrative_density | High values spawn more events related to this concept |
| vector_amplification | Multiplies player influence when concept is dominant |
| swarm_coherence | At > 0.75, becomes canonical truth / dominant ideology |
| mutation_rate | Spawns child concepts over time |
| gravitational_drag | Resists being displaced by competing concepts |
| opposes | Creates conflict when agents hold opposing concepts |