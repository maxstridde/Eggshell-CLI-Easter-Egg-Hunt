# Eggshell — Improvement Backlog

Reorganized 2026-07-03 by effort/benefit rating. Full phase history condensed at the bottom.

---

## Next session plan *(executing 2026-07-03)*

Ordered by effort/benefit ratio. Everything here except the audit is a code change.

1. - [x] **Mobile line-height step-down** — *trivial effort, low–med benefit*
   At 13 px the desktop `leading-6` (24 px) feels loose. Tighter leading below `sm`, unchanged on desktop. *(done: `leading-[1.4] sm:leading-6` in App.tsx)*

2. - [x] **`[ restore save ]` button fix** — *low effort, medium benefit*
   Root cause identified: the autosave effect fires on every state change after mount, so changing difficulty in the intro modal (or any pre-restore state change) overwrites `localStorage["eggshell-autosave"]` with a near-fresh state before the player clicks restore. Fix: suppress autosave while the intro overlay is open; also reset `cwd` to `/home/player` on restore (parity with the `load` command). *(done: both fixes in App.tsx)*

3. - [x] **Final-A codebase audit** — *medium effort (one session), med–high benefit*
   Do now, before any Phase D work — catches drift from the B/C/C2 refactors while it's cheap. Scope: dead code, state fields set-but-never-read, lock-predicate correctness, `stageOf()` ordering, egg detection, in-game text staleness, CLAUDE.md / README accuracy, `[x]` claims in this file, memory staleness. Output: findings list below, no fixes in the audit itself.

4. - [x] **Difficulty-aware clue file text** — *medium effort, high benefit*
   Core to the teaching promise: easy players currently read the same cryptic clues as hard players. The enabler (`FsNode.content: (state) => string`) shipped in Phase C, so this is pure content work. Pattern: easy = base text + explicit extra pointer; medium = current text; hard/impossible = terser, hand-holding sentences removed. Files: `README.txt`, `notes.txt`, `clue2.riddle`, `how-to-sudo.txt`. (`editor-tips.txt` is a mechanics doc — same at all difficulties.)

5. - [x] **Tab autocompletion (silent)** — *medium effort, med–high benefit*
   Biggest "feels like a real shell" upgrade; Tab completion is itself CLI education. First token completes command names; later tokens complete paths (FS children + user-created files, reusing `resolvePath`/`findNode`). Multiple matches → longest common prefix. Not mentioned anywhere in UI/help — silent reward for real shell users.

### Final-A Findings *(audit run 2026-07-03; all findings were text/docs and were fixed the same session)*

- [x] `IntroModal.tsx` — said "5 easter eggs", game has 6 — **high** *(fixed)*
- [x] `README.md` — four "five eggs / 5/5 / N/5" references — **high** *(fixed)*
- [x] `README.md` — Stage 7 (SEARCH/grep) entirely missing from puzzle graph + solutions; "six-stage" header — **high** *(fixed: stage 7 walkthrough + graph entry added)*
- [x] `README.md` — claimed `GameState` lives in `src/game/fs.ts` (moved to `src/types.ts` in Phase C) — **low** *(fixed)*
- [x] `fs.ts` sudo_clue.json — leftover `# .b64` comment from the pre-rename filename — **medium** *(fixed)*
- [x] `CLAUDE.md` — backlog claimed tab completion unimplemented and restore button uninvestigated; both done this session — **medium** *(fixed: backlog + new sections)*

**Passed clean:** puzzle graph (all lock predicates, stage gates, egg detection for all 6 eggs incl. the userCreated `/root/final_egg.txt`), save system field coverage + versioning, tab-completion edge cases (locked dirs, user files), no dead code / set-but-never-read state fields.

---

## Parked (deliberate, with reasons)

- **Phase D — v2.0 level-builder architecture** — *high effort (multi-session), low benefit today*
  The generic `flags: Record<string, boolean>` refactor rewrites every lock predicate, `stageOf`, the save format (version bump), and hints — for exactly one existing world. Classic YAGNI risk. **Do not start until a concrete second world is designed on paper.** Design notes preserved below for that day.

- **Debug-mode trophy egg (`debug_mode = on` → hidden `trophy_egg.txt`)** — *low–med effort, low benefit*
  Pure delight feature for the tiny fraction who flip the flag. Fun, but every next-session item serves more players. Revisit after the session list above ships.

- **Stage 4 `knowsSudoPassword` never reset if the decoded value changes** — *low effort, low benefit*
  Fine for the current puzzle; only becomes real if the puzzle changes — which is exactly Phase D territory. Fold into Phase D.

### Phase D design notes (for when world 2 is real)

- Generic `GameState.flags: Record<string, boolean>` replaces hardcoded booleans — central prerequisite for world-agnosticism.
- `WorldDef` interface: `{ id, filesystem, stages, initialState, logic }` per world module under `src/worlds/`.
- World loader: thin shim in App selecting a world at startup (config or URL param).
- Lock predicates and `onEdit` handlers stay TypeScript (`logic.ts`); only content strings get extracted to JSON/YAML for non-programmer editing.

---

## Done (condensed history)

- **Phase A / A2 / A3** — bug fixes (touch/cd resolution, UTF-8 save, map display), map UX polish (`/etc` indent, depth, current-dir highlight, `cron.d`), mobile UX (auto-hide map, responsive top bar/prompt, `[map]` overlay, font step-down).
- **Phase B** — hint shown at current difficulty; hint-repeat nudge toward `difficulty easy`; praise lines in all egg files (**rule: hint/stage text stays encouraging**); stage-skip audit (locks already prevent it); `menu`/`quit` reopen intro without data loss.
- **Phase C** — extracted `src/terminal/` components (App.tsx ~880 → ~300 lines); `src/types.ts`; `src/game/save.ts` (single serialize/deserialize source); `FsNode.content` accepts `(state) => string`. Skipped as YAGNI: hints.ts, difficulty.ts, worlds/ shim.
- **Phase C2** — Stage 7 SEARCH: `/var` tree with realistic logs, `grep [-r]` (skips locked dirs, searches edits + user files), egg 5 hands off to logs, egg 6 finale. Hint overhaul: 3 escalating tiers per stage, difficulty-capped, state-aware tier functions, `hintExhausted()` gates the difficulty nudge.
- **Earlier fixes** — sudo cd /root prerequisite, password-cancel handling, edit rollback message, wifi list reads `/etc/wifi.json`, `showIntro` input blocking, `sudo_clue.json` rename, token filename relaxation, admin gold theme, `base64 -d` whitespace/filename support, `stage.ts` extraction, no state mutation inside `onEdit`.

## Reference notes (implemented behavior)

- **Difficulty table**: stage output full/partial/label/silent; hint tiers easy 1→2, medium 0→1, hard 0→0, impossible forbidden; map always/toggle/toggle/hidden; help full except impossible (exits only).
- **`rm`**: only user-created nodes inside `/home/player`; refuses non-empty dirs; no `-r`.
- **Editor modal**: `Cmd+S`/`Ctrl+S` OS-aware save, `Esc` cancels.
- **Save system**: `save`/`load` via UTF-8-safe base64 (`v: 1`); autosave to `localStorage["eggshell-autosave"]` on every in-game state change.
