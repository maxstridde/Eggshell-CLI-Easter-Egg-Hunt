# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Eggshell** — browser-based terminal emulator game for CLI education. Players complete a 7-stage easter-egg hunt learning real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `edit`, `sudo`, `base64`, `unzip`, `grep`). It is a *training shell*, not a real one.

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
  App.tsx          — layout shell, prompt loop, command history, command wiring
  types.ts         — GameState, FsNode, Difficulty, TerminalUser, initialState
  terminal/
    theme.ts       — Theme type + getTheme(terminalUser)
    EditorModal.tsx
    InlinePasswordForm.tsx
    MapPanel.tsx
    IntroModal.tsx — intro / main menu (also reopened by `menu` / `quit`)
  game/
    fs.ts          — FsNode tree (all file content), path helpers, fileContent()
    commands.ts    — command handlers, CmdContext (print, openEditor, openMenu, passwordPrompt…)
    stage.ts       — STAGES, stageOf(), stageLabel(), stageHint(), activeStageIndex()
    save.ts        — exportSave/importSave, loadAutosave/writeAutosave (single source)
  utils/cn.ts      — clsx + tailwind-merge
```

### State & data flow

`GameState` lives in `App.tsx`. Commands receive `(state, setState)` and mutate via `setState(s => ...)`.

Two runtime stores:
- `state.userCreated[]` — files/dirs created by the player
- `state.edits[path]` — content overrides from `edit` command; `cat` checks this first

FS nodes can carry `locked: (state: GameState) => boolean`; `ls` and `cd` evaluate it at runtime.

`onEdit` callbacks in `fs.ts` return `{ error: string | null, patch?: Partial<GameState> }`. The `edit` command in `commands.ts` applies the patch — **do not mutate state inside `onEdit`**.

### The 7-stage puzzle

| Stage | Gate | Unlocks |
|---|---|---|
| 1 OFFLINE | `wifi connect EggHunt-5G` (pw: `yolk-yolk-123`) | `/home/player/documents` → egg1 |
| 2 CREATE | `mkdir magic` + `touch magic/token.txt` | `/home/player/secrets` → egg2 |
| 3 EDIT | `edit secrets.cfg` → set `path_to_vault_locked = false` | `/home/player/vault` → egg3 |
| 4 DECODE | `base64 -d` the passphrase in `sudo_clue.json` → `secret-egg` | knowledge gate |
| 5 SUDO | `sudo edit /etc/privilege.cfg` → set `allow_admin = true` | `/home/player/admin` → egg4 + `/root` |
| 6 ROOT | `sudo cd /root`, `unzip final_egg.zip`, `cat final_egg.txt` | egg5 + `/var` |
| 7 SEARCH | `grep -r egg /var/log` → path in syslog → `cat /var/backups/egg6.txt` | egg6 + win |

`cat`-ing an `eggN.txt` appends its path to `state.eggsFound[]`. Win = 6 eggs.

### Difficulty system

`GameState.difficulty: "easy" | "medium" | "hard" | "impossible"` — set at startup or via `difficulty <level>`.

| Feature | easy | medium | hard | impossible |
|---|---|---|---|---|
| `stage` output | full | partial | label only | silent |
| `hint` tiers (start→cap) | 1→2 | 0→1 | 0→0 | forbidden |
| map panel | always visible | toggle | toggle | hidden |
| `help` | full | full | full | exits only |

Hints are escalating tiers per stage (`stage.ts`): 0 = nudge, 1 = concrete direction, 2 = exact commands. Repeated `hint` asks climb the tiers up to the difficulty cap; tiers can be `(state) => string` to react to sub-progress within a stage. `hintExhausted()` marks when asking again yields nothing new (triggers the "try `difficulty easy`" nudge).

Map panel is `hidden sm:flex` — hidden on mobile, shown on desktop. A `[map]` button in the top bar opens a fullscreen overlay on mobile.

### Password prompts

Inline in the terminal (not a modal). `passwordPrompt()` sets `inlinePrompt` state, rendering a `type="password"` input inline. Escape cancels.

### Save system

All serialization lives in `src/game/save.ts` (`exportSave` / `importSave` / `loadAutosave` / `writeAutosave`).

- `save` — UTF-8-safe base64 JSON (`v: 1`), printed + copied to clipboard
- `load <string>` — `importSave` returns `GameState` or an error message string
- Autosaves to `localStorage["eggshell-autosave"]` on every state change — suppressed while the intro overlay is open, so pre-restore changes (e.g. picking a difficulty) can't clobber the saved game before `[ restore save ]` is clicked

`hint` tracks per-stage asks in `state.hintAskedCount` (drives tier escalation, see Difficulty system). `menu` (and hidden alias `quit`) reopen the intro overlay via `ctx.openMenu()` without losing progress.

### Visual constraints

- Strictly monochrome: black background, emerald/gray/red, monospace only
- No animations, no gradients — must look like a real CLI
- Path alias `@/` → `src/`

### Tab completion

`completeInput()` in `commands.ts`, wired to Tab in `App.tsx`. First token completes command names (hidden alias `quit` excluded); later tokens complete paths — FS children of unlocked dirs plus user-created files, multiple matches fall back to the longest common prefix. Deliberately undocumented in UI/help — silent reward for real shell users.

### Difficulty-aware clue text

Clue files (`README.txt`, `notes.txt`, `clue2.riddle`, `how-to-sudo.txt`) use `content: (state) => string`: easy = base + explicit pointer, medium = base, hard/impossible = hand-holding lines stripped. `editor-tips.txt` is a mechanics doc, same at all difficulties.

## Backlog & known issues

See `todo.md` for the current plan (next-session items, parked items with reasons, condensed history). Key parked items:
- Phase D level-builder architecture — blocked until a second world is designed on paper
- Debug-mode trophy egg (Phase E)
- Stage 4 `knowsSudoPassword` not reset if decoded value changes — fold into Phase D
