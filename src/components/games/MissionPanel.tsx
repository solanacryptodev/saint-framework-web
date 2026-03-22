import { For } from 'solid-js';
import OperationCard, { type OperationCardProps, type VectorDeltas } from './OperationCard';
import type { NarrativeOption, TurnProgress } from '~/libs/types';
import './MissionPanel.css';

export interface ActiveThreat {
    name: string;
    threatLevel: string;
    exposureRisk: number;
    intelSeed: string;
}

export interface MissionPanelProps {
    locationName: string;
    phase: string;
    status: string;
    paragraphs: string[];
    emphasisWords?: string[];
    activeThreat?: ActiveThreat;
    operations: OperationCardProps[];
    // Turn loop integration
    onOptionChosen?: (option: NarrativeOption) => void;
    turnPhase?: TurnProgress['phase'] | null;
}

export default function MissionPanel(props: MissionPanelProps) {
    // Function to highlight emphasis words in text
    const renderParagraph = (text: string) => {
        if (!props.emphasisWords || props.emphasisWords.length === 0) {
            return text;
        }

        let result = text;
        props.emphasisWords.forEach((word) => {
            const regex = new RegExp(`(${word})`, 'gi');
            result = result.replace(regex, '<span class="emphasis">$1</span>');
        });

        return <span innerHTML={result} />;
    };

    function handleOperationClick(operation: OperationCardProps) {
        if (props.onOptionChosen && !props.turnPhase) {
            props.onOptionChosen({
                id: operation.id,
                text: operation.title,
                tone: (operation.tone as any) || 'cautious',
                loreReferences: [],
                worldImpact: {
                    actorDeltas: {},
                    locationDeltas: {},
                    itemDeltas: {},
                    newEdges: [],
                    newThreads: [],
                    consequenceSeeds: [],
                    narrativePressure: 0,
                },
                weight: operation.weight ?? (operation.risk === 'LOW' ? 0.8 : operation.risk === 'MODERATE' ? 0.5 : 0.2),
                consequence_preview: operation.consequencePreview,
                vector_deltas: operation.vectorDeltas,
            });
        }
    }

    return (
        <div class="mission-panel">
            {/* Header */}
            <div class="mission-header">
                <div class="location-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span class="location-name">{props.locationName}</span>
                </div>
                <div class="mission-status">
                    <span class="phase">PHASE: {props.phase}</span>
                    <span class="status-divider">|</span>
                    <span class="status">STATUS: {props.status}</span>
                </div>
            </div>

            {/* Narrative Content */}
            <div class="mission-content">
                <div class="narrative-scroll">
                    <For each={props.paragraphs}>
                        {(paragraph) => (
                            <p class="narrative-paragraph">
                                {renderParagraph(paragraph)}
                            </p>
                        )}
                    </For>
                </div>
            </div>

            {/* Active Threat Section */}
            {props.activeThreat && (
                <div class="active-threat">
                    <div class="threat-header">
                        <span class="threat-label">ACTIVE THREAT</span>
                    </div>
                    <div class="threat-content">
                        <div class="threat-name">{props.activeThreat.name}</div>
                        <div class="threat-details">
                            <div class="threat-level">
                                <span class="detail-label">THREAT LEVEL:</span>
                                <span class="detail-value">{props.activeThreat.threatLevel}</span>
                            </div>
                            <div class="exposure-risk">
                                <span class="detail-label">EXPOSURE RISK:</span>
                                <div class="risk-bar">
                                    <div
                                        class="risk-fill"
                                        style={{ width: `${props.activeThreat.exposureRisk * 100}%` }}
                                    />
                                </div>
                                <span class="detail-value">{props.activeThreat.exposureRisk.toFixed(2)}</span>
                            </div>
                            <div class="intel-seed">
                                <span class="detail-label">INTEL SEED:</span>
                                <span class="detail-value">{props.activeThreat.intelSeed}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Operations Grid */}
            <div class="operations-section">
                <div class="operations-grid">
                    <For each={props.operations}>
                        {(operation) => (
                            <OperationCard
                                {...operation}
                                disabled={props.turnPhase !== null && props.turnPhase !== undefined}
                                onClick={() => handleOperationClick(operation)}
                            />
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
