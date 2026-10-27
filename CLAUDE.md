# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Eggshell** — browser-based terminal emulator game for CLI education. Story: Hen, the retiring admin of eggshell.local, hid 7 eggs; one egg = one stage. Players learn real shell concepts (`ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `mv`, `cp`, `edit`, `sudo`, `base64`, `unzip`, `grep`) by doing, not from a command list. It is a *training shell*, not a real one.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # single self-contained HTML via vite-plugin-singlefile
npm run preview  # preview production build
npx tsc --noEmit # type-check
npm run build && node scripts/playthrough.mjs  # Playwright smoke test: full solution + bypass checks
node scripts/story.mjs  # dump every player-facing text in order → docs/STORY.md
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
    stage.ts       — STAGES (egg name, goal, hints, gate/step/opened/announce), stageHint(), nextEggLine(), tick/recordHint()
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

### The 7 eggs (egg = stage)

| # | Egg | Gate | Unlocks |
|---|---|---|---|
| 1 | The Signal | `wifi connect EggHunt-5G` (pw in `/etc/wifi.json`) | `~/documents` → egg1 |
| 2 | The Builder | `mkdir ~/magic` + `touch ~/magic/token.txt` | `~/secrets` → egg2 |
| 3 | The Janitor | `rm` the `*.tmp` (and the hidden `.cache.tmp`, found with `ls -a`) + `mv report.txt ~/documents/` | egg3 appears in `~/secrets` |
| 4 | The Editor | `cp secrets.cfg <backup>` (house rule), then `edit` → `path_to_vault_locked = false` | `~/vault` → egg4 |
| 5 | The Administrator | `base64 -d` the passphrase → `secret-egg`; `sudo edit /etc/privilege.cfg` → `allow_admin=true` | `~/admin` → egg5, `/root` |
| 6 | The Root | `sudo cd /root`, `unzip egg6.zip`, `cat egg6.txt` | `/var` |
| 7 | The Investigator | `grep -r egg /var/log` (label golden-yolk) → `grep -r golden-yolk /var/backups` (or `grep -r egg`) → `cat /var/backups/.attic/2019/misc/egg7.txt` | win |

`cat`-ing an egg (`EGGS` in `fs.ts`) appends it to `state.eggsFound[]` and completes its stage; every lock also requires the previous eggs (`upTo`). Locks are hard walls: every path command goes through `blocked()` / `lockedAt()`.

Text rules: objectives and egg texts never name commands; eggs use full verbs (remove, copy) and end with Hen's pointer to the next egg. `help` gives each command name's meaning. `node scripts/story.mjs` regenerates `docs/STORY.md` for review.

### Difficulty & hints

Four help levels: 0 = the world (files, eggs, door announcements), then `hint` tiers 1–3 (nudge → direction → exact commands), each prefixed `hint n/max:`.

| | easy | medium | hard | impossible |
|---|---|---|---|---|
| hint cap | 3 | 2 | 1 | none |
| `eggs` objective | name + goal | name + goal | name only | silent |
| map panel | always | toggle | toggle | hidden |
| clue-file extras | `help` pointers | base | stripped | stripped |

Escalation state is `state.hint {key, asks, since}` (not saved). The key is stage + `step` + door-open, so sub-progress restarts at the nudge; 8 commands without asking drop a tier; difficulty change and load reset it. On easy/medium, 3 failed commands in a row print "stuck? try `hint`". Before the exact tier (easy only) one extra `hint` is required ("The next hint is the exact answer…"). `state.stats[egg]` counts shell commands (not `GAME_COMMANDS`: help, hint, save, load…) and active time (gaps capped at 2 min, `lastAt` not saved) while hunting; the win plays `Celebration.tsx` (the one allowed animation, any key skips), then a per-egg table against `HEN_WAY_PER_EGG` (sum 23, the README solution). When a stage's `opened` flips within the stage, App prints its `announce` line.

### Story dates

Dates follow the player's clock (helpers at the top of `fs.ts`, computed at read time, never saved): banner "Last login" and Hen's logs are yesterday, dpkg.log two days ago, the easterd syslog lines a minute ago, and Hen retires 3 days out (`retireDate()` in README.txt, IntroModal, `sudo_clue.json` expires), so a midnight mid-play doesn't break the story. `docs/STORY.md` therefore shows the dates of the day it was generated.

### Start gate, prompts, input

Nothing but `start`, `load` and `menu` runs before `start`; the first `start` asks the player's name (`state.playerName`, shown in the save list, the restore line and the win table) and gives the game its save `slot`.

Prompts are inline in the terminal (not a modal). `passwordPrompt(onSubmit, title, onCancel, visible)` sets `inlinePrompt` state, rendering a `type="password"` input (or a text input when `visible`, for the name). Escape cancels. The command line is a one-row textarea that grows, so long lines (save strings) wrap.

`reset <file>` drops `state.edits[path]` and re-runs `onEdit` on the original; `edit` points at it when one of Hen's `key =` settings is gone after a save.

### Save system

All serialization lives in `src/game/save.ts` (`exportSave` / `importSave` / `loadAutosave` / `writeAutosave`).

- `save` — UTF-8-safe base64 JSON (`v: 2`, explicit fields; `hint` is not saved), printed + copied to clipboard
- `load <string>` — `importSave` returns `GameState` or an error message string
- Multiple save games: `localStorage["eggshell-saves"]` = `{ [slot]: save string }`, one slot per started game (slot = start time), newest 10 kept. The old single `eggshell-autosave` is migrated once. The menu lists them (name, eggs, last played) with `[ restore ]` / `[ delete ]`
- Autosave on every state change, but only from the first egg on (a game earns its slot there) and never while the intro overlay is open, so pre-restore changes can't clobber a save

`menu` (and hidden alias `quit`) reopen the intro overlay via `ctx.openMenu()` without losing progress. Hidden aliases: `exit`, `stage` (= `eggs`), `vi`, `cls`; `nano`/`vim` = `edit`.

### Hidden files

Dot names are hidden like in bash: `ls` skips them (`ls -a` shows them plus `./ ../`), `*` never matches a leading dot, Tab completes them only after a typed `.`, the map shows them only once visited. `ls -R` recurses (bash-style `path:` headers), `-r` reverses; `grep` takes `-r` and `-i`. After `rm *.tmp`, `rm` says the quota is still over, and only when nothing visible is left adds that not every file shows in a plain listing. The first look into a `/var/backups` subfolder (not impossible) suggests searching instead. `help` marks entries that joined since the last `help` (`state.helpSeen`, saved).

### Visual constraints

- Strictly monochrome: black background, emerald/gray/red, monospace only
- No animations, no gradients — must look like a real CLI. One exception: the ASCII win celebration
- Contrast: text ≥ 4:1 on black (stone-400+; stone-500 only for ghost text / locked); state never by colour alone (`[locked]`, `◂` current folder, `← new` in help)
- Themes: `theme.remap` swaps line colours per terminal user (admin: amber text, white headings, sky announcements)
- Path alias `@/` → `src/`

### Tab completion

`candidates()` in `commands.ts` is the single source; `completeInput()` returns the completed line. `difficulty`, `man` and `wifi` (list/connect, then the SSIDs) complete from word lists; `/root` contents stay hidden until entered. App shows the remainder as grey ghost text; Tab or → accepts, a second Tab lists multiple candidates. Locked dirs never complete. Mentioned in `start`, `help` and the intro.

### Difficulty-aware clue text

Clue files (`README.txt`, `notes.txt`, `clue2.riddle`, `quota.txt`, `how-to-sudo.txt`) use `content: (state) => string`: easy = base + `help` pointer, medium = base, hard/impossible = hand-holding lines stripped. `editor-tips.txt` is a mechanics doc, same at all difficulties.

## Backlog

See `todo.md`. One world only — no level builder, no future worlds.
