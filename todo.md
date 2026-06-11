# Eggshell — Improvement Backlog

## Bugs

- [x] **`sudo cd /root` bypasses `adminUnlocked` prerequisite** *(fixed)*
  Removed the forced `adminUnlocked = true` from the `sudo` handler. The `/root` node's
  `locked` predicate (`!s.adminUnlocked`) is now the sole gate.

- [x] **Password cancel submits empty string to `onSubmit`** *(fixed)*
  `PasswordState` now has an optional `onCancel` callback. Cancel calls `onCancel?.()` and
  closes the modal without invoking `onSubmit`, so no spurious error is printed.

- [x] **`edit` prints `"saved"` even when `onEdit` rolls back the state** *(fixed)*
  A `saved` flag is set inside the `setState` updater only on the success path. The
  `"saved."` print is gated on that flag.

- [ ] **Stage 4 (`knowsSudoPassword`) is never reset if the decoded value changes**
  `commands.ts:352` sets `knowsSudoPassword = true` only when the decoded string equals
  `"secret-egg"`. It is never set back to `false`. This is fine for the current game, but
  if the player somehow re-runs the command with different input the flag stays `true`
  permanently — not a bug today, but fragile.

---

## UX / Game-design improvements

- [x] **`ls` doesn't show user-created subdirectory contents** *(fixed)*
  `ls` now checks whether the target path is a user-created directory before erroring, and
  lists its user-created children by parent-path matching. Also fixed the error message
  which said `undefined` when called with no args in an unknown dir.

- [x] **`touch magic/token.txt` works from any cwd, but the path hint says `~/magic/token.txt`** *(fixed)*
  `mkdir` and `touch` now validate that the parent directory exists (in the real FS or in
  `userCreated`) before creating anything. `touch magic/token.txt` from a dir where `magic`
  doesn't exist now prints a clear error with a hint to create the parent first.
  Clue text and `stage` output updated to guide the player step-by-step with absolute paths.

- [ ] **`wifi list` hardcodes output instead of reading `/etc/wifi.json`**
  The file exists in the virtual FS but `wifi list` (`commands.ts:294`) ignores it and
  prints a hardcoded table. If a future contributor updates `wifi.json`, the command won't
  reflect the change. Read and render the actual JSON node.

- [x] **No `~` expansion in paths** *(fixed)*
  `resolvePath` now expands `~` to `/home/player` and `~/foo` to `/home/player/foo`.

- [ ] **`start` command referenced in intro banner but not implemented**
  `App.tsx:43` prints `"type 'help' to see commands, or 'start' to begin."` but there
  is no `start` command in `commands.ts`. Either implement it (e.g. print a guided
  first-step sequence) or remove the mention.

- [ ] **History doesn't persist across page refreshes**
  Game state is lost on reload. Consider `localStorage` for `state` + `history` so
  players can resume a session.

- [ ] **No `rm` command**
  Players who create a wrong directory (e.g. `mkdir magik` typo) have no way to delete
  it. A restricted `rm` (only inside `/home/player`, only user-created nodes) would
  reduce frustration.

- [ ] **`base64 -d` with trailing newline in clue file fails silently**
  `sudo_clue.b64` content ends with `\n`. If a player does `cat sudo_clue.b64` and
  copy-pastes the output including the newline, `atob` throws and they see
  `"base64: invalid input"`. The `trim()` in `commands.ts:350` handles this for typed
  input but not for multi-word pastes that include whitespace in the middle.

---

## Code quality / technical debt

- [ ] **`GameState` mutations inside `onEdit` callbacks are unsafe**
  `fs.ts:109` and `fs.ts:186`: `onEdit` receives a shallow copy (`mut`) and mutates it
  directly (`s.adminUnlocked = true`). This works today but is fragile — the callback
  signature says it returns `string | null` (an error), yet it also mutates state as a
  side-effect. Separate the two concerns: return a state-update delta instead of mutating.

- [ ] **`stageLabel` and `stageOf` are duplicated logic**
  `App.tsx:225` and `commands.ts:39` both compute stage from `GameState` with parallel
  if-chains. Extract into a shared `src/game/stage.ts` utility.

- [ ] **`showIntro` state is never used to defer rendering**
  The `IntroModal` overlays the shell, but the shell is fully interactive behind it (a
  player can type while the modal is open if they Tab-focus the input). Block input while
  the intro is shown, or render the input only after `onClose`.
