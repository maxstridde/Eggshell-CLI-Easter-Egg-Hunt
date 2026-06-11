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

- [ ] **Revise all in-game hint text** *(planned — after difficulty system)*

- [ ] **History doesn't persist across page refreshes**
  Will be partially solved by the save/export system (see below).

---

## Difficulty system *(planned — Phase 2)*

Four levels: **easy** / **medium** / **hard** / **impossible**. Selected at startup or via `difficulty <level>`.

| Feature | easy | medium | hard | impossible |
|---|---|---|---|---|
| `stage` output | full guidance | partial | stage name only | silent |
| `hint` command | verbose | one step | cryptic | forbidden |
| `map` panel | always visible | toggle with `map` | toggle with `map` | forbidden |
| `help` command | full | full | full | exits + difficulty only |
| in-game clue files | verbose | moderate | minimal | unchanged |

- `hint` gives the hint one level easier than current difficulty.
- On `impossible`, `help` only prints how to exit and change difficulty.
- The README explains the difficulty system and the `difficulty` command.

---

## Map panel *(planned — Phase 2)*

An always-visible side panel showing explored areas, styled like the ASCII map in README.

```
[ MAP ]
/home/player
  ├── documents/   [unlocked]
  ├── secrets/     [locked]
  └── vault/       [locked]
/etc             [partial]
/root            [locked]
```

- **Easy**: always visible on the right side (small, ~20ch wide).
- **Medium/Hard**: hidden by default, toggled with `map` command.
- **Impossible**: forbidden — `map` prints "access denied".
- Map tracks `state.visited[]` (new field on `GameState`): directories the player has `ls`-ed or `cd`-ed into.
- Lock status is derived at render time from locked predicates (same as `ls`).

---

## Save / Export system *(planned — Phase 2)*

Persist and share game progress via an encoded string.

- `save` command: serializes `GameState` to base64 JSON, prints it and copies to clipboard.
- `load <string>` command: decodes and restores state. Validates schema version before applying.
- State includes: `eggsFound`, `wifiConnected`, `adminUnlocked`, `edits`, `userCreated`, `difficulty`, `visited`, `knowsSudoPassword`.
- Schema versioned with a `v` field so future expansions can migrate old saves.
- On page load, check `localStorage` for an autosave; prompt to restore or start fresh.
- The intro modal gets a "Restore save" button.

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

---

## Implementation order

```
Phase 1 — Quick wins (no architecture change)
  [x] Fix showIntro blocking input
  [x] Fix wifi list reading from fs node

Phase 2 — New features (additive, minimal refactor)
  [ ] Difficulty system (GameState + commands.ts + intro modal)
  [ ] Map panel (MapPanel component + visited tracking)
  [ ] Save / Export (save.ts + load command + localStorage autosave)
  [ ] Revise hint text (gated on difficulty system being in place)

Phase 3 — Architecture scaling
  [ ] Extract terminal sub-components
  [ ] Split types.ts
  [ ] Add hints.ts + difficulty.ts
  [ ] World loader abstraction
  [ ] Begin world2 scaffold
```

---

## Code quality / technical debt

- [ ] **`GameState` mutations inside `onEdit` callbacks are unsafe**
  Return `{ error: string | null, patch: Partial<GameState> }` instead.

- [ ] **`showIntro` state is never used to defer rendering**
  Block terminal input while the intro modal is shown.
