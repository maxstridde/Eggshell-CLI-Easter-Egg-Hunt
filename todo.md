# Eggshell — Improvement Backlog

## Bugs

- [x] **`sudo cd /root` bypasses `adminUnlocked` prerequisite** *(fixed)*
- [x] **Password cancel submits empty string to `onSubmit`** *(fixed)*
- [x] **`edit` prints `"saved"` even when `onEdit` rolls back the state** *(fixed)*
- [x] **`wifi list` hardcodes output instead of reading `/etc/wifi.json`** *(fixed)*
- [x] **`showIntro` doesn't block input** *(fixed)*

- [ ] **Stage 4 (`knowsSudoPassword`) is never reset if the decoded value changes**
  Fine for current game; fragile if puzzle changes.

- [x] **`touch`-created files not visible via `cd`** — `cd` now also checks `userCreated` files and returns "not a directory" correctly *(fixed)*

- [x] **`base64 -d` does not work on user-created files** — already supported; confirmed working *(fixed)*

- [x] **`save` command stops working after long sessions** — switched to UTF-8-safe TextEncoder base64 in both `save` command and autosave *(fixed)*

- [x] **`/etc` shown incorrectly in map panel** — map now shows full filenames for all dirs *(fixed)*

---

## Phase A — Bug fixes & polish (self-contained, one session)

Tackle all of the above open bugs plus small UX corrections. No architecture changes needed.

- [x] Fix `touch`-created file path resolution — `cd <user-file>` now correctly says "not a directory"
- [x] Fix `base64 -d` on user-created files — already supported in Phase 2; confirmed working
- [x] Fix `save` UTF-8 crash — both `save` command and autosave now use TextEncoder/TextDecoder for UTF-8 safe base64
- [x] Fix `/etc` map display — all dirs now show full filenames (no extension stripping)
- [x] **`sudo_clue.b64` → renamed to `sudo_clue.json`** and stage 4 hint text updated
- [x] **Stage 2 quest hint: token must be a `.txt` file** — hint text updated; check relaxed to accept any `token.*` or `token` filename
- [x] **User-created dirs/files not shown on map** — already implemented in Phase 2; confirmed working
- [x] **`default_user` field: add inline comment + admin color theme** — comment added; admin theme changed to gold/amber

---

## Phase B — Game design & hint system revisions (one session)

- [ ] **Hint system: show hint at current difficulty, not one level easier**
  Update `stageHint()` in `stage.ts` to return hints matching the *current* difficulty, not bumped easier. Also update the todo/docs table in this file accordingly.

- [ ] **Hint repeat counter: suggest lowering difficulty on second ask**
  Track how many times each stage's hint has been requested (add `hintAskedCount: Record<number, number>` to `GameState`). On the second request for the same stage, append a suggestion: *"If you're stuck, try `difficulty easy` for more guidance, then set it back with `difficulty <level>`."*

- [ ] **Eggs & praise: add positive reinforcement**
  Each `eggN.txt` file content should include warm, encouraging praise (e.g. *"You found it! Brilliant work — keep going!"*). Also update the hint/stage revision instructions in this file: **hint and stage text must always be encouraging and positive in tone.**

- [ ] **Stage counter: handle deliberate stage-skipping**
  `stageOf()` currently returns the lowest incomplete stage. If a player skips ahead (e.g. creates the magic dir before connecting WiFi), the stage counter can show the wrong stage. Decision: keep directory locks as the authoritative gate (folders stay locked until the predicate clears), and make `stageOf()` derive the stage purely from lock predicates rather than individual boolean flags where possible. Evaluate trade-offs before implementing — the lock predicates are already the ground truth.

- [ ] **`quit` / main-menu command**
  Add a `quit` command (hidden from `help`) that pauses the game and shows the start/intro screen again. Entering the shell from there continues the session (no data loss). The command should feel slightly ominous ("returning to main menu…") but not delete anything. Also add a visible `back` or `menu` alias that does the same but appears in help.

---

## Phase C — Architecture scaling (planned — Phase 3)

Refactor before adding more stages or worlds. Build on top of Phase A + B fixes.

### Planned directory structure

```
src/
  App.tsx                  — layout shell, routing between screens
  terminal/
    Terminal.tsx           — scrollback + input loop
    EditorModal.tsx        — extracted from App.tsx
    InlinePasswordForm.tsx — extracted from App.tsx
    MapPanel.tsx           — new: explored-areas sidebar
  game/
    fs.ts                  — FsNode + buildFilesystem (keep, may split per-world)
    commands.ts            — command dispatch (keep, slim down)
    stage.ts               — stageOf + stageLabel (keep)
    hints.ts               — new: per-stage hint strings keyed by difficulty
    save.ts                — new: serialize / deserialize GameState
    difficulty.ts          — new: Difficulty type + hint-level logic
  worlds/                  — new: one file per world/chapter
    world1.ts              — current 6-stage easter egg hunt
    world2.ts              — future expansion
  types.ts                 — shared interfaces (GameState, FsNode, Difficulty, etc.)
  utils/cn.ts
```

### Key refactors

1. **Extract terminal components** — `EditorModal`, `InlinePasswordForm`, `MapPanel` into `src/terminal/`.
2. **Split types** — move `GameState`, `FsNode`, `Difficulty` into `src/types.ts`.
3. **World loader** — `worlds/world1.ts` exports `{ filesystem, hints, stages }`. App selects world at startup.
4. **hints.ts** — `getHint(stage, difficulty): string` replaces scattered hint strings.
5. **save.ts** — `exportSave(state): string` / `importSave(str): GameState | null`.
6. **Dynamic file content** — `content` field in FsNode accepts `(state: GameState) => string` so clue files can show difficulty-appropriate text. *(Required for: in-game clue text per difficulty, deferred from Phase 2)*

---

## Phase D — v2.0: Level Builder Architecture

> **Target: v2.0.** The engine (commands, terminal UI, save system) becomes world-agnostic. Anyone can write a new world without touching engine code.

### Problem

World content (filesystem nodes, lock predicates, stage text, `onEdit` callbacks) is currently hardcoded alongside the engine. Adding a second world or letting a teacher build custom puzzles requires editing engine files and TypeScript types.

### Goal

A `worlds/` directory where each world is a self-contained module. The engine loads a world at startup and knows nothing about its specific content.

### Planned structure

```
src/
  worlds/
    eggshell/          — current 6-stage easter egg hunt (extracted)
      fs.ts            — buildFilesystem() for this world
      stages.ts        — STAGES array for this world
      state.ts         — initial state + flag names
      logic.ts         — onEdit callbacks + lock predicates (code boundary)
    world2/            — future expansion slot
  engine/
    types.ts           — WorldDef, FsNode, GameState interfaces (generic)
    commands.ts        — command handlers (world-agnostic)
    stage.ts           — stageOf, stageHint (unchanged API)
    save.ts            — serialize/deserialize
```

### Key design decisions

- [ ] **Generic `GameState.flags: Record<string, boolean>`** — replace hardcoded booleans (`wifiConnected`, `createdMagicDir`, etc.) with a generic flag map. Each world declares its own flag names. This is the central prerequisite for world-agnosticism.
- [ ] **`WorldDef` interface** — `{ id, filesystem, stages, initialState, logic }` exported from each world module.
- [ ] **World loader** — App selects a world at startup (config or URL param). For v1.0 there is only one world; the loader is a thin shim.
- [ ] **`content: (state) => string` on FsNode** — allow file content to be a function so clue text can adapt to difficulty or player progress (also required for Phase C dynamic content).
- [ ] **No JSON serialization of predicates** — lock predicates and `onEdit` handlers remain TypeScript code in `logic.ts`. Content (strings, stage descriptions, hints) can be extracted to JSON/YAML for non-programmer editing.

---

## Phase E — Future features (later)

- [ ] **Tab autocompletion (silent)**
  Experienced users should be able to complete commands/paths with Tab. Do NOT mention this feature in UI or help text — silent reward for real shell users.

- [ ] **Debug-mode easter egg (special trophy)**
  When `debug_mode = on` is set in `secrets.cfg`, unlock a hidden path ~10 levels deep containing `trophy_egg.txt`. Does NOT count toward the normal 5 eggs; displayed separately via `eggs` command (e.g. `🏆 secret trophy found`). No hints in any in-game file.

- [ ] **Revise all in-game clue file text per difficulty** *(deferred — needs Phase C dynamic content)*

---

## Resolved / WIP notes

### Save / restore button

- [ ] **Investigate `[ restore save ]` button in intro modal**
  The button relies on `localStorage["eggshell-autosave"]`. If it is not reliably restoring state, remove the button and all associated code — the `load <string>` command is the canonical restore path. Before removing: confirm whether autosave is broken or just the button's UX. If autosave itself works, document how it works (key name, format) in a comment in App.tsx.

### Difficulty system *(implemented — Phase 2)*

Four levels: **easy** / **medium** / **hard** / **impossible**.

| Feature | easy | medium | hard | impossible |
|---|---|---|---|---|
| `stage` output | full guidance | partial | stage name only | silent |
| `hint` command | verbose | verbose | one step | forbidden |
| `map` panel | always visible | toggle | toggle | forbidden |
| `help` command | full | full | full | exits + difficulty only |

*(Note: hint no longer bumped easier — see Phase B task above.)*

### Map panel *(implemented — Phase 2)*

```
[ MAP ]
~ /home/player   (highlighted when cwd)
  documents/     [locked/unlocked]
  secrets/       [locked/unlocked]
  vault/         [locked/unlocked]
  admin/         [locked/unlocked]
  magic/         (user-created, sky-blue)   ← Phase A: fix not showing

/etc             (shown if visited)
/root            [locked/unlocked]
```

### Save / Export system *(implemented — Phase 2)*

- `save`: serializes `GameState` to base64 JSON, prints it (+ copies to clipboard — Phase A fix).
- `load <string>`: decodes and restores state. Validates `v === 1` before applying.
- `localStorage` autosave on every state change. Intro modal shows restore button if autosave exists (Phase A: investigate reliability).

---

## Code quality / technical debt

- [x] **`GameState` mutations inside `onEdit` callbacks are unsafe** *(fixed)*
- [x] **`showIntro` state blocks rendering correctly** *(confirmed non-issue)*
- [x] **`stageLabel` and `stageOf` duplicated** *(fixed — extracted to `src/game/stage.ts`)*
- [x] **`base64 -d` fails on copy-pasted whitespace** *(fixed)*
- [x] **`base64 -d` only accepted raw strings** *(fixed — now also accepts filenames)*
