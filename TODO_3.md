# SAINT Engine — Schema & Type Consolidation Super Task

## Context

The SAINT Engine has been through rapid iteration and the schema definitions,
TypeScript interfaces, and runtime code have drifted apart. This task brings
everything back into sync permanently so no manual Surrealist queries are ever
needed again. Every schema change must be reflected in: the SurrealDB schema
definition, the TypeScript interface, the parser (where relevant), and every
file that reads or writes that table.

Read this entire document before touching any file.

---

## The Core Problem

There are three layers that must stay in sync:

1. **SurrealDB schema** — defined in `applyPlayerCharacterSchema()` in
   `src/lib/player-character.ts` and `applySchema()` in `src/lib/surreal.ts`
2. **TypeScript interfaces** — currently split between `src/lib/player-character.ts`
   and `src/lib/types.ts`, with duplicates and outdated shapes
3. **Runtime code** — API routes, agents, and tools that read/write these tables

When these drift, SurrealDB SCHEMAFULL silently drops unknown fields on write,
returns validation errors on read, or rejects null where it expects NONE.

---

## Critical SurrealDB 2.0.x Rules

These rules apply to every schema definition and every DB write in the codebase.
Violating them causes silent data loss or hard errors.

**Rule 1 — No null for optional fields.** `option<T>` fields must receive
`undefined`, not `null`. SurrealDB 2.0.x rejects JavaScript `null` for
`option<string>`, `option<float>`, etc. Replace every `field: null` with
`field: undefined` or omit the field entirely when writing records.

**Rule 2 — Nested object arrays need explicit field definitions.** A field
typed `array<object>` will store the array but silently drop all properties
inside each object. Every nested property must be explicitly defined:
```sql
DEFINE FIELD backstory_options[*]             ON table TYPE object;
DEFINE FIELD backstory_options[*].id          ON table TYPE string;
DEFINE FIELD backstory_options[*].label       ON table TYPE string;
DEFINE FIELD backstory_options[*].description ON table TYPE string;
```

**Rule 3 — Record IDs must be stringified.** When writing a record ID to a
`TYPE string` field, always call `String(record.id)`. SurrealDB returns
`RecordId` objects from queries — passing them directly to string fields fails.

**Rule 4 — No `IF NOT EXISTS` when redefining.** `DEFINE FIELD IF NOT EXISTS`
will not update an already-defined field. To change a field's type or default,
use `DEFINE FIELD` without `IF NOT EXISTS`. In the schema boot functions, use
`IF NOT EXISTS` only for initial creation. For fields that have changed type
(like `template_id` changing from `string` to `option<string>`), use plain
`DEFINE FIELD` to force the update.

**Rule 5 — Permissions require comma separation.** In SurrealDB 2.0.x:
```sql
-- CORRECT
PERMISSIONS FOR select WHERE session_id = $auth.id, FOR create, update, delete NONE

-- WRONG (parse error)
PERMISSIONS FOR select WHERE session_id = $auth.id FOR create, update, delete NONE
```

**Rule 6 — `ALTER TABLE` for permissions.** To add or change table-level
permissions on an existing table without dropping data, use `ALTER TABLE`:
```sql
ALTER TABLE world_agent PERMISSIONS
  FOR select WHERE session_id = $auth.id,
  FOR create, update, delete NONE;
```

**Rule 7 — game_id is the sanitized alphanumeric ID.** Never store the full
`"game:w3up5kt73v7pjmhjloav"` format. Always strip the table prefix before
storing. Use `sanitizeGameId()` from `src/lib/game.ts` everywhere.

---

## File 1: `src/lib/player-character.ts`

This file owns both the schema and the runtime helpers for character tables.
It needs a complete rewrite of its schema block and interface definitions.

### 1A — Schema: `applyPlayerCharacterSchema()`

Replace the entire function body with the following. Note: use plain
`DEFINE FIELD` (no `IF NOT EXISTS`) for fields that have changed type so they
actually update on boot.

```sql
-- ── player_character_template ──────────────────────────────────────────────

DEFINE TABLE IF NOT EXISTS player_character_template SCHEMAFULL;

-- Scope
DEFINE FIELD IF NOT EXISTS game_id   ON player_character_template TYPE string;

-- New fields (kind, status) — no IF NOT EXISTS so they update if type changed
DEFINE FIELD kind   ON player_character_template TYPE string DEFAULT 'template';
DEFINE FIELD status ON player_character_template TYPE string DEFAULT 'published';

-- Identity
DEFINE FIELD IF NOT EXISTS base_name     ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS description   ON player_character_template TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS portrait_url  ON player_character_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS lore_node_id  ON player_character_template TYPE option<string>;

-- Customization arrays
DEFINE FIELD IF NOT EXISTS fixed_traits  ON player_character_template TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS trait_options ON player_character_template TYPE array<string> DEFAULT [];

-- Nested object arrays — must define [*] fields or content is dropped
DEFINE FIELD IF NOT EXISTS backstory_options             ON player_character_template TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS backstory_options[*]          ON player_character_template TYPE object;
DEFINE FIELD IF NOT EXISTS backstory_options[*].id       ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS backstory_options[*].label    ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS backstory_options[*].description ON player_character_template TYPE string;

DEFINE FIELD IF NOT EXISTS item_options              ON player_character_template TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS item_options[*]           ON player_character_template TYPE object;
DEFINE FIELD IF NOT EXISTS item_options[*].id        ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS item_options[*].name      ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS item_options[*].description ON player_character_template TYPE string;
DEFINE FIELD IF NOT EXISTS item_options[*].lore_node_id ON player_character_template TYPE option<string>;

-- Constraints
DEFINE FIELD IF NOT EXISTS max_item_picks    ON player_character_template TYPE int DEFAULT 1;
DEFINE FIELD IF NOT EXISTS allow_custom_name ON player_character_template TYPE bool DEFAULT true;
DEFINE FIELD IF NOT EXISTS allow_portrait    ON player_character_template TYPE bool DEFAULT true;
DEFINE FIELD IF NOT EXISTS starting_location ON player_character_template TYPE string DEFAULT '';

-- Prebuilt character resolved fields (null for template kind)
DEFINE FIELD IF NOT EXISTS prebuilt_backstory ON player_character_template TYPE option<string>;
DEFINE FIELD IF NOT EXISTS prebuilt_traits    ON player_character_template TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS prebuilt_items     ON player_character_template TYPE array<string> DEFAULT [];

-- Source
DEFINE FIELD IF NOT EXISTS raw_markdown ON player_character_template TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS created_at   ON player_character_template TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at   ON player_character_template TYPE datetime DEFAULT time::now();

-- Index: NOT unique — multiple templates per game allowed
DEFINE INDEX IF NOT EXISTS pct_game   ON player_character_template COLUMNS game_id;
DEFINE INDEX IF NOT EXISTS pct_status ON player_character_template COLUMNS game_id, status;

-- ── player_character ───────────────────────────────────────────────────────

DEFINE TABLE IF NOT EXISTS player_character SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS game_id    ON player_character TYPE string;
DEFINE FIELD IF NOT EXISTS player_id  ON player_character TYPE string;
DEFINE FIELD IF NOT EXISTS session_id ON player_character TYPE string;

-- Changed from string to option<string> — use plain DEFINE FIELD to update
DEFINE FIELD template_id ON player_character TYPE option<string>;
DEFINE FIELD kind        ON player_character TYPE string DEFAULT 'template';

DEFINE FIELD IF NOT EXISTS display_name     ON player_character TYPE string;
DEFINE FIELD IF NOT EXISTS portrait_url     ON player_character TYPE option<string>;
DEFINE FIELD IF NOT EXISTS chosen_backstory ON player_character TYPE option<string>;
DEFINE FIELD IF NOT EXISTS chosen_traits    ON player_character TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS chosen_items     ON player_character TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS world_actor_id   ON player_character TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at       ON player_character TYPE datetime DEFAULT time::now();

-- Index: NOT unique on session_id — "PENDING" would conflict on multiple attempts
DEFINE INDEX pc_player_game ON player_character COLUMNS player_id, game_id;
DEFINE INDEX pc_session     ON player_character COLUMNS session_id;
```

### 1B — Types: replace the interfaces at the bottom of the file

Remove the existing `BackstoryOption`, `StartingItemOption`, `PlayerCharacterTemplate`,
and `PlayerCharacter` interface definitions from this file. They are being moved
to `src/lib/types.ts`. Add an import at the top:

```typescript
import type {
  CharacterKind,
  CharacterStatus,
  BackstoryOption,
  StartingItemOption,
  PlayerCharacterTemplate,
  PlayerCharacter,
  CharacterChoices,
} from "./types";
```

Also remove `ParsedPlayerCharacterSection` — it becomes part of `types.ts` too.

### 1C — Functions: add missing helpers

Add these four functions. The old `getPlayerCharacterTemplate` (singular) can
stay as a legacy alias but these are what the routes now use:

```typescript
export async function getCharacterTemplates(
  gameId: string,
  status?: string
): Promise<PlayerCharacterTemplate[]> {
  const db = await getDB();
  const query = status
    ? `SELECT * FROM player_character_template WHERE game_id = $gid AND status = $status`
    : `SELECT * FROM player_character_template WHERE game_id = $gid`;
  const [rows] = await db.query<[PlayerCharacterTemplate[]]>(query, { gid: gameId, status });
  return rows ?? [];
}

export async function getCharacterTemplateById(
  templateId: string
): Promise<PlayerCharacterTemplate | null> {
  const db = await getDB();
  const rawId = templateId.includes(':') ? templateId.split(':')[1] : templateId;
  const [rows] = await db.query<[PlayerCharacterTemplate[]]>(
    `SELECT * FROM type::thing('player_character_template', $id) LIMIT 1`,
    { id: rawId }
  );
  return rows?.[0] ?? null;
}

export async function getPlayerCharacterForGame(
  playerId: string,
  gameId: string
): Promise<PlayerCharacter | null> {
  const db = await getDB();
  const [rows] = await db.query<[PlayerCharacter[]]>(
    `SELECT * FROM player_character
     WHERE player_id = $pid AND game_id = $gid
     ORDER BY created_at DESC LIMIT 1`,
    { pid: playerId, gid: gameId }
  );
  return rows?.[0] ?? null;
}

export async function createPlayerCharacter(
  pc: Omit<PlayerCharacter, "id" | "created_at">
): Promise<PlayerCharacter> {
  const db = await getDB();
  const [created] = await db.create<PlayerCharacter>(new Table("player_character")).content({
    ...pc,
    // Coerce undefined to NONE for optional fields — never pass null
    template_id:      pc.template_id      ?? undefined,
    portrait_url:     pc.portrait_url     ?? undefined,
    chosen_backstory: pc.chosen_backstory ?? undefined,
    world_actor_id:   pc.world_actor_id   ?? undefined,
    // Stringify any RecordId objects
    template_id: pc.template_id ? String(pc.template_id) : undefined,
  });
  return created;
}
```

### 1D — `upsertPlayerCharacterTemplate()`: update for new fields

The existing upsert function only sets the old fields. Update its UPDATE query
to include `kind`, `status`, `portrait_url`, `prebuilt_backstory`,
`prebuilt_traits`, `prebuilt_items`, `updated_at`. Also remove the unique
game_id lookup — now match on `game_id AND base_name` so multiple templates
per game work:

```typescript
export async function upsertPlayerCharacterTemplate(
  template: Omit<PlayerCharacterTemplate, "id" | "created_at" | "updated_at">
): Promise<PlayerCharacterTemplate> {
  const db = await getDB();

  // Match on game_id + base_name — not just game_id
  const [existing] = await db.query<[PlayerCharacterTemplate[]]>(
    `SELECT * FROM player_character_template
     WHERE game_id = $gid AND base_name = $name LIMIT 1`,
    { gid: template.game_id, name: template.base_name }
  );

  if (existing?.[0]) {
    const [updated] = await db.query<[PlayerCharacterTemplate[]]>(
      `UPDATE $id SET
         kind = $kind, status = $status,
         description = $description, portrait_url = $portrait_url,
         fixed_traits = $fixed_traits, backstory_options = $backstory_options,
         trait_options = $trait_options, item_options = $item_options,
         max_item_picks = $max_item_picks,
         allow_custom_name = $allow_custom_name, allow_portrait = $allow_portrait,
         starting_location = $starting_location, lore_node_id = $lore_node_id,
         prebuilt_backstory = $prebuilt_backstory, prebuilt_traits = $prebuilt_traits,
         prebuilt_items = $prebuilt_items, raw_markdown = $raw_markdown,
         updated_at = time::now()`,
      { id: String(existing[0].id), ...template }
    );
    return updated[0];
  }

  const [created] = await db.create<PlayerCharacterTemplate>(
    "player_character_template",
    { ...template, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  );
  return created;
}
```

---

## File 2: `src/lib/types.ts`

Add all character-related types here and remove duplicates from
`player-character.ts`. The canonical location for all shared types is `types.ts`.

### Add these type definitions

```typescript
// ── Character types ──────────────────────────────────────────────────────

export type CharacterKind   = "template" | "prebuilt" | "custom";
export type CharacterStatus = "draft" | "published" | "archived";

export interface BackstoryOption {
  id: string;
  label: string;               // was "name" — renamed for clarity
  description: string;
  trait_modifiers?: Record<string, number>;
  starting_location_override?: string;
}

export interface StartingItemOption {
  id: string;
  name: string;
  description: string;
  lore_node_id?: string;
}

export interface LeverageData {
  leverage_type: "secret" | "family" | "debt" | "crime" | "desire";
  potency: number;
  moral_cost: number;
  discovery_method: string;
  expiration?: string;
}

export interface DramaDebt {
  accumulated: number;
  turns_since_impact: number;
  last_impact_turn: number;
  tolerance: number;
}

export interface PlayerCharacterTemplate {
  id?: string;
  game_id: string;
  kind: CharacterKind;
  status: CharacterStatus;
  base_name: string;
  description: string;
  portrait_url?: string;
  lore_node_id?: string;
  fixed_traits: string[];
  backstory_options: BackstoryOption[];
  trait_options: string[];
  item_options: StartingItemOption[];
  max_item_picks: number;
  allow_custom_name: boolean;
  allow_portrait: boolean;
  starting_location: string;
  prebuilt_backstory?: string;
  prebuilt_traits?: string[];
  prebuilt_items?: string[];
  raw_markdown: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerCharacter {
  id?: string;
  game_id: string;
  player_id: string;
  session_id: string;
  template_id?: string;          // undefined for custom characters
  kind: CharacterKind;
  display_name: string;
  portrait_url?: string;
  chosen_backstory?: string;
  chosen_traits: string[];
  chosen_items: string[];
  world_actor_id?: string;
  created_at?: string;
}

// What the PlayerCreationModal passes up to GeneralGame
export interface CharacterChoices {
  templateId:      string | undefined;
  displayName:     string;
  chosenBackstory: string | undefined;
  chosenTraits:    string[];
  chosenItems:     string[];
}

export interface ParsedPlayerCharacterSection {
  base_name: string;
  kind: CharacterKind;
  status: CharacterStatus;
  description: string;
  fixed_traits: string[];
  backstory_options: BackstoryOption[];
  trait_options: string[];
  item_options: StartingItemOption[];
  max_item_picks: number;
  allow_custom_name: boolean;
  allow_portrait: boolean;
  starting_location: string;
  prebuilt_backstory?: string;
  prebuilt_traits?: string[];
  prebuilt_items?: string[];
  raw_markdown: string;
}
```

### Remove from `types.ts`

Any duplicate declarations of the above that currently exist in `types.ts`
under a `// ── Player character` comment block.

### Update `WorldAgent`

Replace the existing `WorldAgent` interface with:

```typescript
export interface WorldAgent {
  id: string;
  game_id: string;
  session_id: string;
  lore_ref: string;
  location_id: string | null;
  name: string;
  kind: "player" | "npc" | "faction_rep";
  disposition: "hostile" | "neutral" | "friendly" | "unknown";
  awareness: "unaware" | "suspicious" | "alerted" | "hostile" | "allied";
  goal_current: string;
  goal_hidden: string;
  state: Record<string, unknown>;
  active: boolean;
  narrative_weight: number;
  gravitational_signature: [number, number, number];
  emotional_charge: number;
  influence_resonance: number;
  vector_susceptibility: [number, number, number];
  concept_affinity: Record<string, number>;
  plausibility_threshold: number;
  coherence_contribution: number;
  agency_quota: number;
  emergence_potential: number;
  temporal_focus: number;
  known_leverage: LeverageData[];
  hidden_leverage: LeverageData[];
  leverage_resistance: number;
  drama_debt: DramaDebt;
}
```

---

## File 3: `src/lib/parser-fixes` (update `parsePlayerCharacterSection`)

The parser in `player-character.ts` has two issues that prevent templates from
being written correctly during World Forge.

### 3A — `BackstoryOption.name` → `BackstoryOption.label`

Every place the parser constructs a `BackstoryOption` object, change `name:`
to `label:`. There are three locations:

```typescript
// Line ~255 — named backstory match
currentBackstory = {
  id: slugify(namedMatch[1]),
  label: namedMatch[1].trim(),      // was: name
  description: namedMatch[2].trim(),
};

// Line ~265 — continuation without name
backstory_options.push({
  id: slugify(text),
  label: text,                      // was: name
  description: "",
});
```

### 3B — Add `kind` and `status` parsing

Add two new cases to the switch statement inside `parsePlayerCharacterSection`:

```typescript
case "kind":
  // "template" | "prebuilt" | "custom"
  kind = (["template", "prebuilt", "custom"].includes(value.toLowerCase())
    ? value.toLowerCase()
    : "template") as CharacterKind;
  break;

case "status":
  // "draft" | "published" | "archived"
  status = (["draft", "published", "archived"].includes(value.toLowerCase())
    ? value.toLowerCase()
    : "published") as CharacterStatus;
  break;
```

Add `let kind: CharacterKind = "template"` and
`let status: CharacterStatus = "published"` to the variable declarations at the
top of the function. Include them in the return object.

### 3C — Add `prebuilt_backstory`, `prebuilt_traits`, `prebuilt_items` parsing

For prebuilt characters, the lore bible specifies resolved values directly.
Add parsing for:

```typescript
case "prebuilt_backstory":
  prebuilt_backstory = value;
  break;

case "prebuilt_traits":
  prebuilt_traits = value.split(",").map(t => t.trim()).filter(Boolean);
  break;

case "prebuilt_items":
  prebuilt_items = value.split(",").map(i => i.trim()).filter(Boolean);
  break;
```

### 3D — Multi-character section chunking in `lore-ingestion-agent.ts`

The chunker currently treats `## Player Characters` as a single chunk. With
multiple pre-built characters under that heading, each `###` sub-section must
become its own chunk.

In the chunking logic, when processing a `###` heading and the current section
type is `player_character`, close the current chunk and open a new one instead
of appending. Each `### Character Name` sub-section gets its own
`parsePlayerCharacterSection()` call and its own `upsertPlayerCharacterTemplate()`
write.

### 3E — game_id in lore ingestion

The upsert call in `lore-ingestion-agent.ts` currently writes
`game_id: "PENDING"`. Update `initializeLoreGraph` to accept `gameId` as a
parameter and pass the sanitized game ID directly:

```typescript
// In lore-ingestion-agent.ts
playerCharacterTemplate = await upsertPlayerCharacterTemplate({
  game_id: gameId,   // real sanitized ID, not "PENDING"
  kind:    "template",
  status:  "published",
  ...parsed,
  lore_node_id: pcLoreNode ? String(pcLoreNode.id) : undefined,
});
```

Update the calling route (`src/routes/api/lore/ingest.ts`) to pass the game ID
to `initializeLoreGraph`.

---

## File 4: `src/lib/game.ts`

### Add `sanitizeGameId`

```typescript
export function sanitizeGameId(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = String(raw);
  const colon = s.indexOf(":");
  return colon >= 0 ? s.slice(colon + 1) : s;
}
```

### Update `getGame` to sanitize its input

```typescript
export async function getGame(gameId: string): Promise<GameRecord | null> {
  const db = await getDB();
  const cleanId = sanitizeGameId(gameId);
  // use cleanId in the query
}
```

---

## File 5: `src/routes/api/games/[gameId]/character.ts`

### GET handler — sanitize gameId

```typescript
const cleanId = sanitizeGameId(gameId);
const templates = await getCharacterTemplates(cleanId, "published");
// ...
existingCharacter = await getPlayerCharacterForGame(player.id, cleanId);
```

### POST handler — sanitize gameId and fix null → undefined

```typescript
const cleanId = sanitizeGameId(gameId);

// In createPlayerCharacter call:
const character = await createPlayerCharacter({
  game_id:          cleanId,
  player_id:        player.id,
  session_id:       "PENDING",
  template_id:      template.id ? String(template.id) : undefined,
  kind:             template.kind,
  display_name:     displayName,
  portrait_url:     template.portrait_url ?? undefined,
  chosen_backstory: chosenBackstory       ?? undefined,
  chosen_traits:    chosenTraits,
  chosen_items:     chosenItems,
  world_actor_id:   undefined,
});

// Fix template ownership check to use sanitized IDs
if (template.game_id !== cleanId) {
  return json({ error: "Template does not belong to this game" }, { status: 400 });
}
```

---

## File 6: `src/routes/api/narrative/session/start.ts`

### Sanitize gameId everywhere it's used

```typescript
import { sanitizeGameId } from "~/lib/game";

// At the top of each handler
const cleanGameId = sanitizeGameId(body.gameId);
```

Pass `cleanGameId` to `startSession()`, `resumeSession()`, and all DB queries.

---

## File 7: `src/components/games/GeneralGame.tsx`

### Sanitize gameId at the component boundary

Instead of sanitizing in every fetch call, sanitize once at the top:

```typescript
const cleanGameId = () => {
  const id = props.gameId;
  return id.includes(':') ? id.split(':')[1] : id;
};
```

Replace every `props.gameId` in fetch URLs with `cleanGameId()`.

### Loading state

Ensure `loading` signal is `true` by default and `setLoading(false)` is in a
`finally` block so it always clears, even on error:

```typescript
const [loading, setLoading] = createSignal(true);

onMount(async () => {
  try {
    // ...fetch logic
  } catch (err) {
    console.error('[GeneralGame] onMount', err);
  } finally {
    setLoading(false);   // always runs
  }
});
```

---

## File 8: `src/components/PlayerCreation/PlayerCreationModal.tsx`

### Update `onComplete` prop type

```typescript
import type { CharacterChoices } from "~/lib/types";

export interface PlayerCreationModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  template:   PlayerCharacterTemplate;
  onComplete: (choices: CharacterChoices) => void;
}
```

### Update `handlePrebuiltConfirm` and `handleSubmit`

Both functions should pass `CharacterChoices` up, not a fake `PlayerCharacter`:

```typescript
function handlePrebuiltConfirm() {
  props.onComplete({
    templateId:      props.template.id,
    displayName:     props.template.base_name,
    chosenBackstory: props.template.prebuilt_backstory,
    chosenTraits:    props.template.prebuilt_traits    ?? [],
    chosenItems:     props.template.prebuilt_items     ?? [],
  });
}

function handleSubmit() {
  props.onComplete({
    templateId:      props.template.id,
    displayName:     displayName() || props.template.base_name,
    chosenBackstory: selectedBackstory() ?? undefined,
    chosenTraits:    selectedTraits(),
    chosenItems:     selectedItems(),
  });
}
```

### Fix `BackstoryOption.name` → `BackstoryOption.label` in render

```tsx
// Was: option.name
// Now:
<span class="pcm-option-name">{option.label}</span>
```

---

## File 9: `src/mastra/world-init-agent.ts`

### Pass sanitized gameId to all tools

The `initializeWorldGraph` function receives `gameId` — ensure it's sanitized
before passing to the agent prompt and tool calls:

```typescript
import { sanitizeGameId } from "../lib/game";

export async function initializeWorldGraph(
  loreSummary: string,
  loreNodes: LoreNode[],
  gameId: string,            // ADD this parameter
  onProgress?: ...
) {
  const cleanGameId = sanitizeGameId(gameId);
  // Pass cleanGameId in the agent prompt so every tool call includes it
}
```

---

## Summary Table

| File | Priority | Key Changes |
|---|---|---|
| `src/lib/player-character.ts` | Critical | Full schema rewrite, new functions, remove duplicate types |
| `src/lib/types.ts` | Critical | Add all character types, fix BackstoryOption.label, add LeverageData/DramaDebt |
| `src/lib/game.ts` | Critical | Add sanitizeGameId, use it in getGame |
| `src/routes/api/games/[gameId]/character.ts` | Critical | Sanitize gameId, fix null→undefined |
| `src/components/games/GeneralGame.tsx` | Critical | Sanitize gameId at boundary, loading state finally block |
| `src/components/PlayerCreation/PlayerCreationModal.tsx` | High | CharacterChoices type, label rename, remove fake PlayerCharacter construction |
| `src/routes/api/narrative/session/start.ts` | High | Sanitize gameId throughout |
| `src/mastra/lore-ingestion-agent.ts` | High | Pass real gameId, multi-template chunking, BackstoryOption.label |
| `src/mastra/world-init-agent.ts` | High | Accept and pass sanitized gameId |

---

## Verification Queries

After deploying, run these in Surrealist to confirm the schema is correct:

```sql
-- Confirm nested fields are defined
INFO FOR TABLE player_character_template;

-- Should show backstory_options[*].label, item_options[*].name etc.

-- Confirm no PENDING records are stuck
SELECT * FROM player_character WHERE session_id = "PENDING";

-- Confirm game_ids are sanitized (no "game:" prefix)
SELECT game_id FROM player_character_template;
SELECT game_id FROM world_agent LIMIT 1;

-- Confirm template has content
SELECT backstory_options, item_options, trait_options 
FROM player_character_template 
LIMIT 1;
```

---

## What NOT to Do

- Do not use `DEFINE TABLE ... IF NOT EXISTS` for fields that have changed type.
  `IF NOT EXISTS` skips the definition if the field exists — the old type stays.
  Use plain `DEFINE FIELD` for any field whose type has changed.
- Do not pass JavaScript `null` to any SurrealDB optional field. Use `undefined`.
- Do not store the full `"game:abc123"` format in `game_id` fields. Always strip.
- Do not add a `UNIQUE` index on `session_id` in `player_character` — the value
  is `"PENDING"` until the session starts and multiple failed attempts will
  conflict.
- Do not duplicate type definitions between `player-character.ts` and `types.ts`.
  `types.ts` is the single source of truth for all shared interfaces.