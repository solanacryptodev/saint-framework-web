// src/components/TurnProgress.tsx
//
// Displays the current SAINT engine phase while processing a turn.
// Shown as an overlay during SSE stream processing.
//
// Usage:
//   <TurnProgress phase={turnPhase()} message={turnMessage()} />

import { Show } from "solid-js";
import type { TurnProgress as TurnProgressType } from "~/libs/types";

interface Props {
    phase: TurnProgressType["phase"] | null;
    message: string;
}

const AGENT_LABELS: Partial<Record<TurnProgressType["phase"], string>> = {
    tremor: "the tremor",
    eternal: "the eternal",
    witness: "the witness",
    prose: "the prose",
};

export default function TurnProgress(props: Props) {
    return (
        <Show when={props.phase !== null && props.phase !== "complete"}>
            <div class="turn-progress">
                <p class="turn-progress-message">{props.message}</p>
                <Show when={AGENT_LABELS[props.phase!]}>
                    <span class="turn-progress-agent">
                        · {AGENT_LABELS[props.phase!]} ·
                    </span>
                </Show>
            </div>
        </Show>
    );
}
