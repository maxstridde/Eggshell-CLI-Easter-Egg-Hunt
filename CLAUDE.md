# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Eggshell** — browser-based terminal emulator game for CLI education. Players complete a 6-stage easter-egg hunt learning real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `edit`, `sudo`, `base64`, `unzip`). It is a *training shell*, not a real one.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # single self-contained HTML via vite-plugin-singlefile
npm run preview  # preview production build
npx tsc --noEmit # type-check (no test runner configured)
```

## Architecture

```
src/
  App.tsx          — terminal UI, prompt loop, editor modal, map panel, command history
  game/
    fs.ts          — FsNode tree, GameState + Difficulty types, all file content
    commands.ts    — execute(input, state, setState, openEditor, passwordPrompt)
    stage.ts       — stageOf(), stageLabel(), stageHint()
  utils/cn.ts      — clsx + tailwind-merge
```

### State & data flow

`GameState` lives in `App.tsx`. Commands receive `(state, setState)` and mutate via `setState(s => ...)`.

Two runtime stores:
- `state.userCreated[]` — files/dirs created by the player
- `state.edits[path]` — content overrides from `edit` command; `cat` checks this first

FS nodes can carry `locked: (state: GameState) => boolean`; `ls` and `cd` evaluate it at runtime.

`onEdit` callbacks in `fs.ts` return `{ error: string | null, patch?: Partial<GameState> }`. The `edit` command in `commands.ts` applies the patch — **do not mutate state inside `onEdit`**.

### The 6-stage puzzle

| Stage | Gate | Unlocks |
|---|---|---|
| 1 OFFLINE | `wifi connect EggHunt-5G` (pw: `yolk-yolk-123`) | `/home/player/documents` → egg1 |
| 2 CREATE | `mkdir magic` + `touch magic/token.txt` | `/home/player/secrets` → egg2 |
| 3 EDIT | `edit secrets.cfg` → set `path_to_vault_locked = false` | `/home/player/vault` → egg3 |
| 4 DECODE | `base64 -d` the passphrase in `sudo_clue.json` → `secret-egg` | knowledge gate |
| 5 SUDO | `sudo edit /etc/privilege.cfg` → set `allow_admin = true` | `/home/player/admin` → egg4 + `/root` |
| 6 ROOT | `sudo cd /root`, `unzip final_egg.zip`, `cat final_egg.txt` | egg5 + win |

`cat`-ing an `eggN.txt` appends its path to `state.eggsFound[]`. Win = 5 eggs.

### Difficulty system

`GameState.difficulty: "easy" | "medium" | "hard" | "impossible"` — set at startup or via `difficulty <level>`.

| Feature | easy | medium | hard | impossible |
|---|---|---|---|---|
| `stage` output | full | partial | label only | silent |
| `hint` command | verbose | verbose | one step | forbidden |
| map panel | always visible | toggle | toggle | hidden |
| `help` | full | full | full | exits only |

Map panel is `hidden sm:flex` — hidden on mobile, shown on desktop. A `[map]` button in the top bar opens a fullscreen overlay on mobile.

### Password prompts

Inline in the terminal (not a modal). `passwordPrompt()` sets `inlinePrompt` state, rendering a `type="password"` input inline. Escape cancels.

### Save system

- `save` — `btoa(JSON.stringify({ v: 1, ...state }))` via TextEncoder (UTF-8 safe)
- `load <string>` — decodes, validates `v === 1`, calls `setState`
- Autosaves to `localStorage["eggshell-autosave"]` on every state change

### Visual constraints

- Strictly monochrome: black background, emerald/gray/red, monospace only
- No animations, no gradients — must look like a real CLI
- Path alias `@/` → `src/`

## Backlog & known issues

See `todo.md` for the full backlog (Phases A–E) and open bugs. Key open items:
- Stage 4 `knowsSudoPassword` not reset if decoded value changes
- Tab autocompletion not implemented
- Clue file text not yet difficulty-aware (planned Phase C)
- `[ restore save ]` button reliability uninvestigated
