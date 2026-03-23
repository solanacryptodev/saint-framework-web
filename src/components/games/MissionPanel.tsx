import { For, createSignal, createEffect, Show, onCleanup } from 'solid-js';
import OperationCard, { type OperationCardProps, type VectorDeltas } from './OperationCard';
import type { NarrativeOption, TurnProgress as TurnProgressType } from '~/libs/types';
import TurnProgress from '../TurnProgress';
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
    turnPhase?: TurnProgressType['phase'] | null;
    turnMessage?: string;
    // Herald Step 0 integration
    heraldText?: string;
    pendingProse?: string[];
    onRevealPendingProse?: () => void;
    // Prose animation speed (ms per character)
    proseSpeed?: number;
}

export default function MissionPanel(props: MissionPanelProps) {
    // Herald text typewriter animation state
    const [displayedHeraldText, setDisplayedHeraldText] = createSignal("");
    const [heraldComplete, setHeraldComplete] = createSignal(false);
    let heraldTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let heraldCharIndex = 0;

    // Prose typewriter animation state
    const [displayedParagraphs, setDisplayedParagraphs] = createSignal<string[]>([]);
    const [currentParagraphIndex, setCurrentParagraphIndex] = createSignal(0);
    const [proseComplete, setProseComplete] = createSignal(false);
    const [proseSkipped, setProseSkipped] = createSignal(false);
    const [showProseContinue, setShowProseContinue] = createSignal(false);
    let proseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let proseCharIndex = 0;

    const proseSpeed = () => props.proseSpeed ?? 18;

    // Effect to handle herald text typewriter animation
    createEffect(() => {
        const heraldText = props.heraldText;

        // Clear previous animation
        if (heraldTimeoutId) {
            clearTimeout(heraldTimeoutId);
            heraldTimeoutId = null;
        }

        // Reset state when new herald text arrives
        if (heraldText) {
            setDisplayedHeraldText("");
            setHeraldComplete(false);
            heraldCharIndex = 0;

            // Start typewriter animation after a brief delay
            heraldTimeoutId = setTimeout(() => {
                typeNextHeraldChar(heraldText);
            }, 300);
        }
    });

    // Effect to handle prose typewriter animation
    createEffect(() => {
        const paragraphs = props.paragraphs;

        // Clear previous animation
        if (proseTimeoutId) {
            clearTimeout(proseTimeoutId);
            proseTimeoutId = null;
        }

        // Reset and start animation when paragraphs change
        if (paragraphs && paragraphs.length > 0) {
            setDisplayedParagraphs([]);
            setCurrentParagraphIndex(0);
            setProseComplete(false);
            setProseSkipped(false);
            setShowProseContinue(false);
            proseCharIndex = 0;

            // Start typing after a brief delay (wait for herald to finish if present)
            const startDelay = props.heraldText ? 800 : 300;
            proseTimeoutId = setTimeout(() => {
                typeNextProseChar();
            }, startDelay);
        }
    });

    function typeNextHeraldChar(fullText: string) {
        if (heraldCharIndex < fullText.length) {
            setDisplayedHeraldText(fullText.slice(0, heraldCharIndex + 1));
            heraldCharIndex++;
            heraldTimeoutId = setTimeout(() => typeNextHeraldChar(fullText), 35);
        } else {
            setHeraldComplete(true);
        }
    }

    function typeNextProseChar() {
        const paragraphs = props.paragraphs;
        const paragraphIndex = currentParagraphIndex();

        if (paragraphIndex >= paragraphs.length) {
            // All paragraphs typed
            setProseComplete(true);
            setShowProseContinue(true);
            return;
        }

        const currentParagraph = paragraphs[paragraphIndex];

        if (proseCharIndex < currentParagraph.length) {
            // Type next character in current paragraph
            const newDisplayed = [...displayedParagraphs()];
            // Ensure array is long enough
            while (newDisplayed.length <= paragraphIndex) {
                newDisplayed.push("");
            }
            newDisplayed[paragraphIndex] = currentParagraph.slice(0, proseCharIndex + 1);
            setDisplayedParagraphs(newDisplayed);
            proseCharIndex++;
            proseTimeoutId = setTimeout(typeNextProseChar, proseSpeed());
        } else {
            // Current paragraph complete, move to next
            const newDisplayed = [...displayedParagraphs()];
            while (newDisplayed.length <= paragraphIndex) {
                newDisplayed.push("");
            }
            newDisplayed[paragraphIndex] = currentParagraph;
            setDisplayedParagraphs(newDisplayed);

            proseCharIndex = 0;
            setCurrentParagraphIndex(paragraphIndex + 1);

            // Small pause before starting next paragraph
            if (paragraphIndex + 1 < paragraphs.length) {
                proseTimeoutId = setTimeout(typeNextProseChar, 150);
            } else {
                // All paragraphs typed
                setProseComplete(true);
                setShowProseContinue(true);
            }
        }
    }

    function skipProseAnimation() {
        if (proseTimeoutId) {
            clearTimeout(proseTimeoutId);
            proseTimeoutId = null;
        }
        // Show all paragraphs in full
        setDisplayedParagraphs([...props.paragraphs]);
        setCurrentParagraphIndex(props.paragraphs.length);
        setProseSkipped(true);
        setProseComplete(true);
        setShowProseContinue(true);
    }

    function handleProseContinue() {
        setShowProseContinue(false);
        setProseComplete(true);
    }

    // Keyboard handler for prose continue
    function handleKeyDown(e: KeyboardEvent) {
        if (showProseContinue()) {
            handleProseContinue();
        } else if (!proseComplete()) {
            skipProseAnimation();
        }
    }

    // Clean up on unmount
    onCleanup(() => {
        if (heraldTimeoutId) {
            clearTimeout(heraldTimeoutId);
        }
        if (proseTimeoutId) {
            clearTimeout(proseTimeoutId);
        }
    });

    // Check if there's pending prose to reveal
    const hasPendingProse = () => (props.pendingProse?.length ?? 0) > 0;
    const pendingCount = () => props.pendingProse?.length ?? 0;

    // Handle clicking on the waiting status
    function handleWaitingClick() {
        if (hasPendingProse() && props.onRevealPendingProse) {
            props.onRevealPendingProse();
        }
    }

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
                    <Show when={hasPendingProse()}>
                        <span
                            class="status status-waiting"
                            onClick={handleWaitingClick}
                            title={`${pendingCount()} scene(s) waiting - click to reveal`}
                        >
                            STATUS: WAITING...
                        </span>
                    </Show>
                    <Show when={!hasPendingProse()}>
                        <span class="status">STATUS: {props.status}</span>
                    </Show>
                </div>
            </div>

            {/* Herald Text Container - Dark Gold Glassmorphic Box */}
            <Show when={displayedHeraldText()}>
                <div class="herald-text-container">
                    <p class="herald-text">{displayedHeraldText()}</p>
                    <Show when={!heraldComplete()}>
                        <span class="herald-cursor">▌</span>
                    </Show>
                </div>
            </Show>

            {/* Narrative Content with Typewriter Animation */}
            <div class="mission-content" onClick={() => {
                if (showProseContinue()) {
                    handleProseContinue();
                } else if (!proseComplete()) {
                    skipProseAnimation();
                }
            }}>
                <div class="narrative-scroll">
                    <For each={displayedParagraphs()}>
                        {(paragraph, index) => (
                            <p class="narrative-paragraph">
                                {renderParagraph(paragraph)}
                                {/* Show cursor on last paragraph while typing */}
                                <Show when={index() === currentParagraphIndex() - 1 && !proseComplete()}>
                                    <span class="prose-cursor">▌</span>
                                </Show>
                            </p>
                        )}
                    </For>
                    {/* Continue prompt */}
                    <Show when={showProseContinue()}>
                        <div class="prose-continue">
                            {proseSkipped() ? "CONTINUE" : "PRESS ANY KEY"}
                        </div>
                    </Show>
                </div>
            </div>

            {/* Turn Progress - Inline above Active Threat */}
            <Show when={props.turnPhase !== null && props.turnPhase !== undefined}>
                <div class="turn-progress-container">
                    <TurnProgress phase={props.turnPhase!} message={props.turnMessage ?? ''} />
                </div>
            </Show>

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
