"use client";
// src/components/games/GeneralGame.tsx
//
// The game shell. Owns session state and drives the SAINT engine loop.
//
// SurrealProvider is NOT here — it wraps this component at the route level
// in play.tsx. Adding it here would create a second WS connection.
//
// What this component owns:
//   - Session lifecycle (start / resume via POST /api/narrative/session/start)
//   - Turn loop (player choice → SSE stream → new scene + options)
//   - Live queries for world_thread and player_session via useLiveQuery
//   - Turn progress state (phase + message shown while engine runs)
//   - Player character modal gate (Herald intro → creation → closing → play)

import { createSignal, createEffect, Show, onMount } from 'solid-js';
import { useAuth } from '~/libs/AuthProvider';
import { useLiveQuery } from '~/libs/SurrealProvider';
import type { CharacterChoices } from '~/components/PlayerCreation/PlayerCreationModal';
import GameLayout from './GameLayout';
import AgentProfile, { type AgentProfileProps } from './AgentProfile';
import MissionPanel, { type MissionPanelProps } from './MissionPanel';
import SiteIntelligence, { type SiteIntelligenceProps } from './SiteIntelligence';
import PlayerCreationModal from '../PlayerCreation/PlayerCreationModal';
import TurnProgress from '../TurnProgress';
import type {
    PlayerCharacterTemplate,
    PlayerCharacter,
    NarrativeOption,
    TurnProgress as TurnProgressType,
} from '~/libs/types';
import './GeneralGame.css';

// ── Props ──────────────────────────────────────────────────────────────────

export interface GeneralGameProps {
    gameId: string;           // resolved from slug in play.tsx
    onBack?: () => void;
    // Optional overrides — used by Storybook / dev previews only
    agentData?: AgentProfileProps;
    missionData?: MissionPanelProps;
    intelData?: SiteIntelligenceProps;
}

// ── Default mock data (dev / preview only) ─────────────────────────────────

const defaultAgentData: AgentProfileProps = {
    name: 'AGENT CIPHER',
    clearance: 'BLACK DIAMOND',
    operativeStatus: {
        narrativeWeight: 0.78,
        emotionalState: -0.31,
        influenceReach: 0.62,
    },
    psychologicalProfile: {
        traumaIndex: 0.42,
        resolve: 0.23,
        curiosity: 0.81,
    },
    ideologicalAlignment: {
        classifiedIntel: 0.89,
        protocolOverride: 0.74,
        chainOfCommand: -0.65,
        selfPreservation: 0.52,
    },
    susceptibilityVector: {
        moral: 0.71,
        method: 0.48,
        social: 0.39,
    },
    actionPoints: { current: 82, max: 100 },
};

const defaultMissionData: MissionPanelProps = {
    locationName: 'BLACK SITE OMEGA-7',
    phase: 'INFILTRATION',
    status: 'ACTIVE',
    paragraphs: [
        'The elevator descends past the official basement levels, through reinforced concrete and into bedrock. Your credentials—meticulously forged by the agency\'s best—got you past the lobby security, but down here, biometrics rule.',
        'The facility hums with the white noise of server farms cooling systems. Somewhere in this labyrinth of classified projects and buried secrets lies the proof you need: evidence of Operation Nightfall, the black program they swore never existed.',
        'A security terminal flickers at the corridor junction ahead. Its screen casts harsh light on the polished floor, and beyond it, a guard station manned by two armed operatives. They haven\'t seen you yet.',
    ],
    emphasisWords: ['biometrics rule', 'Operation Nightfall', 'armed operatives'],
    activeThreat: {
        name: 'Security Checkpoint Alpha',
        threatLevel: '[T:0.6 H:0.1 M:0.9]',
        exposureRisk: 0.38,
        intelSeed: '{suspicion: 0.7, danger: 0.8}',
    },
    operations: [
        { id: '1', sequence: 1, title: 'Neutralize guards with close-quarters takedown', tone: 'aggressive', risk: 'HIGH', weight: 0.35, vectorDeltas: { method: -0.2, social: -0.3, moral: -0.4 } },
        { id: '2', sequence: 2, title: 'Deploy electronic countermeasures to disable cameras', tone: 'cautious', risk: 'MODERATE', weight: 0.65, requirement: 'TECH CHECK REQUIRED', vectorDeltas: { method: 0.2, social: 0.1, moral: 0.0 } },
        { id: '3', sequence: 3, title: 'Use forged credentials and bluff past checkpoint', tone: 'diplomatic', risk: 'MODERATE', weight: 0.55, vectorDeltas: { method: 0.1, social: 0.3, moral: -0.1 } },
        { id: '4', sequence: 4, title: 'Find alternate route through ventilation system', tone: 'cautious', risk: 'LOW', weight: 0.78, vectorDeltas: { method: 0.0, social: -0.1, moral: 0.2 } },
    ],
};

const defaultIntelData: SiteIntelligenceProps = {
    subLevel: 'SUB-LEVEL 4 // ARCHIVE WING',
    description: '"A classified archive housing decades of black operations data. Motion sensors active. Thermal imaging suspected."',
    environmentalAnalysis: {
        threatSignature: '[T:0.7 H:0.1 M:0.9]',
        tension: -0.54,
        coverRating: 0.15,
    },
    locationMemory: [
        { id: '1', name: 'classified_ops', value: 0.82 },
        { id: '2', name: 'surveillance', value: 0.71 },
        { id: '3', name: 'lethal_force', value: 0.68 },
    ],
    proximityScan: [
        { id: '1', name: 'Security Detail', threatLevel: 0.85, awareness: 0.72, status: 'HOSTILE' },
    ],
    activeProtocols: [
        { id: '1', name: 'LOCKDOWN_READY', value: 0.79 },
        { id: '2', name: 'ASSET_PROTECTION', value: 0.61 },
        { id: '3', name: 'PATROL_FREQUENCY', value: 0.54 },
    ],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function GeneralGame(props: GeneralGameProps) {
    const { token } = useAuth();

    // ── Session state ────────────────────────────────────────────────────────
    const [sessionId, setSessionId] = createSignal<string | null>(null);
    const [turnNumber, setTurnNumber] = createSignal(0);
    const [scene, setScene] = createSignal<string>('');
    const [options, setOptions] = createSignal<NarrativeOption[]>([]);
    const [sessionReady, setSessionReady] = createSignal(false);
    const [loading, setLoading] = createSignal(true);

    // ── Character creation gate ──────────────────────────────────────────────
    const [showPlayerModal, setShowPlayerModal] = createSignal(false);
    const [template, setTemplate] = createSignal<PlayerCharacterTemplate | null>(null);
    const [playerCharacter, setPlayerCharacter] = createSignal<PlayerCharacter | null>(null);

    // ── Turn progress (SSE stream state) ────────────────────────────────────
    const [turnPhase, setTurnPhase] = createSignal<TurnProgressType['phase'] | null>(null);
    const [turnMessage, setTurnMessage] = createSignal('');

    // ── Live queries (powered by SurrealProvider WS in play.tsx) ────────────
    // These update reactively as the Tremor mutates world state each turn.
    // They're scoped to the current session so each player sees only their world.
    // const liveThreads = useLiveQuery(
    //     () => sessionId()
    //         ? `SELECT * FROM world_thread WHERE session_id = '${sessionId()}' AND active = true`
    //         : 'SELECT * FROM world_thread WHERE false',
    //     []
    // );

    // const livePlayerSession = useLiveQuery(
    //     () => sessionId()
    //         ? `SELECT * FROM player_session WHERE session_id = '${sessionId()}' LIMIT 1`
    //         : 'SELECT * FROM player_session WHERE false',
    //     []
    // );

    // ── On mount: check for existing character, start or resume session ──────
    onMount(async () => {
        const cleanGameId = props.gameId.includes(':')
            ? props.gameId.split(':')[1]
            : props.gameId;
        if (!cleanGameId) return;
        console.log("cleanGameId", cleanGameId);
        try {
            const res = await fetch(`/api/games/${cleanGameId}/character`, {
                credentials: 'include',
            });
            const data = await res.json();
            console.log("data", data);

            if (data.hasCharacter && data.existingCharacter) {
                setPlayerCharacter(data.existingCharacter);

                if (data.existingCharacter.session_id === "PENDING") {
                    // Character exists but session never started — treat as new
                    await startNewSession(data.existingCharacter);
                } else {
                    await resumeOrStartSession(data.existingCharacter);
                }
            } else if (data.templates?.length) {
                setTemplate(data.templates[0]);
                // console.log('data.templates[0]', data.templates[0]);
                setShowPlayerModal(true);
            } else {
                // No templates — show game with mock data until forge is complete
                setSessionReady(false);
            }
        } catch (err) {
            console.error('[GeneralGame] onMount', err);
        } finally {
            setLoading(false);
        }
    });

    // ── Session helpers ──────────────────────────────────────────────────────

    async function resumeOrStartSession(character: PlayerCharacter) {
        const res = await fetch('/api/narrative/session/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                mode: 'resume',
                gameId: props.gameId,
                sessionId: character.session_id,
                playerCharacterId: character.id,
            }),
        });
        const data = await res.json();
        // console.log("session start", data);
        setSessionId(data.sessionId);
        setTurnNumber(data.turnNumber ?? 0);
        setScene(data.scene ?? '');
        setOptions(data.options ?? []);
        console.log("options in resumeOrStartSession", data.options);
        setSessionReady(true);
    }

    async function startNewSession(character: PlayerCharacter) {
        const res = await fetch('/api/narrative/session/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                mode: 'new',
                gameId: props.gameId,
                displayName: character.display_name,
                chosenBackstory: character.chosen_backstory,
                chosenTraits: character.chosen_traits,
                chosenItems: character.chosen_items,
            }),
        });
        const data = await res.json();
        // console.log("session start", data);
        setSessionId(data.sessionId);
        setTurnNumber(0);
        setScene(data.scene ?? '');
        setOptions(data.options ?? []);
        console.log("options in startNewSession", data.options);
        setSessionReady(true);
    }

    // ── Character creation complete ──────────────────────────────────────────

    async function handleCharacterCreated(choices: CharacterChoices) {
        const cleanGameId = props.gameId.includes(':')
            ? props.gameId.split(':')[1]
            : props.gameId;
        const res = await fetch(`/api/games/${cleanGameId}/character`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                templateId: choices.templateId,
                displayName: choices.displayName,
                chosenBackstory: choices.chosenBackstory,
                chosenTraits: choices.chosenTraits,
                chosenItems: choices.chosenItems,
            }),
        });
        const data = await res.json();
        if (data.error) { console.error(data.error); return; }

        const character = data.playerCharacter;  // real DB record with proper IDs
        setPlayerCharacter(character);
        setShowPlayerModal(false);
        await startNewSession(character);
    }

    // ── Turn submission (SSE stream) ─────────────────────────────────────────

    async function handleOptionChosen(option: NarrativeOption) {
        const sid = sessionId();
        if (!sid) return;

        setTurnPhase('tremor');
        setTurnMessage('The world shifts.');
        setOptions([]);   // clear options immediately so panel shows progress

        try {
            const response = await fetch('/api/narrative/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    mode: 'turn',
                    stream: true, // Enable SSE streaming for progress updates
                    sessionId: sid,
                    gameId: props.gameId,
                    chosenOptionId: option.id,
                    chosenOptionText: option.text,
                    worldImpact: option.worldImpact,
                    turnNumber: turnNumber(),
                }),
            });

            // Read SSE stream
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    if (!part.startsWith('data: ')) continue;
                    const event = JSON.parse(part.slice(6));

                    if (event.type === 'progress') {
                        setTurnPhase(event.phase);
                        setTurnMessage(event.message);
                    } else if (event.type === 'complete') {
                        setScene(event.scene);
                        setOptions(event.options ?? []);
                        setTurnNumber(event.turnNumber);
                        setTurnPhase(null);
                        setTurnMessage('');
                    } else if (event.type === 'error') {
                        console.error('[Turn]', event.message);
                        setTurnPhase(null);
                    }
                }
            }
        } catch (err) {
            console.error('[handleOptionChosen]', err);
            setTurnPhase(null);
        }
    }

    // ── Derive panel data from live session state ────────────────────────────
    // When the session is live, panel data is driven by real world state.
    // Before the session is ready, fall back to the mock data for the preview.

    const agentData = () => props.agentData ?? defaultAgentData;
    const intelData = () => props.intelData ?? defaultIntelData;

    // MissionPanel gets the live scene text and options when the session is ready
    const missionData = (): MissionPanelProps => {
        if (!sessionReady()) return props.missionData ?? defaultMissionData;
        return {
            ...(props.missionData ?? defaultMissionData),
            paragraphs: scene() ? [scene()] : (props.missionData ?? defaultMissionData).paragraphs,
            operations: options().map((opt, i) => ({
                id: opt.id,
                sequence: i + 1,
                title: opt.text,
                // Pass tone as-is
                tone: opt.tone ?? 'cautious',
                // Derive risk from weight
                risk: opt.weight > 0.7 ? 'LOW' : opt.weight > 0.4 ? 'MODERATE' : 'HIGH',
                // Pass hover tooltip data
                consequencePreview: opt.consequence_preview,
                vectorDeltas: opt.vector_deltas,
                weight: opt.weight,
            })),
        };
    };

    return (
        <div class="general-game">
            <Show when={!loading()} fallback={
                <div style={{
                    display: 'flex', 'align-items': 'center', 'justify-content': 'center',
                    'min-height': '100vh', background: '#080c14',
                    color: '#334155', 'font-family': "'Courier New', monospace",
                    'font-size': '11px', 'letter-spacing': '0.2em'
                }}>
                    <span>ENTERING WORLD…</span>
                </div>
            }>

                {/* Back button */}
                {props.onBack && (
                    <div class="general-game-back">
                        <button class="back-to-game" onClick={props.onBack}>
                            ← Back to Game Details
                        </button>
                    </div>
                )}

                {/* Turn progress overlay */}
                <Show when={turnPhase() !== null}>
                    <TurnProgress phase={turnPhase()} message={turnMessage()} />
                </Show>

                {/* Main game layout */}
                <Show when={turnPhase() === null}>
                    <GameLayout
                        agentPanel={<AgentProfile {...agentData()} />}
                        missionPanel={
                            <MissionPanel
                                {...missionData()}
                                onOptionChosen={sessionReady() ? handleOptionChosen : undefined}
                            />
                        }
                        intelPanel={<SiteIntelligence {...intelData()} />}
                    />
                </Show>

                {/* Character creation modal */}
                <Show when={showPlayerModal() && template() !== null}>
                    <PlayerCreationModal
                        isOpen={showPlayerModal()}
                        onClose={() => setShowPlayerModal(false)}
                        template={template()!}
                        onComplete={handleCharacterCreated}
                    />
                </Show>

            </Show>
        </div>
    );
}