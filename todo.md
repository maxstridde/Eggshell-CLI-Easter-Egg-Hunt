# Eggshell — finishing plan

One world, KISS, shipped to maxstridde.de via GitHub Pages. No future worlds.
Branch: `finish-polish`. Small unsigned commits per step.

## Design rules (2026-10-27)

- **Egg = stage.** 7 eggs, 7 stages, one counter. Reading the egg completes it.
- **Four help levels:**
  - 0: the world itself (files, eggs, error messages, door announcements).
  - `hint` 1: a nudge.
  - `hint` 2: a direction.
  - `hint` 3: the exact commands.
  - Every difficulty starts at 1. The cap is easy 3, medium 2, hard 1, impossible none.
- **No commands in objectives or eggs.** Eggs use full verbs ("remove", "copy"). `help` maps each short name to its meaning ("rm — remove"), so names are understood, not memorised.
- **Each egg ends with Hen's pointer to the next one.** The story: Hen, the retiring admin, hid 7 eggs in the machine you inherit.
- **Easy-only lines in files point to `help`, never to exact commands.**
- **Single source:** `scripts/story.mjs` writes every player-facing text in order of appearance to `docs/STORY.md`.

## Incoherences found → fixes

- [ ] Stage 5 DECODE had no egg → merge into egg 5 "The Administrator" (steps: decode → sudo edit)
- [ ] `final_egg.zip` / "THE PRIZE" / trophy is egg 6 of 7, not final → `egg6.zip` / `egg6.txt`, "The Root"
- [ ] `start` says "Try `wifi list`" and the easy objective names exact commands → story-only objectives, `start` teaches ls/cat/help only
- [ ] auth.log shows *player* running `sudo edit /etc/privilege.cfg` before the player did → Hen did it (with nano)
- [ ] Logs say `host01`, but the hostname is `eggshell` → `eggshell`
- [ ] notes.txt and README repeat each other → README = Hen's letter, notes = Hen's sticky notes (`~`, `..`, folders end in /)
- [ ] admin-note.txt is redundant with egg 5 → delete
- [ ] Doors open silently → announce "🔓 ~/x just unlocked" (also replaces the ad-hoc tidy message)
- [ ] Easy started hints at tier 2 → all start at the nudge
- [ ] Hints didn't show that asking again gives more → prefix `hint 1/3:`
- [ ] `stage` and `eggs` duplicate the same concept → `eggs` shows found eggs and the next objective; `stage` is a hidden alias
- [ ] New commands appear in `help` with no signal → after an egg: "(new commands — see `help`)"

## Work items

- [ ] Story + texts (fs.ts, stage.ts, commands.ts, App banner, IntroModal)
- [ ] Merge stages 5+6 → 7 stages; rename egg6 files; eggs/top bar show egg names
- [ ] Hint tiers 1–3, cap per difficulty, `n/max` prefix
- [ ] Door announcements (App effect on stage `opened` flip)
- [ ] `help` grouped (shell vs game), meanings of names; `man <cmd>` shows one entry
- [ ] Aliases: `nano`, `vim`, `vi` → edit; `exit` → menu (hidden)
- [ ] Editor keyboard: Esc/Ctrl+S from anywhere in the modal, Ctrl+O (nano save); intro `[ enter shell ]` autofocus
- [ ] `scripts/story.mjs` → `docs/STORY.md`
- [ ] Ghost-text autocomplete (→ / Tab accepts, double Tab lists candidates); mention in start/help/intro
- [ ] Playthrough check updated
- [ ] Ship: vite base `./`, deploy.yml stray quote, package name, index.html egg count + og:url
- [ ] README: minimal solution; MIT LICENSE; CLAUDE.md updated
- [ ] You play `npm run preview` → merge to main → deploy

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
