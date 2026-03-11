import './CharacterPanel.css';

export interface CharacterStats {
    processing: number;
    bandwidth: number;
    encryption: number;
    signal: number;
}

export interface SystemStatus {
    integrity: number;
    energy: number;
}

export interface CharacterPanelProps {
    name: string;
    className: string;
    avatarUrl?: string;
    systemStatus: SystemStatus;
    coreStats: CharacterStats;
    swarmNodes: number;
    swarmActive: boolean;
}

export default function CharacterPanel(props: CharacterPanelProps) {
    return (
        <div class="character-panel">
            {/* Character Header */}
            <div class="character-header">
                <div class="character-avatar">
                    {props.avatarUrl ? (
                        <img src={props.avatarUrl} alt={props.name} />
                    ) : (
                        <div class="avatar-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                    )}
                </div>
                <div class="character-info">
                    <h2 class="character-name">{props.name}</h2>
                    <span class="character-class">CLASS: {props.className}</span>
                </div>
                <button class="character-menu-btn" aria-label="Character menu">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2" />
                        <rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2" />
                        <rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2" />
                        <rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2" />
                    </svg>
                </button>
            </div>

            {/* System Status */}
            <div class="system-status">
                <div class="status-bar">
                    <div class="status-label">
                        <span>SYS_INTEGRITY</span>
                        <span>{props.systemStatus.integrity}%</span>
                    </div>
                    <div class="status-track">
                        <div class="status-fill integrity" style={{ width: `${props.systemStatus.integrity}%` }} />
                    </div>
                </div>
                <div class="status-bar">
                    <div class="status-label">
                        <span>NODE_ENERGY</span>
                        <span>{props.systemStatus.energy}%</span>
                    </div>
                    <div class="status-track">
                        <div class="status-fill energy" style={{ width: `${props.systemStatus.energy}%` }} />
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div class="panel-divider" />

            {/* Core Logic */}
            <div class="core-logic">
                <div class="section-header">
                    <span>CORE_LOGIC</span>
                    <button class="settings-btn" aria-label="Settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="3" stroke-width="2" />
                            <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.9 9.9h-6m-6 0H1.9" stroke-width="2" />
                        </svg>
                    </button>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-name">Processing</span>
                        <span class="stat-value">{props.coreStats.processing.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-name">Bandwidth</span>
                        <span class="stat-value">{props.coreStats.bandwidth.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-name">Encryption</span>
                        <span class="stat-value">{props.coreStats.encryption.toString().padStart(2, '0')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-name">Signal</span>
                        <span class="stat-value">{props.coreStats.signal.toString().padStart(2, '0')}</span>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div class="panel-divider" />

            {/* Swarm Overview */}
            <div class="swarm-overview">
                <div class="section-header">
                    <span>SWARM_OVERVIEW</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3" stroke-width="2" />
                        <circle cx="5" cy="5" r="2" stroke-width="2" />
                        <circle cx="19" cy="5" r="2" stroke-width="2" />
                        <circle cx="5" cy="19" r="2" stroke-width="2" />
                        <circle cx="19" cy="19" r="2" stroke-width="2" />
                    </svg>
                </div>
                <div class="swarm-status">
                    <div class="swarm-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2a10 10 0 0 0-7.35 16.77l.68.73a10 10 0 0 0 13.34 0l.68-.73A10 10 0 0 0 12 2z" stroke-width="2" />
                            <circle cx="12" cy="10" r="3" stroke-width="2" />
                            <path d="M7 16c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke-width="2" />
                        </svg>
                    </div>
                    <div class="swarm-info">
                        <div class="swarm-label">{props.swarmActive ? 'LINK_ACTIVE' : 'LINK_INACTIVE'}</div>
                        <div class="swarm-nodes">{props.swarmNodes} MICRO-NODES</div>
                    </div>
                </div>
                <div class="swarm-nodes-indicator">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div class={`node-dot ${i < props.swarmNodes / 2 ? 'active' : ''}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}
