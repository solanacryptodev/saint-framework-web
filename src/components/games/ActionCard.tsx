import './ActionCard.css';

export interface ActionCardProps {
    id: string;
    sequence: number;
    title: string;
    requirement?: string;
    onClick?: () => void;
    disabled?: boolean;
}

export default function ActionCard(props: ActionCardProps) {
    return (
        <button
            class={`action-card ${props.disabled ? 'disabled' : ''}`}
            onClick={props.onClick}
            disabled={props.disabled}
            data-sequence={props.sequence}
        >
            <div class="action-sequence">
                <span>[</span>
                <span class="seq-label">ACT_SEQ</span>
                <span>//</span>
                <span class="seq-number">{props.sequence.toString().padStart(2, '0')}</span>
                <span>]</span>
            </div>
            <div class="action-title">{props.title}</div>
            {props.requirement && (
                <div class="action-requirement">
                    <span>[</span>
                    <span>{props.requirement}</span>
                    <span>]</span>
                </div>
            )}
        </button>
    );
}
