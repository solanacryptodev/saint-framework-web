import { For } from 'solid-js';
import ActionCard, { type ActionCardProps } from './ActionCard';
import './NarrativePanel.css';

export interface NarrativePanelProps {
    sectorNumber?: number;
    sectorTitle: string;
    dataStream?: string;
    paragraphs: string[];
    emphasisWords?: string[];
    actions: ActionCardProps[];
}

export default function NarrativePanel(props: NarrativePanelProps) {
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

    return (
        <div class="narrative-panel">
            {/* Header */}
            <div class="narrative-header">
                <div class="sector-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span>
                        {props.sectorNumber && `SECTOR ${props.sectorNumber}: `}
                        {props.sectorTitle}
                    </span>
                </div>
                {props.dataStream && (
                    <div class="data-stream">
                        <span>DATA_STREAM://</span>
                        <span class="stream-id">{props.dataStream}</span>
                    </div>
                )}
            </div>

            {/* Narrative Content */}
            <div class="narrative-content">
                <div class="narrative-scroll">
                    <For each={props.paragraphs}>
                        {(paragraph, index) => (
                            <p class="narrative-paragraph">
                                {renderParagraph(paragraph)}
                            </p>
                        )}
                    </For>
                </div>

                {/* Divider line */}
                <div class="narrative-divider">
                    {Array.from({ length: 30 }).map(() => (
                        <span class="divider-dash" />
                    ))}
                </div>
            </div>

            {/* Action Cards */}
            <div class="actions-grid">
                <For each={props.actions}>
                    {(action) => <ActionCard {...action} />}
                </For>
            </div>
        </div>
    );
}
