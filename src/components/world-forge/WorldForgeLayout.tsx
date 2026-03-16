"use client";
// src/routes/create/world-forge.tsx
// /create/world-forge
//
// Three-act creation pipeline:
//   Act 1 — Upload:     drop zone, world name/tagline, create game record
//   Act 2 — Forge:      live agent log + entity cards crystallizing in real time
//   Act 3 — Manifest:   review + edit all entities, attach images, launch
//
// On launch → navigates to /play/[gameId]

import { createSignal, onMount, For, Show, Switch, Match, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useRequireAuth } from "~/libs/AuthProvider";
import { useForge } from "./ForgeContext";
import "./WorldForgeLayout.css";

// ── Types ──────────────────────────────────────────────────────────────────

interface EntityCard {
    surreal_id: string;
    name: string;
    kind: string;
    description: string;
    properties: Record<string, unknown>;
    image: string | null;
    edited: boolean;
}

// ── Types ──────────────────────────────────────────────────────────────────

const KIND_META: Record<string, { icon: string; color: string; glow: string }> = {
    character: { icon: "◈", color: "#c084fc", glow: "#c084fc22" },
    faction: { icon: "⬡", color: "#f97316", glow: "#f9731622" },
    location: { icon: "◎", color: "#34d399", glow: "#34d39922" },
    item: { icon: "◇", color: "#fbbf24", glow: "#fbbf2422" },
    concept: { icon: "○", color: "#60a5fa", glow: "#60a5fa22" },
    event: { icon: "◆", color: "#f87171", glow: "#f8717122" },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function WorldForgeLayout() {
    const navigate = useNavigate();
    const forge = useForge();

    let logContainerRef: HTMLDivElement | undefined;

    // In WorldForgePageContent, after the logLines signal updates:
    createEffect(() => {
        forge.logLines(); // track signal
        setTimeout(() => {
            if (logContainerRef) logContainerRef.scrollTop = logContainerRef.scrollHeight;
        }, 10);
    });

    onMount(async () => {
        useRequireAuth();
    });

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div class="wf-root">
            <div class="wf-header">
                <h2 class="wf-title">The World Forge</h2>
            </div>
            {/* ── ACT 2: Forging ──────────────────────────────────────────── */}
            <Switch>
                <Match when={forge.stage() === "forging"}>
                    <div class="wf-forge-stage">

                        {/* Left: pipeline + log */}
                        <div class="wf-forge-left">
                            <div class="wf-section-label">INITIALIZATION PIPELINE</div>

                            {/* Stage indicators */}
                            <div style={{ "margin-bottom": "24px" }}>
                                {[
                                    { id: "parse", label: "Chunking", sub: "Markdown parser" },
                                    { id: "lore", label: "Lore Graph", sub: "Ingestion Agent" },
                                    { id: "world", label: "World Graph", sub: "World Init Agent" },
                                    { id: "complete", label: "Complete", sub: "Both graphs live" },
                                ].map((step, i) => {
                                    const idx = forge.phaseIndex();
                                    const done = idx > i;
                                    const active = idx === i;
                                    return (
                                        <div class="wf-pipeline-step">
                                            <Show when={i < 3}>
                                                <div class="wf-pipeline-line" style={{ background: done ? "#7c3aed33" : "#0f172a" }} />
                                            </Show>
                                            <div
                                                class={`wf-pipeline-dot${active ? " active" : ""}`}
                                                style={{
                                                    border: `1px solid ${active ? "#c084fc" : done ? "#7c3aed44" : "#1e293b"}`,
                                                    background: active ? "rgba(192,132,252,0.12)" : done ? "rgba(124,58,237,0.08)" : "transparent",
                                                    color: active ? "#c084fc" : done ? "#7c3aed" : "#1e293b",
                                                    "box-shadow": active ? "0 0 10px rgba(192,132,252,0.25)" : "none",
                                                }}
                                            >
                                                {done ? "✓" : i + 1}
                                            </div>
                                            <div class="wf-pipeline-info">
                                                <div class="wf-pipeline-label" style={{ "font-weight": active ? "600" : "400", color: active ? "#e2e8f0" : done ? "#475569" : "#1e293b" }}>{step.label}</div>
                                                <div class="wf-pipeline-sub" style={{ color: active ? "#c084fc" : "#1e293b" }}>{step.sub}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Progress */}
                            <div style={{ "margin-bottom": "20px" }}>
                                <div class="wf-progress-header">
                                    <span>{forge.statusMsg()}</span>
                                    <span class="wf-progress-percent">{Math.round(forge.progress())}%</span>
                                </div>
                                <div class="wf-progress-track">
                                    <div class="wf-progress-fill" style={{ width: `${forge.progress()}%` }} />
                                </div>
                            </div>

                            {/* Stats */}
                            <div class="wf-stats-grid">
                                {[
                                    { label: "Nodes", value: forge.entities().length, color: "#c084fc" },
                                    { label: "Edges", value: Math.floor(forge.entities().length * 1.4), color: "#34d399" },
                                    { label: "Threads", value: forge.entities().length > 14 ? 4 : 0, color: "#f87171" },
                                ].map(c => (
                                    <div class="wf-mini-stat">
                                        <div class="wf-stat-value" style={{ color: c.color }}>{c.value}</div>
                                        <div class="wf-stat-name">{c.label.toUpperCase()}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Log */}
                            <div class="wf-section-label">AGENT LOG</div>
                            <div ref={el => logContainerRef = el} class="wf-log-box">
                                <For each={forge.logLines()}>
                                    {(line) => <div class="wf-log-line" style={{ color: line.color }}>{line.text}</div>}
                                </For>
                                <Show when={forge.logLines().length === 0}>
                                    <div class="wf-empty-log">Waiting for agents…</div>
                                </Show>
                            </div>
                        </div>

                        {/* Right: entity cards */}
                        <div class="wf-forge-right">
                            <div class="wf-forge-right-header">
                                <div class="wf-section-label">EXTRACTED ENTITIES</div>
                                <span class="wf-entity-count">{forge.entities().length} found</span>
                            </div>
                            <div style={{ flex: 1, "overflow-y": "auto", display: "flex", "flex-wrap": "wrap", gap: "8px", "align-content": "flex-start" }}>
                                <For each={forge.entities()}>
                                    {(entity, i) => {
                                        const meta = KIND_META[entity.kind] ?? KIND_META.concept;
                                        return (
                                            <div
                                                class="wf-entity-card"
                                                style={{
                                                    border: `1px solid ${meta.color}22`,
                                                    "animation-delay": `${i() * 0.02}s`,
                                                }}
                                            >
                                                <div class="wf-entity-card-accent" style={{ background: `linear-gradient(90deg,transparent,${meta.color}55,transparent)` }} />
                                                <div class="wf-entity-card-header">
                                                    <span style={{ color: meta.color, "font-size": "11px" }}>{meta.icon}</span>
                                                    <span class="wf-entity-card-name">{entity.name}</span>
                                                </div>
                                                <div class="wf-entity-card-kind" style={{ color: meta.color }}>{entity.kind}</div>
                                            </div>
                                        );
                                    }}
                                </For>
                                <Show when={forge.entities().length === 0}>
                                    <div class="wf-empty-entities">
                                        Entities appear as the agents extract them…
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </div>
                </Match>

                {/* ── ACT 3: Manifest ─────────────────────────────────────────── */}
                <Match when={forge.stage() === "manifest"}>
                    <div class="wf-manifest-stage">

                        {/* Sidebar */}
                        <div class="wf-manifest-sidebar">
                            <div style={{ "margin-bottom": "20px" }}>
                                <div class="wf-section-label">WORLD</div>
                                <div class="wf-manifest-world-name">{forge.worldName()}</div>
                                <div class="wf-manifest-world-tagline">{forge.worldTagline()}</div>
                            </div>

                            <div style={{ "margin-bottom": "20px" }}>
                                <div class="wf-section-label">STATS</div>
                                {[
                                    { label: "Lore nodes", value: forge.entities().length, color: "#c084fc" },
                                    { label: "World actors", value: forge.entities().filter(e => e.kind === "character").length, color: "#34d399" },
                                    { label: "Threads", value: 4, color: "#f87171" },
                                    { label: "Warnings", value: forge.warnings().length, color: "#fbbf24" },
                                ].map(stat => (
                                    <div class="wf-stat-row">
                                        <span class="wf-stat-label">{stat.label}</span>
                                        <span style={{ color: stat.color }}>{stat.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ "margin-bottom": "20px" }}>
                                <div class="wf-section-label">FILTER</div>
                                <For each={["all", "character", "faction", "location", "item", "concept", "event"]}>
                                    {(k) => {
                                        const meta = KIND_META[k] ?? { icon: "◉", color: "#64748b" };
                                        const count = k === "all" ? forge.entities().length : (forge.kindCounts()[k] ?? 0);
                                        if (count === 0 && k !== "all") return null;
                                        return (
                                            <button
                                                onClick={() => forge.setKindFilter(k)}
                                                class={`wf-filter-btn${forge.kindFilter() === k ? " active" : ""}`}
                                            >
                                                <div class="wf-filter-icon">
                                                    <span style={{ "font-size": "10px", color: k === "all" ? "#64748b" : meta.color }}>{k === "all" ? "◉" : meta.icon}</span>
                                                    <span class="wf-filter-label" style={{ color: forge.kindFilter() === k ? "#e2e8f0" : "#64748b" }}>{k}</span>
                                                </div>
                                                <span class="wf-filter-count" style={{ color: forge.kindFilter() === k ? "#c084fc" : "#334155" }}>{count}</span>
                                            </button>
                                        );
                                    }}
                                </For>
                            </div>

                            <Show when={forge.warnings().length > 0}>
                                <div>
                                    <div class="wf-section-label" style={{ color: "#fbbf24" }}>⚠ WARNINGS</div>
                                    <For each={forge.warnings()}>
                                        {(w) => (
                                            <div class="wf-warning">{w}</div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>

                        {/* Main grid */}
                        <div class="wf-manifest-main">
                            {/* Top bar */}
                            <div class="wf-manifest-top-bar">
                                <div>
                                    <span class="wf-manifest-top-name">{forge.worldName()}</span>
                                    <span class="wf-manifest-top-tagline">{forge.worldTagline()}</span>
                                </div>
                                <button
                                    onClick={forge.handleLaunch}
                                    disabled={forge.launching()}
                                    class="wf-launch-btn"
                                >
                                    {forge.launching() ? "Launching…" : "▶  Launch World"}
                                </button>
                            </div>

                            {/* Entity grid */}
                            <div class="wf-entity-grid">
                                <For each={forge.filteredEntities()}>
                                    {(entity) => (
                                        <ManifestCard
                                            entity={entity}
                                            isEditing={forge.editingId() === entity.surreal_id}
                                            onEdit={() => forge.setEditingId(entity.surreal_id)}
                                            onClose={() => forge.setEditingId(null)}
                                            onUpdate={(updated) => forge.setEntities(es => es.map(e => e.surreal_id === entity.surreal_id ? updated : e))}
                                            gameId={forge.gameId() ?? ""}
                                        />
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>
                </Match>

                {/* ── Launched overlay ─────────────────────────────────────────── */}
                <Match when={forge.stage() === "launched"}>
                    <div class="wf-launch-overlay">
                        <div class="wf-launch-content">
                            <div class="wf-launch-icon">◈</div>
                            <div class="wf-launch-title">{forge.worldName()}</div>
                            <div class="wf-launch-status">WORLD IS READY</div>
                            <div class="wf-launch-entering">
                                Entering…
                            </div>
                        </div>
                    </div>
                </Match>
            </Switch>
        </div>
    );
}

// ── Manifest Entity Card ───────────────────────────────────────────────────

function ManifestCard(props: {
    entity: EntityCard;
    isEditing: boolean;
    onEdit: () => void;
    onClose: () => void;
    onUpdate: (e: EntityCard) => void;
    gameId: string;
}) {
    const meta = () => KIND_META[props.entity.kind] ?? KIND_META.concept;
    const [localName, setLocalName] = createSignal(props.entity.name);
    const [localDesc, setLocalDesc] = createSignal(props.entity.description);
    let fileInputRef: HTMLInputElement | undefined;

    function save() {
        props.onUpdate({ ...props.entity, name: localName(), description: localDesc(), edited: true });
        props.onClose();
    }

    async function handleImageUpload(file: File) {
        const imageUrl = URL.createObjectURL(file);
        props.onUpdate({ ...props.entity, image: imageUrl });

        // Persist asset binding
        if (props.gameId) {
            await fetch(`/api/games/${props.gameId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entityAsset: { loreNodeId: props.entity.surreal_id, imageUrl } }),
                credentials: "include",
            });
        }
    }

    return (
        <div
            class="wf-manifest-card"
            style={{
                border: `1px solid ${props.isEditing ? meta().color + "55" : "#1e293b"}`,
                "box-shadow": props.isEditing ? `0 0 24px ${meta().glow}` : "none",
            }}
        >
            {/* Accent line */}
            <div class="wf-card-accent" style={{ background: `linear-gradient(90deg,transparent,${meta().color},transparent)` }} />

            {/* Image slot */}
            <div
                onClick={() => fileInputRef?.click()}
                class="wf-card-image-slot"
                style={{
                    background: props.entity.image
                        ? `url(${props.entity.image}) center/cover`
                        : `linear-gradient(135deg, ${meta().glow}, rgba(15,23,42,0.2))`,
                }}
            >
                <Show when={!props.entity.image}>
                    <div class="wf-image-placeholder">
                        <div class="wf-image-placeholder-icon" style={{ color: meta().color }}>{meta().icon}</div>
                        <div class="wf-image-placeholder-text" style={{ color: meta().color }}>+ IMAGE</div>
                    </div>
                </Show>
                <input ref={el => fileInputRef = el} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleImageUpload(f); }} />
            </div>

            <div class="wf-card-body">
                <div class="wf-card-header">
                    <div class="wf-card-kind">
                        <span style={{ color: meta().color, "font-size": "10px" }}>{meta().icon}</span>
                        <span class="wf-kind-label" style={{ color: meta().color }}>{props.entity.kind}</span>
                        <Show when={props.entity.edited}>
                            <span class="wf-edited-badge">✦ edited</span>
                        </Show>
                    </div>
                    <Show when={!props.isEditing}>
                        <button onClick={props.onEdit} class="wf-card-edit-btn">
                            EDIT
                        </button>
                    </Show>
                </div>

                <Show when={props.isEditing} fallback={
                    <div>
                        <div class="wf-card-name">{props.entity.name}</div>
                        <Show when={props.entity.description}>
                            <div class="wf-card-desc">
                                {props.entity.description}
                            </div>
                        </Show>
                        <Show when={!props.entity.description}>
                            <div class="wf-card-empty-desc">No description — click Edit to add one</div>
                        </Show>
                    </div>
                }>
                    <div class="wf-card-edit-form">
                        <input value={localName()} onInput={e => setLocalName((e.target as HTMLInputElement).value)}
                            class="wf-input" placeholder="Name" />
                        <textarea value={localDesc()} onInput={e => setLocalDesc((e.target as HTMLTextAreaElement).value)}
                            class="wf-input" style={{ "min-height": "60px", resize: "vertical" }} placeholder="Description" />
                        <div class="wf-card-edit-actions">
                            <button onClick={save} class="wf-card-save-btn">Save</button>
                            <button onClick={props.onClose} class="wf-card-cancel-btn">✕</button>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}

