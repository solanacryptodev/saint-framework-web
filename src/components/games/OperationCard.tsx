import './OperationCard.css';

export interface OperationCardProps {
    id: string;
    sequence: number;
    title: string;
    method?: string;
    methodBonus?: number;
    risk: 'LOW' | 'MODERATE' | 'HIGH';
    requirement?: string;
    onClick?: () => void;
    disabled?: boolean;
}

export default function OperationCard(props: OperationCardProps) {
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

    return (
        <button
            class={`operation-card ${props.disabled ? 'disabled' : ''}`}
            onClick={props.onClick}
            disabled={props.disabled}
        >
            <div class="operation-header">
                <span class="operation-id">OP-{props.sequence.toString().padStart(2, '0')}</span>
            </div>
            <div class="operation-title">{props.title}</div>
            <div class="operation-meta">
                {props.method && (
                    <div class="operation-method">
                        <span class="method-label">- METHOD</span>
                        {props.methodBonus && (
                            <span class="method-bonus">+{props.methodBonus}</span>
                        )}
                    </div>
                )}
                <div class={`operation-risk ${getRiskClass()}`}>
                    RISK: {props.risk}
                </div>
            </div>
            {props.requirement && (
                <div class="operation-requirement">
                    {props.requirement}
                </div>
            )}
        </button>
    );
}