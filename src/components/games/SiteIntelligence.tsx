import './SiteIntelligence.css';

export interface EnvironmentalAnalysis {
    threatSignature: string;
    tension: number;
    coverRating: number;
}

export interface LocationMemoryItem {
    id: string;
    name: string;
    value: number;
}

export interface ProximityAlert {
    id: string;
    name: string;
    threatLevel: number;
    awareness: number;
    status: 'HOSTILE' | 'NEUTRAL' | 'FRIENDLY';
}

export interface ActiveProtocol {
    id: string;
    name: string;
    value: number;
}

export interface SiteIntelligenceProps {
    imageUrl?: string;
    subLevel: string;
    description: string;
    environmentalAnalysis: EnvironmentalAnalysis;
    locationMemory: LocationMemoryItem[];
    proximityScan: ProximityAlert[];
    activeProtocols: ActiveProtocol[];
}

export default function SiteIntelligence(props: SiteIntelligenceProps) {
    const getStatusClass = (status: ProximityAlert['status']) => {
        switch (status) {
            case 'HOSTILE':
                return 'status-hostile';
            case 'NEUTRAL':
                return 'status-neutral';
            case 'FRIENDLY':
                return 'status-friendly';
            default:
                return '';
        }
    };

    return (
        <div class="site-intelligence">
            {/* Site Intelligence Header */}
            <div class="intel-header">
                <span class="intel-title">SITE INTELLIGENCE</span>
            </div>

            {/* Image Section */}
            <div class="intel-image">
                {props.imageUrl ? (
                    <img src={props.imageUrl} alt="Site" />
                ) : (
                    <div class="image-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2" />

                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                            <polyline points="21 15 16 10 5 21" stroke-width="2" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Sub-Level Info */}
            <div class="sublevel-info">
                <h3 class="sublevel-title">{props.subLevel}</h3>
                <p class="sublevel-description">{props.description}</p>
            </div>

            {/* Environmental Analysis → Location State */}
            <div class="intel-section">
                <div class="section-title">LOCATION STATE</div>
                <div class="analysis-grid">
                    <div class="analysis-item">
                        <span class="analysis-label">WEIGHT:</span>
                        <span class="analysis-value">{props.environmentalAnalysis.threatSignature}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">MOOD:</span>
                        <span class="analysis-value negative">{props.environmentalAnalysis.tension.toFixed(2)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">COVER RATING:</span>
                        <span class="analysis-value positive">+{props.environmentalAnalysis.coverRating.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Location Memory → Concept Imprint */}
            <div class="intel-section">
                <div class="section-title">CONCEPT IMPRINT</div>
                <div class="memory-list">
                    {props.locationMemory.map((item) => (
                        <div class="memory-item">
                            <span class="memory-indicator">+</span>
                            <span class="memoryName">{item.name}</span>
                            <span class="memory-value">{item.value.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Proximity Scan → Nearby Agents */}
            <div class="intel-section">
                <div class="section-title">NEARBY AGENTS</div>
                <div class="proximity-list">
                    {props.proximityScan.map((alert) => (
                        <div class={`proximity-item ${getStatusClass(alert.status)}`}>
                            <div class="proximity-header">
                                <span class="proximity-status-indicator" />
                                <span class="proximity-name">{alert.name}</span>
                                <span class={`proximity-status ${getStatusClass(alert.status)}`}>{alert.status}</span>
                            </div>
                            <div class="proximity-details">
                                <span class="proximity-detail">
                                    WEIGHT: <span class="detail-value">{alert.threatLevel.toFixed(2)}</span>
                                </span>
                                <span class="proximity-detail">
                                    AWARENESS: <span class="detail-value">{alert.awareness.toFixed(2)}</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div class="proximity-footer">
                    <span class="footer-text">- No additional contacts detected</span>
                </div>
            </div>

            {/* Active Protocols → Active Concepts */}
            <div class="intel-section protocols-section">
                <div class="section-title">ACTIVE CONCEPTS</div>
                <div class="protocols-list">
                    {props.activeProtocols.map((protocol) => (
                        <div class="protocol-item">
                            <span class="protocol-name">{protocol.name}</span>
                            <div class="protocol-bar">
                                <div
                                    class="protocol-fill"
                                    style={{ width: `${protocol.value * 100}%` }}
                                />
                            </div>
                            <span class="protocol-value">{protocol.value.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
