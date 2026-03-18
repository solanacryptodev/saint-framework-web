import './AgentProfile.css';

export interface OperativeStatus {
    narrativeWeight: number;
    emotionalState: number;
    influenceReach: number;
}

export interface PsychologicalProfile {
    traumaIndex: number;
    resolve: number;
    curiosity: number;
}

export interface IdeologicalAlignment {
    classifiedIntel: number;
    protocolOverride: number;
    chainOfCommand: number;
    selfPreservation: number;
}

export interface SusceptibilityVector {
    moral: number;
    method: number;
    social: number;
}

export interface AgentProfileProps {
    name: string;
    clearance: string;
    avatarUrl?: string;
    operativeStatus: OperativeStatus;
    psychologicalProfile: PsychologicalProfile;
    ideologicalAlignment: IdeologicalAlignment;
    susceptibilityVector: SusceptibilityVector;
    actionPoints: {
        current: number;
        max: number;
    };
}

export default function AgentProfile(props: AgentProfileProps) {
    const formatValue = (value: number) => {
        return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    };

    const getBarColor = (value: number, type: 'positive' | 'negative' | 'neutral') => {
        if (type === 'negative') {
            if (value < -0.3) return 'negative-high';
            if (value < 0) return 'negative-low';
            return 'neutral';
        }
        if (value > 0.6) return 'positive-high';
        if (value > 0.3) return 'positive-medium';
        return 'positive-low';
    };

    return (
        <div class="agent-profile">
            {/* Agent Header */}
            <div class="agent-header">
                <div class="agent-avatar">
                    {props.avatarUrl ? (
                        <img src={props.avatarUrl} alt={props.name} />
                    ) : (
                        <div class="avatar-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 12l10 10 10-10L12 2z" />
                            </svg>
                        </div>
                    )}
                </div>
                <div class="agent-info">
                    <h2 class="agent-name">{props.name}</h2>
                    <span class="agent-clearance">CLEARANCE: {props.clearance}</span>
                </div>
            </div>

            {/* Operative Status */}
            <div class="profile-section">
                <div class="section-title">OPERATIVE STATUS</div>
                <div class="status-bars">
                    <div class="status-item">
                        <div class="status-label">
                            <span>NARRATIVE WEIGHT</span>
                            <span class="status-value">{props.operativeStatus.narrativeWeight.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class={`status-fill ${getBarColor(props.operativeStatus.narrativeWeight, 'positive')}`}
                                style={{ width: `${props.operativeStatus.narrativeWeight * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>EMOTIONAL STATE</span>
                            <span class="status-value negative">{formatValue(props.operativeStatus.emotionalState)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class={`status-fill ${getBarColor(props.operativeStatus.emotionalState, 'negative')}`}
                                style={{ width: `${Math.abs(props.operativeStatus.emotionalState) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>INFLUENCE REACH</span>
                            <span class="status-value">{props.operativeStatus.influenceReach.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class={`status-fill ${getBarColor(props.operativeStatus.influenceReach, 'positive')}`}
                                style={{ width: `${props.operativeStatus.influenceReach * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Psychological Profile */}
            <div class="profile-section">
                <div class="section-title">PSYCHOLOGICAL PROFILE</div>
                <div class="status-bars">
                    <div class="status-item">
                        <div class="status-label">
                            <span>TRAUMA INDEX</span>
                            <span class="status-value">{props.psychologicalProfile.traumaIndex.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill trauma"
                                style={{ width: `${props.psychologicalProfile.traumaIndex * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>RESOLVE</span>
                            <span class="status-value">{props.psychologicalProfile.resolve.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill resolve"
                                style={{ width: `${props.psychologicalProfile.resolve * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>CURIOSITY</span>
                            <span class="status-value">{props.psychologicalProfile.curiosity.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill curiosity"
                                style={{ width: `${props.psychologicalProfile.curiosity * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ideological Alignment */}
            <div class="profile-section">
                <div class="section-title">IDEOLOGICAL ALIGNMENT</div>
                <div class="alignment-list">
                    <div class="alignment-item">
                        <span class="alignment-indicator positive">+</span>
                        <span class="alignment-name">classified_intel</span>
                        <span class="alignment-value">{props.ideologicalAlignment.classifiedIntel.toFixed(2)}</span>
                    </div>
                    <div class="alignment-item">
                        <span class="alignment-indicator positive">+</span>
                        <span class="alignment-name">protocol_override</span>
                        <span class="alignment-value">{props.ideologicalAlignment.protocolOverride.toFixed(2)}</span>
                    </div>
                    <div class="alignment-item">
                        <span class="alignment-indicator negative">-</span>
                        <span class="alignment-name">chain_of_command</span>
                        <span class="alignment-value negative">{props.ideologicalAlignment.chainOfCommand.toFixed(2)}</span>
                    </div>
                    <div class="alignment-item">
                        <span class="alignment-indicator neutral">○</span>
                        <span class="alignment-name">self_preservation</span>
                        <span class="alignment-value">{props.ideologicalAlignment.selfPreservation.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Susceptibility Vector */}
            <div class="profile-section">
                <div class="section-title">SUSCEPTIBILITY VECTOR</div>
                <div class="status-bars">
                    <div class="status-item">
                        <div class="status-label">
                            <span>MORAL</span>
                            <span class="status-value">{props.susceptibilityVector.moral.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill moral"
                                style={{ width: `${props.susceptibilityVector.moral * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>METHOD</span>
                            <span class="status-value">{props.susceptibilityVector.method.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill method"
                                style={{ width: `${props.susceptibilityVector.method * 100}%` }}
                            />
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">
                            <span>SOCIAL</span>
                            <span class="status-value">{props.susceptibilityVector.social.toFixed(2)}</span>
                        </div>
                        <div class="status-track">
                            <div
                                class="status-fill social"
                                style={{ width: `${props.susceptibilityVector.social * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Operational Capacity */}
            <div class="profile-section operational-capacity">
                <div class="section-title">OPERATIONAL CAPACITY</div>
                <div class="action-points">
                    <div class="action-label">
                        <span>ACTION POINTS</span>
                        <span class="action-value">{props.actionPoints.current} / {props.actionPoints.max}</span>
                    </div>
                    <div class="action-track">
                        <div
                            class="action-fill"
                            style={{ width: `${(props.actionPoints.current / props.actionPoints.max) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}