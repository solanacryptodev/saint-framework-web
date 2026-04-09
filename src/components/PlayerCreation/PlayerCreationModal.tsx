import { createSignal, For, Show } from 'solid-js';
import GeneralModal from '../games/GeneralModal';
import type { PlayerCharacterTemplate, BackstoryOption, StartingItemOption } from '~/libs/types';
import './PlayerCreationModal.css';

export interface CharacterChoices {
    templateId: string | undefined;
    displayName: string;
    chosenBackstory: string | undefined;
    chosenTraits: string[];
    chosenItems: string[];
}

// ── Types ──

export interface PlayerCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: PlayerCharacterTemplate[];    // all published templates for this game
    onComplete: (choices: CharacterChoices) => void;
}

// ── Steps ──
// step 0 — character select (always shown when templates.length > 1, or auto-advance when 1)
// step 1 — prebuilt confirm  (template.kind === 'prebuilt')
// step 2 — customization     (template.kind === 'template' | 'custom')

export default function PlayerCreationModal(props: PlayerCreationModalProps) {
    const [step, setStep] = createSignal<0 | 1 | 2>(
        props.templates.length === 1 ? (props.templates[0].kind === 'prebuilt' ? 1 : 2) : 0
    );
    const [selected, setSelected] = createSignal<PlayerCharacterTemplate | null>(
        props.templates.length === 1 ? props.templates[0] : null
    );

    // Character customization state (for template flow)
    const [displayName, setDisplayName] = createSignal('');
    const [selectedBackstory, setSelectedBackstory] = createSignal<string | undefined>(undefined);
    const [selectedTraits, setSelectedTraits] = createSignal<string[]>([]);
    const [selectedItems, setSelectedItems] = createSignal<string[]>([]);
    const [activePanel, setActivePanel] = createSignal<'backstory' | 'traits' | 'items'>('backstory');

    // ── Step 0 → 1 or 2 ──
    function handleSelectConfirm() {
        const t = selected();
        if (!t) return;
        // Reset customization state for new selection
        setDisplayName('');
        setSelectedBackstory(t.backstory_options[0]?.id);
        setSelectedTraits([]);
        setSelectedItems([]);
        setActivePanel('backstory');
        setStep(t.kind === 'prebuilt' ? 1 : 2);
    }

    // ── Prebuilt confirm ──
    function handlePrebuiltConfirm() {
        const t = selected()!;
        props.onComplete({
            templateId: t.id,
            displayName: t.base_name,
            chosenBackstory: t.prebuilt_backstory ?? undefined,
            chosenTraits: t.prebuilt_traits ?? [],
            chosenItems: t.prebuilt_items ?? [],
        });
    }

    // ── Template submit ──
    function handleSubmit() {
        const t = selected()!;
        props.onComplete({
            templateId: t.id,
            displayName: displayName() || t.base_name,
            chosenBackstory: selectedBackstory(),
            chosenTraits: selectedTraits(),
            chosenItems: selectedItems(),
        });
    }

    // ── Derived ──
    const title = () => {
        if (step() === 0) return 'SELECT OPERATIVE';
        if (step() === 1) return 'CONFIRM OPERATIVE';
        return 'OPERATIVE INITIALIZATION';
    };

    const footerActions = () => {
        // Step 0 — Select screen
        if (step() === 0) return (
            <>
                <button class="pcm-btn-cancel" onClick={() => props.onClose()}>
                    CANCEL ABORT
                </button>
                <button
                    class="pcm-btn-initialize"
                    disabled={!selected()}
                    onClick={handleSelectConfirm}
                >
                    <span class="btn-diamond">◆</span>
                    DEPLOY OPERATIVE
                </button>
            </>
        );

        // Step 1 — Prebuilt confirm
        if (step() === 1) return (
            <>
                <button class="pcm-btn-cancel" onClick={() => props.templates.length > 1 ? setStep(0) : props.onClose()}>
                    {props.templates.length > 1 ? '← BACK' : 'CANCEL ABORT'}
                </button>
                <button class="pcm-btn-initialize" onClick={handlePrebuiltConfirm}>
                    <span class="btn-diamond">◆</span>
                    CONFIRM &amp; DEPLOY
                </button>
            </>
        );

        // Step 2 — Template customization
        return (
            <>
                <button class="pcm-btn-cancel" onClick={() => props.templates.length > 1 ? setStep(0) : props.onClose()}>
                    {props.templates.length > 1 ? '← BACK' : 'CANCEL ABORT'}
                </button>
                <button class="pcm-btn-initialize" onClick={handleSubmit}>
                    <span class="btn-diamond">◆</span>
                    INITIALIZE OPERATIVE
                </button>
            </>
        );
    };

    return (
        <GeneralModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={title()}
            modalType="player-creation"
            footerActions={footerActions()}
        >
            {/* ── Step 0: Character Selection Grid ── */}
            <Show when={step() === 0}>
                <div class="pcm-select-screen">
                    <p class="pcm-select-hint">
                        Choose your operative profile. Prebuilt operatives are ready to deploy immediately.
                        The custom profile lets you define your own background and loadout.
                    </p>
                    <div class="pcm-select-grid">
                        <For each={props.templates}>
                            {(t) => (
                                <div
                                    class={`pcm-select-card ${selected()?.id === t.id ? 'selected' : ''}`}
                                    onClick={() => setSelected(t)}
                                >
                                    <div class="pcm-select-card-portrait">
                                        <Show
                                            when={t.portrait_url}
                                            fallback={
                                                <svg width="48" height="56" viewBox="0 0 48 56" fill="currentColor" opacity="0.4">
                                                    <path d="M24 4 C20 4 16 8 16 14 C16 20 20 24 24 24 C28 24 32 20 32 14 C32 8 28 4 24 4 Z" />
                                                    <path d="M12 52 L12 36 C12 30 16 26 24 26 C32 26 36 30 36 36 L36 52 Z" />
                                                </svg>
                                            }
                                        >
                                            <img src={t.portrait_url!} alt={t.base_name} />
                                        </Show>
                                    </div>
                                    <div class="pcm-select-card-body">
                                        <div class="pcm-select-card-header">
                                            <span class="pcm-select-card-name">{t.base_name}</span>
                                            <span class={`pcm-select-kind-badge ${t.kind}`}>
                                                {t.kind === 'prebuilt' ? 'PREBUILT' : 'CUSTOM'}
                                            </span>
                                        </div>
                                        <p class="pcm-select-card-desc">{t.description}</p>
                                        <Show when={t.fixed_traits?.length > 0}>
                                            <div class="pcm-select-traits">
                                                <For each={t.fixed_traits.slice(0, 3)}>
                                                    {(trait) => <span class="pcm-tag">{trait}</span>}
                                                </For>
                                                <Show when={t.fixed_traits.length > 3}>
                                                    <span class="pcm-tag pcm-tag-more">+{t.fixed_traits.length - 3}</span>
                                                </Show>
                                            </div>
                                        </Show>
                                    </div>
                                    <Show when={selected()?.id === t.id}>
                                        <div class="pcm-select-check">✓</div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            {/* ── Step 1: Prebuilt Confirm ── */}
            <Show when={step() === 1 && selected()}>
                <div class="pcm-prebuilt-confirm">
                    <div class="pcm-prebuilt-portrait">
                        <Show
                            when={selected()!.portrait_url}
                            fallback={
                                <svg width="120" height="140" viewBox="0 0 48 56" fill="currentColor" opacity="0.5">
                                    <path d="M24 4 C20 4 16 8 16 14 C16 20 20 24 24 24 C28 24 32 20 32 14 C32 8 28 4 24 4 Z" />
                                    <path d="M12 52 L12 36 C12 30 16 26 24 26 C32 26 36 30 36 36 L36 52 Z" />
                                </svg>
                            }
                        >
                            <img src={selected()!.portrait_url!} alt={selected()!.base_name} />
                        </Show>
                    </div>
                    <div class="pcm-prebuilt-info">
                        <div class="pcm-prebuilt-name">{selected()!.base_name}</div>
                        <p class="pcm-prebuilt-desc">{selected()!.description}</p>

                        <Show when={selected()!.fixed_traits.length > 0}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">TRAITS</span>
                                <div class="pcm-prebuilt-tags">
                                    <For each={selected()!.fixed_traits}>
                                        {(trait) => <span class="pcm-tag">{trait}</span>}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={selected()!.prebuilt_backstory}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">ORIGIN</span>
                                <p class="pcm-prebuilt-text">{selected()!.prebuilt_backstory}</p>
                            </div>
                        </Show>

                        <Show when={selected()!.prebuilt_items && selected()!.prebuilt_items!.length > 0}>
                            <div class="pcm-prebuilt-section">
                                <span class="pcm-prebuilt-label">EQUIPMENT</span>
                                <div class="pcm-prebuilt-tags">
                                    <For each={selected()!.prebuilt_items}>
                                        {(item) => <span class="pcm-tag">{item}</span>}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* ── Step 2: Template Customization ── */}
            <Show when={step() === 2 && selected()}>
                <div class="pcm-layout">
                    {/* Left Sidebar */}
                    <div class="pcm-sidebar">
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

                    {/* Right Content */}
                    <div class="pcm-content">
                        {/* Asset Definition */}
                        <div>
                            <div class="pcm-section-label">ASSET DEFINITION</div>
                            <div class="pcm-asset-definition">
                                <div class="pcm-avatar">
                                    <Show
                                        when={selected()!.portrait_url}
                                        fallback={
                                            <svg width="48" height="56" viewBox="0 0 48 56" fill="currentColor" opacity="0.35">
                                                <path d="M24 4 C20 4 16 8 16 14 C16 20 20 24 24 24 C28 24 32 20 32 14 C32 8 28 4 24 4 Z" />
                                                <path d="M12 52 L12 36 C12 30 16 26 24 26 C32 26 36 30 36 36 L36 52 Z" />
                                            </svg>
                                        }
                                    >
                                        <img src={selected()!.portrait_url!} alt={selected()!.base_name} />
                                    </Show>
                                </div>
                                <div class="pcm-asset-info">
                                    <Show
                                        when={selected()!.allow_custom_name}
                                        fallback={
                                            <div class="pcm-field-group">
                                                <span class="pcm-field-label">DESIGNATION</span>
                                                <span class="pcm-field-value">{selected()!.base_name}</span>
                                            </div>
                                        }
                                    >
                                        <div class="pcm-field-group">
                                            <span class="pcm-field-label">DESIGNATION (CALLSIGN)</span>
                                            <input
                                                type="text"
                                                class="pcm-input"
                                                placeholder={selected()!.base_name}
                                                value={displayName()}
                                                onInput={(e) => setDisplayName(e.currentTarget.value)}
                                            />
                                        </div>
                                    </Show>
                                    <div class="pcm-field-row">
                                        <div class="pcm-field-group">
                                            <span class="pcm-field-label">ORIGIN</span>
                                            <span class="pcm-field-value">{selected()!.starting_location || 'UNKNOWN'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Backstory Panel */}
                        <Show when={activePanel() === 'backstory'}>
                            <div class="pcm-panel">
                                <div class="pcm-section-label">ORIGIN &amp; BACKGROUND</div>
                                <For each={selected()!.backstory_options}>
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

                        {/* Traits Panel */}
                        <Show when={activePanel() === 'traits'}>
                            <div class="pcm-panel">
                                <div class="pcm-section-label">ABILITIES</div>
                                <For each={selected()!.trait_options}>
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

                        {/* Items Panel */}
                        <Show when={activePanel() === 'items'}>
                            <div class="pcm-panel">
                                <div class="pcm-section-label">EQUIPMENT</div>
                                <p class="pcm-help-text">Choose up to {selected()!.max_item_picks} items</p>
                                <For each={selected()!.item_options}>
                                    {(item: StartingItemOption) => (
                                        <div
                                            class={`pcm-item-card ${selectedItems().includes(item.id) ? 'selected' : ''}`}
                                            onClick={() => {
                                                const current = selectedItems();
                                                if (current.includes(item.id)) {
                                                    setSelectedItems(current.filter(i => i !== item.id));
                                                } else if (current.length < selected()!.max_item_picks) {
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
            </Show>
        </GeneralModal>
    );
}
