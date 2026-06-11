# Eggshell — Improvement Backlog

## Bugs

- [x] **`sudo cd /root` bypasses `adminUnlocked` prerequisite** *(fixed)*
- [x] **Password cancel submits empty string to `onSubmit`** *(fixed)*
- [x] **`edit` prints `"saved"` even when `onEdit` rolls back the state** *(fixed)*

- [ ] **Stage 4 (`knowsSudoPassword`) is never reset if the decoded value changes**
  Fine for current game; fragile if puzzle changes.

- [x] **`wifi list` hardcodes output instead of reading `/etc/wifi.json`** *(fixed)*

- [x] **`showIntro` doesn't block input** *(fixed)*

---

## Future features (later)

- [ ] **Tab autocompletion (silent)**
  Experienced users should be able to complete commands/paths with Tab (or another key if Tab is reserved by the browser). Do NOT mention this feature anywhere in the UI or help text — it's a silent reward for users who already know the real shell.

- [ ] **Debug-mode easter egg (special trophy)**
  When `debug_mode = on` is set in `secrets.cfg`, unlock a hidden path: a directory tree ~10 levels deep containing a special `trophy_egg.txt`. This egg does NOT count toward the normal 5 eggs but is displayed separately when `eggs` is called (e.g. `🏆 secret trophy found`). The deep path should be discoverable only by exploration — no hints in any in-game file.

---

## UX / Game-design improvements

- [x] **`ls` doesn't show user-created subdirectory contents** *(fixed)*
- [x] **`touch magic/token.txt` works from any cwd, but path hint says `~/magic/token.txt`** *(fixed)*
- [x] **No `~` expansion in paths** *(fixed)*
- [x] **`base64 -d` fails on copy-pasted whitespace** *(fixed)*
- [x] **`stageLabel` and `stageOf` duplicated** *(fixed — extracted to `src/game/stage.ts`)*
- [x] **No `rm` command** *(implemented)*
- [x] **Touch-created files not editable** *(fixed)*
- [x] **`.md` files not supported** *(fixed)*
- [x] **`base64 -d` only accepted raw strings** *(fixed)*
- [x] **Terminal text not copyable on mobile** *(fixed)*
- [x] **WiFi (and sudo) password entered in a modal, not the CLI** *(fixed)*
- [x] **Terminal output not mouse-selectable in browser** *(fixed — onClick now checks for active selection before focusing input)*
- [x] **Intro modal says "Start by typing help then cat README.txt"** *(fixed — now says "type start to begin or try the help command")*
- [x] **`asciizoo` command** *(added — sends a zipped request to the fictional ascii-zoo.local service, returns ASCII art for one or more animals: cat, dog, rabbit, bird, fish, cow)*
- [x] **History doesn't persist across page refreshes** *(partially resolved — save/export system handles progress persistence; terminal scrollback still resets on refresh, which is acceptable)*
- [x] **Keyboard shortcut for save adapts to OS** *(fixed — EditorModal detects macOS via userAgent and shows Cmd+S or Ctrl+S accordingly)*

- [ ] **Revise all in-game hint text** *(partially done — `hint` and `stage` commands are now difficulty-aware with verbose/brief/partial variants; in-game clue file content revision deferred to Phase 3 when dynamic file content is supported)*

---

## Difficulty system *(implemented — Phase 2)*

Four levels: **easy** / **medium** / **hard** / **impossible**. Selected at startup (intro modal) or via `difficulty <level>`.

| Feature | easy | medium | hard | impossible |
|---|---|---|---|---|
| `stage` output | full guidance | partial | stage name only | silent |
| `hint` command | verbose | verbose (bumped easier) | one step (bumped easier) | forbidden |
| `map` panel | always visible | toggle with `map` | toggle with `map` | forbidden |
| `help` command | full | full | full | exits + difficulty only |

- `hint` gives the hint one level easier than current difficulty.
- On `impossible`, `help` only prints how to exit and change difficulty; `stage` is silent.
- Difficulty is stored in `GameState.difficulty` and persisted via `save`/`load`.

---

## Map panel *(implemented — Phase 2)*

A side panel showing key directories and their lock status.

```
[ MAP ]
~ /home/player   (highlighted when cwd)
  documents/     [locked/unlocked]
  secrets/       [locked/unlocked]
  vault/         [locked/unlocked]
  admin/         [locked/unlocked]
  magic/         (user-created, shown in sky-blue)

/etc             (shown if visited)
/root            [locked/unlocked]
```

- **Easy**: always visible on the right side (~176px wide).
- **Medium/Hard**: hidden by default, toggled with `map` command.
- **Impossible**: forbidden — `map` prints "access denied".
- Lock status is derived at render time from `locked` predicates (same as `ls`).
- Visited tracking: `GameState.visited[]` — updated when `ls` or `cd` runs on a directory.

---

## Save / Export system *(implemented — Phase 2)*

Persist and share game progress via an encoded string.

- `save` command: serializes `GameState` to base64 JSON, prints it and copies to clipboard.
- `load <string>` command: decodes and restores state. Validates schema version (`v: 1`) before applying.
- State includes: all `GameState` fields (eggsFound, wifiConnected, adminUnlocked, edits, userCreated, difficulty, visited, mapVisible, knowsSudoPassword, etc.)
- **localStorage autosave**: state is saved on every change. On page load, `[ restore save ]` button appears in the intro modal if an autosave exists.

---

## Architecture — Scaling for expansion *(planned — Phase 3)*

Current single-file approach works for 6 stages but will not scale. Refactor before adding more stages:

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
2. **Split types** — move `GameState`, `FsNode`, `Difficulty` into `src/types.ts` so all modules import from one place without circular deps.
3. **World loader** — `worlds/world1.ts` exports `{ filesystem, hints, stages }`. App selects world at startup. This lets future content be dropped in without touching core engine.
4. **hints.ts** — `getHint(stage, difficulty): string` replaces scattered hint strings in `commands.ts` and `fs.ts`.
5. **save.ts** — `exportSave(state): string` / `importSave(str): GameState | null`.
6. **Dynamic file content** — make `content` field in FsNode accept `(state: GameState) => string` so clue files can show difficulty-appropriate text.

---

## Implementation order

```
Phase 1 — Quick wins (no architecture change)
  [x] Fix showIntro blocking input
  [x] Fix wifi list reading from fs node

Phase 2 — New features (additive, minimal refactor)
  [x] Difficulty system (GameState + commands.ts + intro modal)
  [x] Map panel (MapPanel component + visited tracking)
  [x] Save / Export (save/load commands + localStorage autosave + intro restore button)
  [x] Keyboard shortcut adapts to OS (EditorModal)
  [x] onEdit callbacks refactored to return { error, patch } instead of mutating state
  [ ] Revise in-game clue file text per difficulty (deferred — needs Phase 3 dynamic content)

Phase 3 — Architecture scaling
  [ ] Extract terminal sub-components
  [ ] Split types.ts
  [ ] Add hints.ts + difficulty.ts
  [ ] Dynamic file content (content as function of state)
  [ ] World loader abstraction
  [ ] Begin world2 scaffold
```

---

## Code quality / technical debt

- [x] **`GameState` mutations inside `onEdit` callbacks are unsafe** *(fixed — `onEdit` now returns `{ error: string | null, patch?: Partial<GameState> }` instead of mutating the passed-in state)*

- [x] **`showIntro` state is never used to defer rendering** *(non-issue — `!showIntro` check in App.tsx already blocks the input form while the intro overlay is shown)*
