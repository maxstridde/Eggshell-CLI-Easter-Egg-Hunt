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

- [x] Stage 5 DECODE had no egg → merge into egg 5 "The Administrator" (steps: decode → sudo edit)
- [x] `final_egg.zip` / "THE PRIZE" / trophy is egg 6 of 7, not final → `egg6.zip` / `egg6.txt`, "The Root"
- [x] `start` says "Try `wifi list`" and the easy objective names exact commands → story-only objectives, `start` teaches ls/cat/help only
- [x] auth.log shows *player* running `sudo edit /etc/privilege.cfg` before the player did → Hen did it (with nano)
- [x] Logs say `host01`, but the hostname is `eggshell` → `eggshell`
- [x] notes.txt and README repeat each other → README = Hen's letter, notes = Hen's sticky notes (`~`, `..`, folders end in /)
- [x] admin-note.txt is redundant with egg 5 → delete
- [x] Doors open silently → announce "🔓 ~/x just unlocked" (also replaces the ad-hoc tidy message)
- [x] Easy started hints at tier 2 → all start at the nudge
- [x] Hints didn't show that asking again gives more → prefix `hint 1/3:`
- [x] `stage` and `eggs` duplicate the same concept → `eggs` shows found eggs and the next objective; `stage` is a hidden alias
- [x] New commands appear in `help` with no signal → after an egg: "(new commands — see `help`)"

## Work items

- [x] `scripts/story.mjs` → `docs/STORY.md`
- [x] CLAUDE.md updated
- [ ] You play `npm run preview` → merge to main → deploy
- [x] Ghost-text autocomplete (→ / Tab accepts, double Tab lists candidates); mention in start/help/intro
- [x] Ship: vite base `./`, deploy.yml stray quote, package name, index.html egg count + og:url
- [x] README: minimal solution; MIT LICENSE
- [x] Story + texts (fs.ts, stage.ts, commands.ts, App banner, IntroModal)
- [x] Merge stages 5+6 → 7 stages; rename egg6 files; eggs/top bar show egg names
- [x] Hint tiers 1–3, cap per difficulty, `n/max` prefix
- [x] Door announcements (App effect on stage `opened` flip)
- [x] `help` grouped (shell vs game), meanings of names; `man <cmd>` shows one entry
- [x] Aliases: `nano`, `vim`, `vi` → edit; `exit` → menu (hidden)
- [x] Editor keyboard: Esc/Ctrl+S from anywhere in the modal, Ctrl+O (nano save); intro `[ enter shell ]` autofocus
- [x] Story dates follow the player's clock (logs yesterday, retirement in 3 days, never saved)

## Playtest 1 (2026-10-27) → fixes

- [x] Intro "onFriday" space; Enter on empty line prints a prompt; empty lines keep height
- [x] `difficulty` / `man` argument completion; `/root` contents not completed before entering
- [x] Egg 2: riddle says ~ itself (not documents); permission error explains only ~ is writable
- [x] Map: /home → player/ (~) tree level; eggs not blue; current folder ◂
- [x] Admin theme: white headings, sky announcements; grayscale says how to get colour back
- [x] Contrast ≥ 4:1, colour-blind markers
- [x] `help` marks new commands
- [x] Hidden files: `ls -a`, egg 3 `.cache.tmp`, egg 7 in `/var/backups/.attic/2019/misc`
- [x] Egg 7: messy backups with decoys + 3 easter eggs (Rooster's IOU, grocery list, chicken)
- [x] Per-egg time/commands vs. Hen's way; ASCII win celebration
- [x] schema.org JSON-LD enriched
- [ ] Playtest 2 → merge to main → deploy
- [x] Playthrough check updated (19 checks: bypasses, hint reset, door announce, new-commands nudge, nano alias, win)

## Inspiration: learnGitBranching (researched 2026-10-27)

Its teaching model: each level opens with a short concept dialog, then the task. The goal is shown as a target picture, and the win is a **state comparison** (any path counts). The `hint` is one plain string. `show solution` replays the commands visibly, behind an "are you sure? I believe in you" confirm. `objective` re-shows the intro. Par scoring compares your command count to the solution's. `disabledMap` blocks commands per level.

Already matching here: state-based wins (locks check state, not typed commands), objective (`eggs`), concept framing (every egg plus Hen's pointer), and in-world refusals instead of "command not found".

Suggestions (both adopted 2026-10-27):
- [x] **Confirm before the exact tier.** The first time the tier with the exact commands is reached, print "The next hint is the exact answer. Type `hint` again if you want it." This fits "hints only after trying". Effort S.
- [x] **Command count on the win.** Print "You used N commands (Hen's way: 21)". It adds replay value. Effort S.
- [ ] **Replay the solution (`hint` tier 3 as typed commands).** Skip: it spoils the doing.

Not copied: goal graph and animations (monochrome CLI rule), level select/sandbox/builder (one world), i18n machinery, and a free solution reveal (the egg text is the reward).

## Done (condensed history)

- **Phase A / A2 / A3** — bug fixes (touch/cd resolution, UTF-8 save, map display), map UX polish (`/etc` indent, depth, current-dir highlight, `cron.d`), mobile UX (auto-hide map, responsive top bar/prompt, `[map]` overlay, font step-down).
- **Phase B** — hint shown at current difficulty; hint-repeat nudge toward `difficulty easy`; praise lines in all egg files (**rule: hint/stage text stays encouraging**); stage-skip audit (locks already prevent it); `menu`/`quit` reopen intro without data loss.
- **Phase C** — extracted `src/terminal/` components (App.tsx ~880 → ~300 lines); `src/types.ts`; `src/game/save.ts` (single serialize/deserialize source); `FsNode.content` accepts `(state) => string`. Skipped as YAGNI: hints.ts, difficulty.ts, worlds/ shim.
- **Phase C2** — Stage 7 SEARCH: `/var` tree with realistic logs, `grep [-r]` (skips locked dirs, searches edits + user files), egg 5 hands off to logs, egg 6 finale. Hint overhaul: 3 escalating tiers per stage, difficulty-capped, state-aware tier functions, `hintExhausted()` gates the difficulty nudge.
- **Earlier fixes** — sudo cd /root prerequisite, password-cancel handling, edit rollback message, wifi list reads `/etc/wifi.json`, `showIntro` input blocking, `sudo_clue.json` rename, token filename relaxation, admin gold theme, `base64 -d` whitespace/filename support, `stage.ts` extraction, no state mutation inside `onEdit`.

## Reference notes (implemented behavior)

- **Difficulty table**: eggs objective full/full/name only/silent; hint tiers start at 1, caps easy 3, medium 2, hard 1, impossible none; map always/toggle/toggle/hidden; help full except impossible (exits only).
- **`rm`**: only user-created nodes inside `/home/player`; refuses non-empty dirs; no `-r`.
- **Editor modal**: `Cmd+S`/`Ctrl+S`/`Ctrl+O` save, `Esc` cancels, from anywhere in the modal.
- **Save system**: `save`/`load` via UTF-8-safe base64 (`v: 2`); autosave to `localStorage["eggshell-autosave"]` on every in-game state change.
