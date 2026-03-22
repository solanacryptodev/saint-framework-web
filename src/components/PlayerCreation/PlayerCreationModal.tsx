import { createSignal, For, Show } from 'solid-js';
import GeneralModal from '../games/GeneralModal';
import type { PlayerCharacterTemplate, BackstoryOption, StartingItemOption, PlayerCharacter } from '~/libs/types';
import './PlayerCreationModal.css';

export interface CharacterChoices {
    templateId: string | null;
    displayName: string;
    chosenBackstory: string | null;
    chosenTraits: string[];
    chosenItems: string[];
}

// ── Types ──

export interface PlayerCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: PlayerCharacterTemplate;
    onComplete: (choices: CharacterChoices) => void;
}

// ── Component ──

export default function PlayerCreationModal(props: PlayerCreationModalProps) {
    const isPrebuilt = () => props.template.kind === "prebuilt";

    // Character customization state (for templates)
    const [displayName, setDisplayName] = createSignal(
        props.template.allow_custom_name ? "" : props.template.base_name
    );
    const [selectedBackstory, setSelectedBackstory] = createSignal<string | null>(
        props.template.backstory_options[0]?.id ?? null
    );
    const [selectedTraits, setSelectedTraits] = createSignal<string[]>([]);
    const [selectedItems, setSelectedItems] = createSignal<string[]>([]);

    // Panel state
    const [activePanel, setActivePanel] = createSignal<'backstory' | 'traits' | 'items'>('backstory');

    // Handle prebuilt confirm
    function handlePrebuiltConfirm() {
        props.onComplete({
            templateId: props.template.id ?? null,
            displayName: props.template.base_name,
            chosenBackstory: props.template.prebuilt_backstory ?? null,
            chosenTraits: props.template.prebuilt_traits ?? [],
            chosenItems: props.template.prebuilt_items ?? [],
        });
    }

    function handleSubmit() {
        console.log("displayName", displayName());
        console.log("selectedBackstory", selectedBackstory());
        console.log("selectedTraits", selectedTraits());
        console.log("selectedItems", selectedItems());
        props.onComplete({
            templateId: props.template.id ?? null,
            displayName: displayName() || props.template.base_name,
            chosenBackstory: selectedBackstory(),
            chosenTraits: selectedTraits(),
            chosenItems: selectedItems(),
        });
    }
    // Preset agents for mock data fallback
    const presetAgents = [
        { id: 'cipher', name: 'AGENT CIPHER', icon: '⚿' },
        { id: 'vanguard', name: 'SPECIALIST VANGUARD', icon: '⚔' },
        { id: 'ghost', name: 'OPERATIVE GHOST', icon: '⚿' },
    ];

    return (
        <GeneralModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={isPrebuilt() ? "CONFIRM OPERATIVE" : "OPERATIVE INITIALIZATION"}
            modalType="player-creation"
            footerActions={
                <>
                    <button class="pcm-btn-cancel" onClick={() => props.onClose()}>
                        CANCEL ABORT
                    </button>
                    <Show
                        when={isPrebuilt()}
                        fallback={
                            <button class="pcm-btn-initialize" onClick={handleSubmit}>
                                <span class="btn-diamond">◆</span>
                                INITIALIZE OPERATIVE
                            </button>
                        }
                    >
                        <button class="pcm-btn-initialize" onClick={handlePrebuiltConfirm}>
                            <span class="btn-diamond">◆</span>
                            CONFIRM & DEPLOY
                        </button>
                    </Show>
                </>
            }
        >
            <Show
                when={isPrebuilt()}
                fallback={
                    // Template flow: show character customization panels
                    <div class="pcm-layout">
                        {/* ── Left Sidebar ── */}
                        <div class="pcm-sidebar">
                            <div class="pcm-sidebar-section">
                                <div class="pcm-sidebar-label">CHARACTER OPTIONS</div>
                                <For each={presetAgents}>
                                    {(agent) => (
                                        <div class="pcm-sidebar-item">
                                            <span class="item-icon">{agent.icon}</span>
                                            {agent.name}
                                        </div>
                                    )}
                                </For>
                            </div>

                            <div class="pcm-sidebar-section">
                                <div class="pcm-sidebar-label">CUSTOMIZATION</div>
                                <div
                                    class={`pcm-sidebar-item ${activePanel() === 'backstory' ? 'active' : ''}`}
                                    onClick={() => setActivePanel('backstory')}
                                >
                                    <span class="item-icon">◆</span>
                                    ORIGIN
                                </div>
                                <div
                                    class={`pcm-sidebar-item ${activePanel() === 'traits' ? 'active' : ''}`}
                                    onClick={() => setActivePanel('traits')}
                                >
                                    <span class="item-icon">◆</span>
                                    ABILITIES
                                </div>
                                <div
                                    class={`pcm-sidebar-item ${activePanel() === 'items' ? 'active' : ''}`}
                                    onClick={() => setActivePanel('items')}
                                >
                                    <span class="item-icon">◆</span>
                                    EQUIPMENT
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
                                        <Show
                                            when={props.template.allow_custom_name}
                                            fallback={
                                                <div class="pcm-field-group">
                                                    <span class="pcm-field-label">DESIGNATION</span>
                                                    <span class="pcm-field-value">{props.template.base_name}</span>
                                                </div>
                                            }
                                        >
                                            <div class="pcm-field-group">
                                                <span class="pcm-field-label">DESIGNATION (CALLSIGN)</span>
                                                <input
                                                    type="text"
                                                    class="pcm-input"
                                                    placeholder={props.template.base_name}
                                                    value={displayName()}
                                                    onInput={(e) => setDisplayName(e.currentTarget.value)}
                                                />
                                            </div>
                                        </Show>
                                        <div class="pcm-field-row">
                                            <div class="pcm-field-group">
                                                <span class="pcm-field-label">ORIGIN</span>
                                                <span class="pcm-field-value">{props.template.starting_location || "UNKNOWN"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Panel Content */}
                            <Show when={activePanel() === 'backstory'}>
                                <div class="pcm-panel">
                                    <div class="pcm-section-label">ORIGIN & BACKGROUND</div>
                                    <For each={props.template.backstory_options}>
                                        {(option: BackstoryOption) => (
                                            <div
                                                class={`pcm-option-card ${selectedBackstory() === option.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedBackstory(option.id)}
                                            >
                                                <div class="pcm-option-header">
                                                    <span class="pcm-option-name">{option.label}</span>
                                                    <Show when={selectedBackstory() === option.id}>
                                                        <span class="pcm-option-check">✓</span>
                                                    </Show>
                                                </div>
                                                <p class="pcm-option-desc">{option.description}</p>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>

                            <Show when={activePanel() === 'traits'}>
                                <div class="pcm-panel">
                                    <div class="pcm-section-label">ABILITIES</div>
                                    <For each={props.template.trait_options}>
                                        {(trait) => (
                                            <div
                                                class={`pcm-trait-card ${selectedTraits().includes(trait) ? 'selected' : ''}`}
                                                onClick={() => {
                                                    const current = selectedTraits();
                                                    if (current.includes(trait)) {
                                                        setSelectedTraits(current.filter(t => t !== trait));
                                                    } else {
                                                        setSelectedTraits([...current, trait]);
                                                    }
                                                }}
                                            >
                                                <span class="pcm-trait-name">{trait}</span>
                                                <Show when={selectedTraits().includes(trait)}>
                                                    <span class="pcm-trait-check">✓</span>
                                                </Show>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>

                            <Show when={activePanel() === 'items'}>
                                <div class="pcm-panel">
                                    <div class="pcm-section-label">EQUIPMENT</div>
                                    <p class="pcm-help-text">Choose up to {props.template.max_item_picks} items</p>
                                    <For each={props.template.item_options}>
                                        {(item: StartingItemOption) => (
                                            <div
                                                class={`pcm-item-card ${selectedItems().includes(item.id) ? 'selected' : ''}`}
                                                onClick={() => {
                                                    const current = selectedItems();
                                                    if (current.includes(item.id)) {
                                                        setSelectedItems(current.filter(i => i !== item.id));
                                                    } else if (current.length < props.template.max_item_picks) {
                                                        setSelectedItems([...current, item.id]);
                                                    }
                                                }}
                                            >
                                                <div class="pcm-option-header">
                                                    <span class="pcm-option-name">{item.name}</span>
                                                    <Show when={selectedItems().includes(item.id)}>
                                                        <span class="pcm-option-check">✓</span>
                                                    </Show>
                                                </div>
                                                <p class="pcm-option-desc">{item.description}</p>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </div>
                }
            >
                {/* Prebuilt flow: show confirmation card */}
                <div class="pcm-prebuilt-confirm">
                    <div class="pcm-prebuilt-portrait">
                        <svg width="120" height="140" viewBox="0 0 48 56" fill="currentColor" opacity="0.5">
                            <path d="M24 4 C20 4 16 8 16 14 C16 20 20 24 24 24 C28 24 32 20 32 14 C32 8 28 4 24 4 Z" />
                            <path d="M12 52 L12 36 C12 30 16 26 24 26 C32 26 36 30 36 36 L36 52 Z" />
                        </svg>
                    </div>
                    <div class="pcm-prebuilt-info">
                        <div class="pcm-prebuilt-name">{props.template.base_name}</div>
                        <p class="pcm-prebuilt-desc">{props.template.description}</p>

                        <Show when={props.template.fixed_traits.length > 0}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">TRAITS</span>
                                <div class="pcm-prebuilt-tags">
                                    <For each={props.template.fixed_traits}>
                                        {(trait) => <span class="pcm-tag">{trait}</span>}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={props.template.prebuilt_backstory}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">ORIGIN</span>
                                <p class="pcm-prebuilt-text">{props.template.prebuilt_backstory}</p>
                            </div>
                        </Show>

                        <Show when={props.template.prebuilt_items && props.template.prebuilt_items.length > 0}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">EQUIPMENT</span>
                                <div class="pcm-prebuilt-tags">
                                    <For each={props.template.prebuilt_items}>
                                        {(item) => <span class="pcm-tag">{item}</span>}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
        </GeneralModal>
    );
}
