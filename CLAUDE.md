# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Eggshell** is a browser-based terminal emulator game for CLI education. Players complete a 6-stage easter-egg hunt by learning real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `edit`, `sudo`, `base64`). It is a *training shell*, not a real one — every concept maps 1:1 to real Linux/macOS behavior.

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
  App.tsx          — terminal UI, prompt loop, modals (password + editor), command history
  game/
    fs.ts          — virtual filesystem tree (FsNode), GameState definition, all file content
    commands.ts    — command handlers: execute(input, state, setState, openEditor, openPassword)
  utils/cn.ts      — clsx + tailwind-merge helper
```

### Data flow

`GameState` lives in `App.tsx` as React state. Commands receive `(state, setState)` and mutate via `setState(s => ...)`. The virtual FS is a plain object tree defined in `fs.ts`; locked nodes carry a `locked: (state: GameState) => boolean` predicate that `ls` and `cd` evaluate at runtime.

### The 6-stage puzzle graph

| Stage | Gate | What it unlocks |
|---|---|---|
| 1 OFFLINE | `wifi connect EggHunt-5G` (pw: `yolk-yolk-123`) | `/home/player/documents` |
| 2 CREATE | `mkdir magic` + `touch magic/token.txt` | `/home/player/secrets` |
| 3 EDIT | `edit secrets.cfg` → flip `path_to_vault_locked = true` to `false` | `/home/player/vault` |
| 4 DECODE | `base64 -d c2VjcmV0LWVnZw==` → `secret-egg` (sudo password) | (knowledge gate) |
| 5 SUDO | `sudo edit /etc/privilege.cfg` → flip `allow_admin = false` to `true` | `/home/player/admin` + `/root` |
| 6 ROOT | `sudo cd /root`, `cat final_egg.txt` | Win condition |

Each stage has an `eggN.txt`; `cat`-ing it appends the path to `state.eggsFound[]`. Win = 5 eggs.

### Modals

Password prompts and the text editor are centered modal components rendered in `App.tsx`. The editor supports `Ctrl+S` (save) and `Esc` (cancel). `onEdit` callbacks in `fs.ts` validate content and return an error string (non-null) to reject, or `null` to accept — they also mutate state as a side-effect (noted as a tech-debt issue in `todo.md`).

## Known bugs (see todo.md for full details)

- `stageLabel`/`stageOf` logic is duplicated between `App.tsx:225` and `commands.ts:39` — extract to `src/game/stage.ts`

## Visual / UX constraints

- Strictly monochrome terminal palette: black background, emerald/gray/red, monospace font only
- No animations, no gradients — must *look* like a real CLI
- Path alias `@/` maps to `src/`
