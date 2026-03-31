// src/agentic/game/chain/index.ts
//
// Barrel export for the entire chain system.

// Types
export * from "./types";

// Base
export { BaseChainLink } from "./base-chain-link";
export type { ChainLink } from "./base-chain-link";

// Executor
export { AgentChain } from "./agent-chain";

// Fan-in strategies
export {
    ConcatenatedFanIn,
    PriorityMergeFanIn,
    AgenticMergeFanIn,
} from "./fan-in-strategies";

// Links
export { HeraldLink } from "./links/herald-link";
export type { HeraldConfig } from "./links/herald-link";
export { TremorLink } from "./links/tremor-link";
export { ParallelTremorLink } from "./links/parallel-tremor-link";
export { NpcAgentsLink } from "./links/npc-agents-link";
export { EternalLink } from "./links/eternal-link";
export { WitnessLink } from "./links/witness-link";
export { ParallelWitnessLink } from "./links/parallel-witness-link";
export { ProseLink } from "./links/prose-link";
export { GenreAtmosphereLink } from "./links/genre-atmosphere-link";
