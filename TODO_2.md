# SAINT Engine — Gameplay Turn Progress

## What This Is

Every time a player makes a choice, the SAINT Engine runs four agents in
sequence. This takes anywhere from 5 to 15 seconds. Right now the UI goes
silent and waits. This task replaces that silence with something that feels
like the world reacting.

No spinners. No progress bars. No percentages. Just three or four lines of
text that appear and fade as each agent runs — written in the language of the
world, not the language of a server.

```
The world shifts.
· the tremor ·
```

Then:

```
The world is reading you.
· the witness ·
```

Then the scene arrives. The player never sees "loading" or "processing" or a
rotating circle. They see the engine working — but through the fiction's eyes.

---

## New Type

Add to `src/lib/types.ts`:

```typescript
export interface TurnProgress {
  phase:
    | "tremor"    // Tremor is processing the player's choice
    | "eternal"   // Eternal is updating permanent lore (rare)
    | "witness"   // Witness is reading the world and building options
    | "prose"     // Prose Agent is writing the scene description
    | "complete"; // Scene and options are ready — stop showing progress
  message: string;
}
```

---

## The Messages

These are the only player-facing strings. They rotate slightly so the same
line doesn't repeat every turn.

**`tremor`** — varies based on the weight of the player's choice:
- Dramatic choice (high moral or method delta): `"The world shakes."`
- Quiet choice (low deltas): `"A ripple moves through the world."`
- Default fallback: `"The world shifts."`

**`eternal`** — only fires on significant turns where something becomes
permanent lore. Should feel notable — the player just changed history:
- `"The world remembers this."`
- `"Something becomes permanent."`
- `"History is being written."`

**`witness`** — rotates so it doesn't feel mechanical:
- `"The world is reading you."`
- `"Eyes are watching."`
- `"The threads are gathering."`
- `"Something is taking shape."`

**`prose`**:
- `"Finding the words…"`

**`complete`** — no message. The scene arriving is the signal.

---

## Engine Changes (`src/mastra/ace-engine.ts`)

The `onProgress` callback already exists in `runTurn()` but only fires at
coarse boundaries. Update it to fire at each agent transition with the right
message:

```typescript
async runTurn(input: TurnInput, onProgress?: (update: TurnProgress) => void) {

  // Determine tremor message from world impact weight
  const isDramatic =
    Math.abs(input.worldImpact?.vectorDeltas?.moral_stance ?? 0) > 0.2 ||
    Math.abs(input.worldImpact?.vectorDeltas?.approach     ?? 0) > 0.2;

  const tremorMessages = isDramatic
    ? ["The world shakes."]
    : ["The world shifts.", "A ripple moves through the world."];

  const witnessMessages = [
    "The world is reading you.",
    "Eyes are watching.",
    "The threads are gathering.",
    "Something is taking shape.",
  ];

  const eternalMessages = [
    "The world remembers this.",
    "Something becomes permanent.",
    "History is being written.",
  ];

  // ── TREMOR ──────────────────────────────────────────────────────────
  onProgress?.({
    phase:   "tremor",
    message: tremorMessages[input.turnNumber % tremorMessages.length],
  });
  const tremorResult = await this.tremorAgent.generate(...);

  // ── ETERNAL (conditional) ────────────────────────────────────────────
  const eternalSignal = this.extractEternalSignal(tremorResult.text);
  if (eternalSignal && eternalSignal.significance >= this.config.eternalSignificanceThreshold) {
    onProgress?.({
      phase:   "eternal",
      message: eternalMessages[input.turnNumber % eternalMessages.length],
    });
    await this.eternalAgent.generate(...);
  }

  // ── WITNESS ──────────────────────────────────────────────────────────
  onProgress?.({
    phase:   "witness",
    message: witnessMessages[input.turnNumber % witnessMessages.length],
  });
  const witnessResult = await this.witnessAgent.generate(...);

  // ── PROSE ────────────────────────────────────────────────────────────
  onProgress?.({
    phase:   "prose",
    message: "Finding the words…",
  });
  const proseResult = await this.proseAgent.generate(...);

  // ── COMPLETE ─────────────────────────────────────────────────────────
  onProgress?.({ phase: "complete", message: "" });

  // ... rest of runTurn
}
```

---

## API Route Changes (`src/routes/api/narrative/session/start.ts`)

The `handleTurn` function currently returns a JSON response after `runTurn()`
finishes. Switch it to a `ReadableStream` that emits SSE events as each agent
completes, so the client gets progress in real time.

```typescript
async function handleTurn(player, body) {
  const { sessionId, gameId, chosenOptionId, chosenOptionText, worldImpact, turnNumber } = body;

  let engine = getEngineFromCache(sessionId);
  if (!engine) {
    const resumed = await resumeSession(sessionId);
    if (!resumed) return json({ error: "Session not found" }, { status: 404 });
    engine = resumed.engine;
  }

  // Switch from json() to SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const output = await engine.runTurn(
          {
            sessionId,
            gameId,
            playerId:         player.id,
            chosenOptionId,
            chosenOptionText: chosenOptionText ?? "",
            worldImpact:      worldImpact      ?? {},
            turnNumber:       turnNumber       ?? 1,
          },
          // onProgress fires at each agent transition
          (progress: TurnProgress) => send({ type: "progress", ...progress })
        );

        // Update turn_number in DB
        const db = await getDB();
        await db.query(
          `UPDATE game_session SET turn_number = $tn, last_active_at = time::now() WHERE session_id = $sid`,
          { tn: output.beat.turnNumber, sid: sessionId }
        );

        // Final payload — scene + options
        send({
          type:       "complete",
          scene:      output.sceneDescription,
          options:    output.options,
          phaseState: output.phaseState,
          eternalRan: output.eternalRan,
          turnNumber: output.beat.turnNumber,
        });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Turn failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
```

---

## Client-Side Changes

Wherever the gameplay component currently calls
`POST /api/narrative/session/start` with `mode: "turn"` and reads a JSON
response — switch it to read the SSE stream instead.

```typescript
// SolidJS signals needed in the gameplay component
const [turnPhase,   setTurnPhase]   = createSignal<TurnProgress["phase"] | null>(null);
const [turnMessage, setTurnMessage] = createSignal<string>("");

async function submitChoice(option: NarrativeOption) {
  setTurnPhase("tremor");  // show progress UI immediately on click

  const response = await fetch("/api/narrative/session/start", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({
      mode:             "turn",
      sessionId:        currentSessionId(),
      gameId:           props.gameId,
      chosenOptionId:   option.id,
      chosenOptionText: option.text,
      worldImpact:      option.worldImpact,
      turnNumber:       turnNumber(),
    }),
  });

  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const event = JSON.parse(part.slice(6));

      if (event.type === "progress") {
        setTurnPhase(event.phase);
        setTurnMessage(event.message);

      } else if (event.type === "complete") {
        setScene(event.scene);
        setOptions(event.options);
        setTurnNumber(event.turnNumber);
        setTurnPhase(null);      // hide progress, scene takes over
        setTurnMessage("");

      } else if (event.type === "error") {
        console.error("[Turn]", event.message);
        setTurnPhase(null);
      }
    }
  }
}
```

---

## New Component (`src/components/TurnProgress.tsx`)

A single focused component. It receives the current phase and message and
renders nothing when the turn is not in flight.

The design: message centered, large, quiet. Agent name underneath in small
muted text. Text fades in on phase change. No animation when the scene arrives
— the scene replacing it is the transition.

```tsx
// src/components/TurnProgress.tsx
import { Show, createMemo } from "solid-js";
import type { TurnProgress } from "~/lib/types";

interface Props {
  phase:   TurnProgress["phase"] | null;
  message: string;
}

const AGENT_LABELS: Partial<Record<TurnProgress["phase"], string>> = {
  tremor:  "the tremor",
  eternal: "the eternal",
  witness: "the witness",
  prose:   "the prose",
};

export default function TurnProgressDisplay(props: Props) {
  return (
    <Show when={props.phase && props.phase !== "complete"}>
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
```

Minimal CSS (add to your stylesheet):

```css
.turn-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0);   }
}

.turn-progress-message {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0;
}

.turn-progress-agent {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  letter-spacing: 0.1em;
  text-transform: lowercase;
}
```

Apply it in the gameplay route by conditionally rendering this component where
the scene normally shows, while `turnPhase()` is non-null:

```tsx
<Show
  when={!turnPhase()}
  fallback={<TurnProgressDisplay phase={turnPhase()} message={turnMessage()} />}
>
  {/* Normal scene + options UI */}
</Show>
```

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `TurnProgress` interface |
| `src/mastra/ace-engine.ts` | Emit `onProgress` at each agent transition with narrative messages |
| `src/routes/api/narrative/session/start.ts` | Switch `mode: "turn"` handler from JSON response to SSE stream |
| `src/components/TurnProgress.tsx` | New component — renders the in-between state |
| `src/routes/play/game/[gameTitle]/play.tsx` | Read SSE stream, manage `turnPhase` + `turnMessage` signals, render `TurnProgress` |

---

## Rules

- Never use "loading", "processing", "generating", or "waiting" in any
  player-facing string.
- Never show a spinner or progress bar.
- The `complete` phase emits no message — the scene arriving is the signal.
- The Eternal message (`"The world remembers this."`) should only appear on
  turns where the Eternal actually ran. Don't show it every turn or it loses
  meaning. The `eternalRan` boolean on the output tells you if it fired.
- The agent label underneath (`· the tremor ·`) uses the human names from the
  SAINT framework — these are already part of the game's fictional layer.
  Players who notice them will feel like they're seeing inside the machine.
  That's intentional.