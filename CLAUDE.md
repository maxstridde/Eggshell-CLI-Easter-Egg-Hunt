# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Eggshell** is a browser-based terminal emulator game for CLI education. Players complete a 6-stage easter-egg hunt by learning real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `edit`, `sudo`, `base64`). It is a *training shell*, not a real one — every concept maps 1:1 to real Linux/macOS behavior.

## Commands

```bash
npm run dev      # start Vite dev server
npm run build    # production build (outputs a single self-contained HTML file via vite-plugin-singlefile)
npm run preview  # preview the production build
```

No test runner is configured. Type-check with: `npx tsc --noEmit`

## Architecture

```
src/
  App.tsx          — terminal UI, inline prompt loop, editor modal, command history
  game/
    fs.ts          — virtual filesystem tree (FsNode), GameState definition, all file content
    commands.ts    — command handlers: execute(input, state, setState, openEditor, passwordPrompt)
    stage.ts       — stageOf() and stageLabel() shared utilities
  utils/cn.ts      — clsx + tailwind-merge helper
```

### Data flow

`GameState` lives in `App.tsx` as React state. Commands receive `(state, setState)` and mutate via `setState(s => ...)`. The virtual FS is a plain object tree defined in `fs.ts`; locked nodes carry a `locked: (state: GameState) => boolean` predicate that `ls` and `cd` evaluate at runtime.

User-created files/dirs live in `state.userCreated[]`. File content overrides (from `edit`) live in `state.edits[path]`. `cat` checks `edits` first, then falls back to the FS node or userCreated content.

### The 6-stage puzzle graph

| Stage | Gate | What it unlocks |
|---|---|---|
| 1 OFFLINE | `wifi connect EggHunt-5G` (pw: `yolk-yolk-123`) | `/home/player/documents` |
| 2 CREATE | `mkdir magic` + `touch magic/token.txt` | `/home/player/secrets` |
| 3 EDIT | `edit secrets.cfg` → flip `path_to_vault_locked = true` to `false` | `/home/player/vault` |
| 4 DECODE | `base64 -d c2VjcmV0LWVnZw==` or `base64 -d sudo_clue.b64` → `secret-egg` | (knowledge gate) |
| 5 SUDO | `sudo edit /etc/privilege.cfg` → flip `allow_admin = false` to `true` | `/home/player/admin` + `/root` |
| 6 ROOT | `sudo cd /root`, `cat final_egg.txt` | Win condition |

Each stage has an `eggN.txt`; `cat`-ing it appends the path to `state.eggsFound[]`. Win = 5 eggs.

### Password prompts

Password entry is **inline in the terminal** (not a modal). `passwordPrompt()` sets `inlinePrompt` state in `App.tsx`, which renders a `type="password"` input inline in the scrollback. Submitting or pressing Escape clears it and calls the callback.

### Editor modal

The text editor is a centered modal. `Ctrl+S` / `Cmd+S` saves, `Esc` cancels. `onEdit` callbacks in `fs.ts` validate content and mutate state as a side-effect (tech-debt: see todo.md).

### rm command

`rm` only removes user-created nodes inside `/home/player`. It refuses to delete non-empty directories and has no `-r` flag. Built-in FS files are untouchable.

## Known bugs (see todo.md for full details)

See todo.md — no outstanding structural bugs. Stage logic lives in `src/game/stage.ts`.

## Visual / UX constraints

- Strictly monochrome terminal palette: black background, emerald/gray/red, monospace font only
- No animations, no gradients — must *look* like a real CLI
- Path alias `@/` maps to `src/`
