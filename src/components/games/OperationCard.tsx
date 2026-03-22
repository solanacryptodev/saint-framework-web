import { createSignal, Show } from 'solid-js';
import './OperationCard.css';

export interface VectorDeltas {
    method: number;
    social: number;
    moral: number;
}

export interface OperationCardProps {
    id: string;
    sequence: number;
    title: string;
    tone: string;
    risk: 'LOW' | 'MODERATE' | 'HIGH';
    consequencePreview?: string;
    vectorDeltas?: VectorDeltas;
    weight?: number;
    requirement?: string;
    onClick?: () => void;
    disabled?: boolean;
}

export default function OperationCard(props: OperationCardProps) {
    const [showTooltip, setShowTooltip] = createSignal(false);

    const getRiskClass = () => {
        switch (props.risk) {
            case 'LOW':
                return 'risk-low';
            case 'MODERATE':
                return 'risk-moderate';
            case 'HIGH':
                return 'risk-high';
            default:
                return '';
        }
    };

    const getToneClass = () => {
        switch (props.tone?.toLowerCase()) {
            case 'heroic':
            case 'compassionate':
                return 'tone-heroic';
            case 'aggressive':
            case 'deceptive':
                return 'tone-aggressive';
            case 'cautious':
            case 'cowardly':
                return 'tone-cautious';
            case 'diplomatic':
            case 'curious':
                return 'tone-diplomatic';
            default:
                return 'tone-default';
        }
    };

    const formatDelta = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}`;
    };

    return (
        <button
            class={`operation-card ${props.disabled ? 'disabled' : ''}`}
            onClick={props.onClick}
            disabled={props.disabled}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div class="operation-header">
                <span class="operation-id">OP-{props.sequence.toString().padStart(2, '0')}</span>
                <div class={`operation-tone ${getToneClass()}`}>
                    {props.tone?.toUpperCase()}
                </div>
            </div>
            <div class="operation-title">{props.title}</div>
            <div class="operation-meta">
                <div class={`operation-risk ${getRiskClass()}`}>
                    RISK: {props.risk}
                </div>
            </div>
            {props.requirement && (
                <div class="operation-requirement">
                    {props.requirement}
                </div>
            )}

            {/* Hover Tooltip */}
            <Show when={showTooltip() && (props.consequencePreview || props.vectorDeltas || props.weight !== undefined)}>
                <div class="operation-tooltip">
                    <Show when={props.consequencePreview}>
                        <div class="tooltip-section tooltip-consequence">
                            <div class="tooltip-label">CONSEQUENCE</div>
                            <div class="tooltip-text">{props.consequencePreview}</div>
                        </div>
                    </Show>

                    <Show when={props.vectorDeltas}>
                        <div class="tooltip-section tooltip-vectors">
                            <div class="tooltip-label">VECTOR DELTAS</div>
                            <div class="vector-grid">
                                <div class="vector-item">
                                    <span class="vector-name">METHOD</span>
                                    <span class={`vector-value ${props.vectorDeltas!.method >= 0 ? 'positive' : 'negative'}`}>
                                        {formatDelta(props.vectorDeltas!.method)}
                                    </span>
                                </div>
                                <div class="vector-item">
                                    <span class="vector-name">SOCIAL</span>
                                    <span class={`vector-value ${props.vectorDeltas!.social >= 0 ? 'positive' : 'negative'}`}>
                                        {formatDelta(props.vectorDeltas!.social)}
                                    </span>
                                </div>
                                <div class="vector-item">
                                    <span class="vector-name">MORAL</span>
                                    <span class={`vector-value ${props.vectorDeltas!.moral >= 0 ? 'positive' : 'negative'}`}>
                                        {formatDelta(props.vectorDeltas!.moral)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={props.weight !== undefined}>
                        <div class="tooltip-section tooltip-weight">
                            <div class="tooltip-label">WEIGHT</div>
                            <div class="weight-bar-container">
                                <div class="weight-bar" style={{ width: `${(props.weight ?? 0) * 100}%` }} />
                            </div>
                            <span class="weight-value">{(props.weight ?? 0).toFixed(2)}</span>
                        </div>
                    </Show>
                </div>
            </Show>
        </button>
    );
}
