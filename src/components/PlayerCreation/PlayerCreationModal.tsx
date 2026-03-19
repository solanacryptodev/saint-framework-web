import { createSignal, For } from 'solid-js';
import GeneralModal from '../games/GeneralModal';
import './PlayerCreationModal.css';

// ── Mock Data ──
const presetAgents = [
    { id: 'cipher', name: 'AGENT CIPHER', icon: '⚿' },
    { id: 'vanguard', name: 'SPECIALIST VANGUARD', icon: '⚔' },
    { id: 'ghost', name: 'OPERATIVE GHOST', icon: '⚿' },
];

const defaultProfile = {
    designation: 'UNKNOWN_OPERATIVE_04',
    originSite: 'SECTOR 7G',
    clearanceLevel: 'PENDING AUTHORIZATION',
    psychologicalProfile: [
        { name: 'TRAUMA INDEX', value: 0.42, type: 'trauma' as const },
        { name: 'RESOLVE', value: 0.78, type: 'resolve' as const },
        { name: 'CURIOSITY', value: 0.81, type: 'curiosity' as const },
        { name: 'NARRATIVE WEIGHT', value: 0.55, type: 'narrative' as const },
    ],
    ideologicalAlignment: [
        { name: 'protocol_override', value: 0.74, direction: 'positive' as const },
        { name: 'chain_of_command', value: -0.65, direction: 'negative' as const },
        { name: 'self_preservation', value: 0.52, direction: 'neutral' as const },
        { name: 'lethal_force', value: 0.88, direction: 'positive' as const },
    ],
    actionPoints: { current: 82, max: 100 },
};

// ── Component ──
export interface PlayerCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PlayerCreationModal(props: PlayerCreationModalProps) {
    const [selectedAgent, setSelectedAgent] = createSignal<string | null>(null);
    const [isCustom, setIsCustom] = createSignal(true);

    function handlePreset(id: string) {
        setSelectedAgent(id);
        setIsCustom(false);
    }

    function handleCustom() {
        setSelectedAgent(null);
        setIsCustom(true);
    }

    return (
        <GeneralModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="OPERATIVE INITIALIZATION"
            modalType="player-creation"
            footerActions={
                <>
                    <button class="pcm-btn-cancel" onClick={() => props.onClose()}>
                        CANCEL ABORT
                    </button>
                    <button class="pcm-btn-initialize">
                        <span class="btn-diamond">◆</span>
                        INITIALIZE OPERATIVE
                    </button>
                </>
            }
        >
            <div class="pcm-layout">
                {/* ── Left Sidebar ── */}
                <div class="pcm-sidebar">
                    <div class="pcm-sidebar-section">
                        <div class="pcm-sidebar-label">PRE-CLEARED ASSETS</div>
                        <For each={presetAgents}>
                            {(agent) => (
                                <div
                                    class={`pcm-sidebar-item ${selectedAgent() === agent.id ? 'active' : ''}`}
                                    onClick={() => handlePreset(agent.id)}
                                >
                                    <span class="item-icon">{agent.icon}</span>
                                    {agent.name}
                                </div>
                            )}
                        </For>
                    </div>

                    <div class="pcm-sidebar-section">
                        <div class="pcm-sidebar-label">NEW ASSET</div>
                        <div
                            class={`pcm-sidebar-item ${isCustom() ? 'active' : ''}`}
                            onClick={handleCustom}
                        >
                            <span class="item-icon">◆</span>
                            CUSTOM PROFILE
                        </div>
                    </div>
                </div>

                {/* ── Right Content ── */}
                <div class="pcm-content">
                    {/* Asset Definition */}
                    <div>
                        <div class="pcm-section-label">ASSET DEFINITION</div>
                        <div class="pcm-asset-definition">
                            <div class="pcm-avatar">
                                <svg width="48" height="56" viewBox="0 0 48 56" fill="currentColor" opacity="0.35">
                                    <path d="M24 4 C20 4 16 8 16 14 C16 20 20 24 24 24 C28 24 32 20 32 14 C32 8 28 4 24 4 Z" />
                                    <path d="M12 52 L12 36 C12 30 16 26 24 26 C32 26 36 30 36 36 L36 52 Z" />
                                </svg>
                            </div>
                            <div class="pcm-asset-info">
                                <div class="pcm-field-group">
                                    <span class="pcm-field-label">DESIGNATION (CALLSIGN)</span>
                                    <span class="pcm-field-value">{defaultProfile.designation}</span>
                                </div>
                                <div class="pcm-field-row">
                                    <div class="pcm-field-group">
                                        <span class="pcm-field-label">ORIGIN SITE</span>
                                        <span class="pcm-field-value">{defaultProfile.originSite}</span>
                                    </div>
                                    <div class="pcm-field-group">
                                        <span class="pcm-field-label">CLEARANCE LEVEL</span>
                                        <span class="pcm-field-value" style={{ color: 'rgba(200, 180, 140, 0.7)' }}>
                                            {defaultProfile.clearanceLevel}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div class="pcm-stats-row">
                        {/* Psychological Profile */}
                        <div class="pcm-stats-column">
                            <div class="pcm-section-label">PSYCHOLOGICAL PROFILE</div>
                            <For each={defaultProfile.psychologicalProfile}>
                                {(stat) => (
                                    <div class="pcm-stat-item">
                                        <div class="pcm-stat-header">
                                            <span class="pcm-stat-name">{stat.name}</span>
                                            <span class={`pcm-stat-value ${stat.type}`}>
                                                {stat.value.toFixed(2)}
                                            </span>
                                        </div>
                                        <div class="pcm-stat-track">
                                            <div
                                                class={`pcm-stat-fill ${stat.type}`}
                                                style={{ width: `${stat.value * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>

                        {/* Ideological Alignment */}
                        <div class="pcm-stats-column">
                            <div class="pcm-section-label">IDEOLOGICAL ALIGNMENT</div>
                            <For each={defaultProfile.ideologicalAlignment}>
                                {(item) => (
                                    <div class="pcm-alignment-item">
                                        <span class={`pcm-alignment-indicator ${item.direction}`}>
                                            {item.direction === 'positive' ? '+' : item.direction === 'negative' ? '−' : '○'}
                                        </span>
                                        <span class="pcm-alignment-name">{item.name}</span>
                                        <span class={`pcm-alignment-value ${item.value < 0 ? 'negative' : ''}`}>
                                            {item.value.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Operational Capacity */}
                    <div>
                        <div class="pcm-section-label">OPERATIONAL CAPACITY</div>
                        <div class="pcm-capacity">
                            <div class="pcm-capacity-header">
                                <span class="pcm-capacity-label">ACTION POINTS</span>
                                <span class="pcm-capacity-value">
                                    {defaultProfile.actionPoints.current} / {defaultProfile.actionPoints.max}
                                </span>
                            </div>
                            <div class="pcm-capacity-track">
                                <div
                                    class="pcm-capacity-fill"
                                    style={{
                                        width: `${(defaultProfile.actionPoints.current / defaultProfile.actionPoints.max) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GeneralModal>
    );
}
