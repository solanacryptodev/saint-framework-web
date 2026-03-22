# Gameplay Wiring Task

## Context

The SAINT Engine backend is complete. This task wires the frontend to it.

Three things need to happen:

1. `play.tsx` needs to be the correct version (it is — see note below)
2. `GeneralGame.tsx` needs session state, live queries, and the turn loop
3. The three panels need prop updates to reflect live world state and SAINT
   naming conventions
4. The Herald Agent needs to produce scrolling intro text when a session starts
   or resumes

Read this entire document before touching any file.

---

## Important: `play.tsx` is already correct

The file at `src/routes/play/game/[gameTitle]/play.tsx` already contains the
full implementation including `SurrealProvider`, auth guard, gameId resolution
from location state with slug fallback, and `LoadingScreen` / `ErrorScreen`
utility components. **Do not replace it with the stub version.** The stub in
the task description is an older draft.

The correct `play.tsx` already passes `gameId` and `onBack` to `GeneralGame`
and wraps it in `SurrealProvider` with `gateChildren={false}`. No changes
needed there.

---

## File 1: `src/components/games/GeneralGame.tsx`

### What it needs to become

The full game shell. Owns session state, drives the SAINT turn loop via SSE,
gates character creation through the Herald flow, and feeds live world state
into the three panels.

`SurrealProvider` is NOT added here — it already wraps this component at the
route level in `play.tsx`. Adding it here would create a second WebSocket
connection.

### Props interface

```typescript
export interface GeneralGameProps {
  gameId:       string;          // required — passed from play.tsx
  onBack?:      () => void;
  // Below are dev/preview overrides only — remove from production renders
  agentData?:   AgentProfileProps;
  missionData?: MissionPanelProps;
  intelData?:   SiteIntelligenceProps;
}
```

Remove `template`, `onCharacterCreate`, and the "Create Operative" button from
the back bar. Character creation is now owned entirely by `GeneralGame` itself.

### Signals needed

```typescript
// Session
const [sessionId,    setSessionId]    = createSignal<string | null>(null);
const [turnNumber,   setTurnNumber]   = createSignal(0);
const [sessionReady, setSessionReady] = createSignal(false);

// Scene content
const [scene,   setScene]   = createSignal<string>('');
const [options, setOptions] = createSignal<NarrativeOption[]>([]);

// Herald intro scrolling text
const [heraldText,        setHeraldText]        = createSignal<string>('');
const [heraldVisible,     setHeraldVisible]     = createSignal(false);
const [heraldScrollDone,  setHeraldScrollDone]  = createSignal(false);

// Character creation gate
const [template,        setTemplate]        = createSignal<PlayerCharacterTemplate | null>(null);
const [playerCharacter, setPlayerCharacter] = createSignal<PlayerCharacter | null>(null);
const [showModal,       setShowModal]       = createSignal(false);

// Turn progress (SSE phase messaging)
const [turnPhase,   setTurnPhase]   = createSignal<TurnProgress['phase'] | null>(null);
const [turnMessage, setTurnMessage] = createSignal('');
```

### Live queries

These use `useLiveQuery` from `SurrealProvider` — they update reactively as the
Tremor writes to the DB each turn. Import from `~/lib/SurrealProvider`.

```typescript
const liveThreads = useLiveQuery(
  () => sessionId()
    ? `SELECT * FROM world_thread
       WHERE session_id = '${sessionId()}' AND active = true
       ORDER BY urgency DESC`
    : `SELECT * FROM world_thread WHERE false`,
  []
);

const livePlayerSession = useLiveQuery(
  () => sessionId()
    ? `SELECT * FROM player_session WHERE session_id = '${sessionId()}' LIMIT 1`
    : `SELECT * FROM player_session WHERE false`,
  []
);

const liveNearbyAgents = useLiveQuery(
  () => sessionId()
    ? `SELECT * FROM world_agent
       WHERE session_id = '${sessionId()}' AND active = true AND kind != 'player'`
    : `SELECT * FROM world_agent WHERE false`,
  []
);
```

### `onMount` — session lifecycle

```typescript
onMount(async () => {
  if (!props.gameId) return;

  const res  = await fetch(`/api/games/${props.gameId}/character`, {
    credentials: 'include',
  });
  const data = await res.json();

  if (data.hasCharacter && data.existingCharacter) {
    // Returning player — resume and show Herald continuation text
    setPlayerCharacter(data.existingCharacter);
    await resumeSession(data.existingCharacter);
  } else {
    // New player — load template, show Herald intro, then creation modal
    if (data.templates?.length) setTemplate(data.templates[0]);
    await loadHeraldIntro();
  }
});
```

### Herald intro flow

The Herald produces scrolling text before the game begins. For new players it
runs before the creation modal. For returning players it runs as a brief "the
world remembers you" line before the scene loads.

```typescript
async function loadHeraldIntro() {
  const res  = await fetch('/api/narrative/herald/intro', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ gameId: props.gameId }),
  });
  const data = await res.json();

  setHeraldText(data.monologue ?? '');
  setHeraldVisible(true);
  // After scrolling completes (see HeraldScroll component),
  // handleHeraldDone() is called which shows the modal or the game
}

async function resumeSession(character: PlayerCharacter) {
  // Brief Herald line for returning players
  const res = await fetch('/api/narrative/herald/resume', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ gameId: props.gameId, characterName: character.display_name }),
  });
  const data = await res.json();
  setHeraldText(data.monologue ?? '');
  setHeraldVisible(true);

  // Also kick off the actual session resume in parallel
  startOrResumeSession(character);
}

function handleHeraldDone() {
  setHeraldVisible(false);
  setHeraldScrollDone(true);

  // If no character yet, show the creation modal now
  if (!playerCharacter() && template()) {
    setShowModal(true);
  }
}
```

### Session start/resume

```typescript
async function startOrResumeSession(character: PlayerCharacter) {
  const mode = character.session_id && character.session_id !== 'PENDING'
    ? 'resume' : 'new';

  const res = await fetch('/api/narrative/session/start', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      mode,
      gameId:            props.gameId,
      sessionId:         character.session_id,
      playerCharacterId: character.id,
      displayName:       character.display_name,
      chosenBackstory:   character.chosen_backstory,
      chosenTraits:      character.chosen_traits,
      chosenItems:       character.chosen_items,
    }),
  });

  const data = await res.json();
  setSessionId(data.sessionId);
  setTurnNumber(data.turnNumber ?? 0);
  setScene(data.scene ?? '');
  setOptions(data.options ?? []);
  setSessionReady(true);
}

function handleCharacterCreated(character: PlayerCharacter) {
  setPlayerCharacter(character);
  setShowModal(false);

  // Herald closing monologue after character creation
  fetch('/api/narrative/herald/closing', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      gameId:          props.gameId,
      displayName:     character.display_name,
      chosenBackstory: character.chosen_backstory,
      chosenTraits:    character.chosen_traits,
      chosenItems:     character.chosen_items,
    }),
  })
  .then(r => r.json())
  .then(data => {
    setHeraldText(data.monologue ?? '');
    setHeraldVisible(true);
    // After closing scroll, start the session
    // handleHeraldDone will be called by the scroll component
    // but we need it to start the session this time, not show the modal
  });

  startOrResumeSession(character);
}
```

### Turn loop (SSE)

```typescript
async function handleOptionChosen(option: NarrativeOption) {
  const sid = sessionId();
  if (!sid) return;

  setTurnPhase('tremor');
  setTurnMessage('The world shifts.');
  setOptions([]);

  const response = await fetch('/api/narrative/session/start', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      mode:             'turn',
      sessionId:        sid,
      gameId:           props.gameId,
      chosenOptionId:   option.id,
      chosenOptionText: option.text,
      worldImpact:      option.worldImpact,
      turnNumber:       turnNumber(),
    }),
  });

  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      const event = JSON.parse(part.slice(6));

      if (event.type === 'progress') {
        setTurnPhase(event.phase);
        setTurnMessage(event.message);
      } else if (event.type === 'complete') {
        setScene(event.scene);
        setOptions(event.options ?? []);
        setTurnNumber(event.turnNumber);
        setTurnPhase(null);
        setTurnMessage('');
      } else if (event.type === 'error') {
        console.error('[Turn]', event.message);
        setTurnPhase(null);
      }
    }
  }
}
```

### Panel data derivation

When the session is ready, derive panel data from live world state. Before it's
ready, fall back to mock data for the preview shell.

```typescript
// AgentProfile — driven by the player's world_agent record
// Query it separately or include it in livePlayerSession
const agentPanelData = (): AgentProfileProps => {
  if (!sessionReady()) return props.agentData ?? defaultAgentData;
  const ps = livePlayerSession()[0];
  if (!ps) return props.agentData ?? defaultAgentData;
  return {
    // Map player_session SAINT fields to panel props
    // See "Panel prop renames" section below
    ...mapPlayerSessionToAgentProps(ps),
  };
};

// MissionPanel — scene text + options from the turn output
const missionPanelData = (): MissionPanelProps => {
  if (!sessionReady()) return props.missionData ?? defaultMissionData;
  return {
    ...(props.missionData ?? defaultMissionData),
    paragraphs: scene() ? [scene()] : [],
    operations: options().map((opt, i) => ({
      id:          opt.id,
      sequence:    i + 1,
      title:       opt.text,
      method:      deriveMethod(opt),
      methodBonus: deriveMethodBonus(opt),
      risk:        deriveRisk(opt),
    })),
  };
};

// SiteIntelligence — driven by live nearby agents and location memory
const intelPanelData = (): SiteIntelligenceProps => {
  if (!sessionReady()) return props.intelData ?? defaultIntelData;
  return {
    ...(props.intelData ?? defaultIntelData),
    proximityScan: liveNearbyAgents().map(agent => ({
      id:          String(agent.id),
      name:        agent.name,
      threatLevel: agent.narrative_weight,
      awareness:   agent.awareness === 'alerted' ? 0.9
                 : agent.awareness === 'suspicious' ? 0.5 : 0.1,
      status:      agent.disposition === 'hostile' ? 'HOSTILE'
                 : agent.disposition === 'friendly' ? 'FRIENDLY' : 'NEUTRAL',
    })),
  };
};
```

### Render

```tsx
return (
  <div class="general-game">

    {props.onBack && (
      <div class="general-game-back">
        <button class="back-to-game" onClick={props.onBack}>
          ← Back to Game Details
        </button>
      </div>
    )}

    {/* Herald scrolling text — shown before game and after character creation */}
    <Show when={heraldVisible()}>
      <HeraldScroll
        text={heraldText()}
        onComplete={handleHeraldDone}
      />
    </Show>

    {/* Turn progress — shown while engine is processing */}
    <Show when={!heraldVisible() && turnPhase() !== null}>
      <TurnProgress phase={turnPhase()} message={turnMessage()} />
    </Show>

    {/* Main game UI — shown when session is ready and no overlay is active */}
    <Show when={!heraldVisible() && turnPhase() === null && sessionReady()}>
      <GameLayout
        agentPanel={<AgentProfile {...agentPanelData()} />}
        missionPanel={
          <MissionPanel
            {...missionPanelData()}
            onOptionChosen={handleOptionChosen}
          />
        }
        intelPanel={<SiteIntelligence {...intelPanelData()} />}
      />
    </Show>

    {/* Character creation modal */}
    <Show when={showModal() && template() !== null}>
      <PlayerCreationModal
        isOpen={showModal()}
        onClose={() => setShowModal(false)}
        template={template()!}
        onComplete={handleCharacterCreated}
      />
    </Show>

  </div>
);
```

---

## File 2: New component `src/components/HeraldScroll.tsx`

This renders the Herald's monologue as scrolling text. Think opening crawl —
not a spinner, not a modal. The text appears character by character or line by
line, then calls `onComplete` when done. The player can also tap/click to
skip ahead.

```typescript
interface HeraldScrollProps {
  text:       string;
  onComplete: () => void;
  speed?:     number;   // ms per character, default 28
}
```

### Behavior

- Text types out character by character at `speed` ms intervals
- A "continue" prompt fades in when complete (`press any key` or a subtle `▶`)
- Clicking anywhere skips the typewriter and shows the full text immediately,
  then waits 800ms before calling `onComplete`
- Keyboard: any key press either skips or confirms
- Style: centered, large, quiet — same aesthetic as `TurnProgress`. Dark
  background overlay. No border. No card. Just the words.
- The agent name does NOT appear here — this is the Herald speaking directly,
  not the engine machinery

### CSS direction

```css
.herald-scroll {
  position: fixed;          /* fullscreen overlay */
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  z-index: 50;
  padding: 3rem;
}

.herald-text {
  font-size: 1.1rem;
  line-height: 1.9;
  color: var(--color-text-primary);
  max-width: 560px;
  text-align: center;
  white-space: pre-wrap;
}

.herald-continue {
  margin-top: 2.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: var(--color-text-tertiary);
  animation: pulse 1.5s ease infinite;
}
```

---

## File 3: New API route `src/routes/api/narrative/herald/resume.ts`

`POST /api/narrative/herald/resume`

Called when a returning player enters a game they've already started. The
Herald produces a short 1–2 sentence line acknowledging their return — not a
full intro, just a brief "the world remembers you" beat.

```typescript
// Request body
{ gameId: string, characterName: string }

// Response
{ monologue: string }
```

The Witness Agent (not the Herald) can generate this line since it already
has full context on the world state. Use the same `buildHeraldAgent` from
`herald-agent.ts` with a shorter prompt:

```typescript
const result = await herald.generate([{
  role: 'user',
  content: `
Write a single sentence (maximum two) welcoming ${characterName} back to
${game.name}. The world has continued without them. Something has shifted.
Do not say "welcome back". Make it feel like the world noticed their absence.
  `.trim(),
}]);
```

---

## File 4: Panel prop updates — naming convention sync

The three panel components use technical SAINT field names in their prop
interfaces. Update these to match the human-readable names from the stat
rename reference.

### `AgentProfile.tsx` — prop interface renames

The section titles and label strings in the rendered JSX should use human names.
The prop interface field names can stay camelCase for TypeScript, but the
displayed labels change:

| Current displayed label | New displayed label |
|---|---|
| `NARRATIVE WEIGHT` | `STORY WEIGHT` |
| `EMOTIONAL STATE` | `MOOD` |
| `INFLUENCE REACH` | `PLAYER PULL` |
| `TRAUMA INDEX` | `DRAWN TO WOUNDS` |
| `RESOLVE` | `DRAWN TO HOPE` |
| `CURIOSITY` | `DRAWN TO MYSTERY` |
| `SUSCEPTIBILITY VECTOR` | `RESPONDS TO` |
| `MORAL` | `MORAL CHOICES` |
| `METHOD` | `METHOD CHOICES` |
| `SOCIAL` | `SOCIAL CHOICES` |
| `OPERATIONAL CAPACITY` | `ENERGY` |
| `ACTION POINTS` | `ENERGY` |
| `IDEOLOGICAL ALIGNMENT` | `BELIEFS` |

The `PsychologicalProfile` section is actually displaying the player's
`drawn_to [3]` — the gravitational signature. The three values represent
attraction to wounds (trauma axis), hope, and mystery respectively.
Label them accordingly.

Also add `initiative` and `time_horizon` as optional display items in the
profile if the data is available — these become relevant as the player's
`world_agent` record evolves.

### `MissionPanel.tsx` — `onOptionChosen` prop

Add to `MissionPanelProps`:

```typescript
onOptionChosen?: (option: NarrativeOption) => void;
```

Wire this to `OperationCard` so clicking a card calls `onOptionChosen` with
the full `NarrativeOption` object. Currently `OperationCard` has no click
handler — it's purely display. Add one.

Also add to `MissionPanelProps`:

```typescript
turnPhase?: TurnProgress['phase'] | null;  // disables options while engine runs
```

When `turnPhase` is set (engine is processing), operation cards should show as
inactive/dimmed so the player can't double-click.

### `SiteIntelligence.tsx` — label renames

| Current label | New label |
|---|---|
| `ENVIRONMENTAL ANALYSIS` | `LOCATION STATE` |
| `THREAT SIG:` | `WEIGHT:` |
| `TENSION:` | `MOOD:` |
| `COVER RATING` | (keep as is) |
| `LOCATION MEMORY` | `CONCEPT IMPRINT` |
| `PROXIMITY SCAN` | `NEARBY AGENTS` |
| `ACTIVE PROTOCOLS` | `ACTIVE CONCEPTS` |

The `CONCEPT IMPRINT` section maps to `world_location.concept_imprint` —
key/value pairs of concept names and their imprint strength. The live query
in `GeneralGame` should include the current location's concept imprint and
pass it through `intelData`.

The `NEARBY AGENTS` section maps to `liveNearbyAgents` — the agents currently
at the player's location. `threatLevel` maps to `narrative_weight`,
`awareness` maps to the agent's `awareness` field converted to a 0–1 number.

### `OperationCard.tsx`

Add `onClick` prop:

```typescript
export interface OperationCardProps {
  // ... existing fields ...
  onClick?:  () => void;
  disabled?: boolean;   // true while engine is processing
}
```

Render as visually dimmed when `disabled`. Add cursor styles and hover state
only when not disabled.

---

## File 5: `src/lib/types.ts` — add `TurnProgress`

```typescript
export interface TurnProgress {
  phase:
    | 'tremor'
    | 'eternal'
    | 'witness'
    | 'prose'
    | 'complete';
  message: string;
}
```

---

## File 6: New component `src/components/TurnProgress.tsx`

```typescript
import { Show } from 'solid-js';
import type { TurnProgress as TurnProgressType } from '~/lib/types';

interface Props {
  phase:   TurnProgressType['phase'] | null;
  message: string;
}

const AGENT_LABELS: Partial<Record<TurnProgressType['phase'], string>> = {
  tremor:  'the tremor',
  eternal: 'the eternal',
  witness: 'the witness',
  prose:   'the prose',
};

export default function TurnProgress(props: Props) {
  return (
    <Show when={props.phase && props.phase !== 'complete'}>
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

CSS — add to your global stylesheet or a `TurnProgress.css`:

```css
.turn-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  animation: tp-fade 0.4s ease;
}

@keyframes tp-fade {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.turn-progress-message {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0;
}

.turn-progress-agent {
  font-size: 0.7rem;
  color: var(--color-text-tertiary);
  letter-spacing: 0.12em;
}
```

---

## Summary table

| File | Type | Priority |
|---|---|---|
| `src/routes/play/game/[gameTitle]/play.tsx` | No change needed | — |
| `src/components/games/GeneralGame.tsx` | Full rewrite | High |
| `src/components/HeraldScroll.tsx` | New component | High |
| `src/components/TurnProgress.tsx` | New component | High |
| `src/components/games/AgentProfile.tsx` | Label renames only | Medium |
| `src/components/games/MissionPanel.tsx` | Add `onOptionChosen` + `turnPhase` props | Medium |
| `src/components/games/SiteIntelligence.tsx` | Label renames only | Medium |
| `src/components/games/OperationCard.tsx` | Add `onClick` + `disabled` props | Medium |
| `src/routes/api/narrative/herald/resume.ts` | New API route | Medium |
| `src/lib/types.ts` | Add `TurnProgress` interface | Low |

---

## What not to do

- Do not add `SurrealProvider` to `GeneralGame` — it already wraps it in
  `play.tsx`
- Do not add the "Create Operative" button back to the back bar — character
  creation is triggered automatically by `onMount`
- Do not show `TurnProgress` and `HeraldScroll` at the same time — they are
  mutually exclusive overlays
- Do not make `HeraldScroll` a modal with a border or card — it should feel
  like the game talking to the player, not a UI element
- Do not rename the TypeScript prop interface field names to match the display
  label renames — only the rendered strings change, not the code