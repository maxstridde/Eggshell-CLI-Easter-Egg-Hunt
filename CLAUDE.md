# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Eggshell** is a browser-based terminal emulator game for CLI education. Players complete a 6-stage easter-egg hunt by learning real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `edit`, `sudo`, `base64`, `unzip`). It is a *training shell*, not a real one — every concept maps 1:1 to real Linux/macOS behavior.

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
  App.tsx          — terminal UI, inline prompt loop, editor modal, map panel, command history
  game/
    fs.ts          — virtual filesystem tree (FsNode), GameState + Difficulty types, all file content
    commands.ts    — command handlers: execute(input, state, setState, openEditor, passwordPrompt)
    stage.ts       — stageOf(), stageLabel(), stageHint() — all difficulty-aware
  utils/cn.ts      — clsx + tailwind-merge helper
```

### Data flow

`GameState` lives in `App.tsx` as React state. Commands receive `(state, setState)` and mutate via `setState(s => ...)`. The virtual FS is a plain object tree defined in `fs.ts`; locked nodes carry a `locked: (state: GameState) => boolean` predicate that `ls` and `cd` evaluate at runtime.

User-created files/dirs live in `state.userCreated[]`. File content overrides (from `edit`) live in `state.edits[path]`. `cat` checks `edits` first, then falls back to the FS node or userCreated content.

### The 6-stage puzzle graph

| Stage | Gate | What it unlocks |
|---|---|---|
| 1 OFFLINE | `wifi connect EggHunt-5G` (pw: `yolk-yolk-123`) | `/home/player/documents` → egg1 |
| 2 CREATE | `mkdir magic` + `touch magic/token.txt` | `/home/player/secrets` → egg2 |
| 3 EDIT | `edit secrets.cfg` → flip `path_to_vault_locked = true` to `false` | `/home/player/vault` → egg3 |
| 4 DECODE | `base64 -d c2VjcmV0LWVnZw==` or decode the `passphrase` field in `sudo_clue.json` → `secret-egg` | (knowledge gate) |
| 5 SUDO | `sudo edit /etc/privilege.cfg` → flip `allow_admin = false` to `true` | `/home/player/admin` → egg4 + `/root` |
| 6 ROOT | `sudo cd /root`, `unzip final_egg.zip`, `cat final_egg.txt` | Win condition → egg5 |

Each stage has an `eggN.txt`; `cat`-ing it appends the path to `state.eggsFound[]`. Win = 5 eggs.

### Difficulty system

`GameState.difficulty: "easy" | "medium" | "hard" | "impossible"`. Set at startup (intro modal) or via `difficulty <level>` command.

- `stageOf(state)` in `stage.ts` returns the stage description filtered by difficulty (full / partial / label / silent).
- `stageHint(state)` returns a hint string one level easier than the current difficulty, or null if impossible.
- The map panel (`MapPanel` component in `App.tsx`) is always visible on easy, toggleable on medium/hard, hidden on impossible.

### Password prompts

Password entry is **inline in the terminal** (not a modal). `passwordPrompt()` sets `inlinePrompt` state in `App.tsx`, which renders a `type="password"` input inline in the scrollback. Submitting or pressing Escape clears it and calls the callback.

### Editor modal

The text editor is a centered modal. The save shortcut is OS-aware: `Cmd+S` on macOS, `Ctrl+S` on Windows/Linux (detected via `navigator.userAgent`). `Esc` cancels.

`onEdit` callbacks in `fs.ts` now return `{ error: string | null, patch?: Partial<GameState> }` instead of mutating state. The `edit` command handler in `commands.ts` applies the patch.

### Map panel

`MapPanel` in `App.tsx` renders the key directory structure with real-time lock status derived from `locked` predicates. Shows `/home/player` and its children, user-created dirs, `/etc` (if visited), and `/root`. Current directory is highlighted with exact-path matching (`cwd === path`, not `startsWith`).

`renderDirContents(dirPath, baseIndent)` renders files and subdirs inside a visited directory. If a subdir has been visited it expands one level deeper (no further recursion). `baseIndent` carries the vertical-bar prefix from the parent: `"│   "` or `"    "` for home subdirs, `""` for top-level sections (`/etc`, `/root`).

`/etc` contains `cron.d/` (a realistic but stage-irrelevant directory) alongside `hostname`, `issue`, `wifi.json`, and `privilege.cfg`.

### Save / Export system

- `save` command: `btoa(JSON.stringify({ v: 1, ...state }))` — prints the string and copies to clipboard.
- `load <string>` command: `atob` → parse → validate `v === 1` → `setState` + `setCwd("/home/player")`.
- `App.tsx` autosaves to `localStorage["eggshell-autosave"]` on every state change (skipping the first render). The intro modal shows `[ restore save ]` if an autosave exists.

### rm command

`rm` only removes user-created nodes inside `/home/player`. It refuses to delete non-empty directories and has no `-r` flag. Built-in FS files are untouchable.

## Known bugs / open items (see todo.md for full details)

- In-game clue file text is not yet difficulty-aware (deferred to Phase C).
- Stage 4 (`knowsSudoPassword`) is never reset if the decoded value changes.
- Tab autocompletion not yet implemented.
- Small screens (< 640 px) are difficult: map panel (w-48) consumes ~53 % of a phone viewport; prompt string wraps on deep paths. See Phase A3 in todo.md.

## Visual / UX constraints

- Strictly monochrome terminal palette: black background, emerald/gray/red, monospace font only
- No animations, no gradients — must *look* like a real CLI
- Path alias `@/` maps to `src/`
