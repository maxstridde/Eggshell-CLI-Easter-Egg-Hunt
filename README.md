# 🥚 Eggshell — The CLI Easter Egg Hunt

> A minimal, browser-based terminal game for kids and high-school students
> who have never used a command line. The goal is to make people comfortable
> with a CLI so they don't feel forced to rely solely on graphical interfaces.

---

## Manifesto / Why this game exists

Every computer ships with a terminal. Phones, tablets, servers,
Raspberry Pis, self-driving cars, satellites, cloud services — they all
speak the language of the shell. And yet most users are taught to fear it,
or simply never taught it at all. They click through 17 menus to do what a
single typed command would do in half a second.

**Eggshell** is a gentle introduction. It is not a "real" shell — it is a
*training shell*. It teaches the *shape* of a command line:

- a prompt with a user, a host, and a current directory,
- a vocabulary of short verbs (`ls`, `cd`, `cat`, `mkdir`, `touch`, `edit`,
  `sudo`, …),
- arguments, flags, absolute vs. relative paths,
- the idea that *files and folders are the API of the system*,
- the idea that some doors are locked until a config file says otherwise,
- the idea that some actions require a password and elevated privileges.

The game is an **easter-egg hunt**. Five eggs are hidden in the virtual
filesystem. To reach each one, the player must earn the next skill, and
that skill unlocks the next room. Nothing is "fake" — every concept in
Eggshell maps 1:1 onto something you would do in a real Linux, macOS, or
WSL terminal.

### Design principles

1. **Minimal visual style.** Black background. Green text. A blinking
   cursor. No animations, no gradients, no chrome. A CLI should *look* like
   a CLI.
2. **Failure is friendly.** Unknown commands print `command not found` —
   just like a real shell — but the game never yells at the player. The
   `help` command is always one keystroke away.
3. **Staged progression.** The filesystem is a graph of locked rooms. You
   can *see* the next room in `ls` (it shows `[locked]`), but you cannot
   enter it until you complete the previous task. This creates a clear
   "what's next?" feeling without being strictly linear.
4. **Config files as puzzles.** The text editor is not a toy. Players must
   actually change a line like `path_to_vault_locked = true` to `false` to
   proceed. This mirrors how `/etc/sudoers`, `nginx.conf`, `sshd_config`,
   and a thousand other real-world files actually work.
5. **Privilege escalation as a plot point.** `sudo` is not just another
   command — it is the final boss. The player must find a password hidden as
   a base64-encoded string, decode it, and use it to edit a system file
   that lives in `/etc`. That is, in a nutshell, what being a sysadmin is.

---

## How to play

```bash
npm install
npm run dev
```

Then open the URL Vite prints. You start in `/home/player`. Type `help`.

### Commands implemented

| command | what it does |
| --- | --- |
| `help` | print the command list |
| `clear` / `cls` | clear the screen |
| `pwd` | print current directory |
| `ls [path]` | list directory contents |
| `cd <path>` | change directory (`..` goes up) |
| `cat <file>` | print a file |
| `mkdir <name>` | create a directory (inside `/home/player`) |
| `touch <name>` | create an empty file |
| `edit <file>` | open the built-in text editor |
| `wifi list` | show available Wi-Fi networks |
| `wifi connect <SSID>` | connect (prompts for a password) |
| `base64 -d <string>` | decode a base64 string |
| `sudo <command>` | run a command as root (prompts for password) |
| `eggs` | show how many eggs you've found |
| `stage` | print the current stage |

Arrow-up / arrow-down walk through command history. `Ctrl+L` clears the
screen, just like a real shell.

---

## Game concept (for teachers / game-masters)

The filesystem is a tree. Some directories are **locked** — they are
visible in `ls` (so the player always knows *what to aim for*), but `cd`
is refused until a predicate on the game state becomes true.

The stages form a **DAG** — not strictly linear, but each stage depends on
most of the previous ones being complete.

```
Stage 1: OFFLINE ──► connect Wi-Fi  ──►  unlocks /home/player/documents
Stage 2: CREATE  ──► mkdir magic + touch magic/token.txt ──► unlocks /home/player/secrets
Stage 3: EDIT    ──► edit secrets.cfg (flip a boolean) ──► unlocks /home/player/vault
Stage 4: DECODE  ──► base64 -d <clue> ──► reveals the sudo password
Stage 5: SUDO    ──► sudo edit /etc/privilege.cfg ──► unlocks /admin and /root
Stage 6: ROOT    ──► sudo cd /root ──► cat final_egg.txt  (the prize)
```

Each stage also contains an **egg file** (`egg1.txt`, `egg2.txt`, …).
Reading the egg with `cat` adds it to the player's collection (check with
`eggs`). The game is won when all five are collected.

The non-linearity: a curious player can explore `/etc` from the very start,
read `/etc/hostname`, `/etc/issue`, and `/etc/wifi.json` — all useful
clues. They can also pre-read the riddle files inside `documents` once
Stage 1 is done, before solving Stage 2. But they cannot skip a stage
entirely, because each locked directory guards the next.

---

## Solutions (in order)

> **Spoilers below.** Teachers: keep this section for yourself, or hand it
> out only after students have tried on their own.

### Stage 1 — Get online

1. `help` — see the command list.
2. `cat README.txt` — read the intro. It mentions Wi-Fi.
3. `wifi list` — shows 4 networks. `EggHunt-5G` has the strongest signal.
4. `wifi connect EggHunt-5G` — password prompt.
5. Password: **`yolk-yolk-123`** (also visible in plaintext inside
   `/etc/wifi.json` if the player `cat`s it — on purpose, so they learn
   that "config files contain secrets").
6. You are ONLINE. `/home/player/documents` is now unlocked.

### Stage 2 — The magic directory

1. `cd documents` then `ls`.
2. `cat egg1.txt` — 🥚 #1 collected.
3. `cat clue2.riddle` — it tells you to create a directory called `magic`
   and inside it a file called `token.txt`.
4. `cd ..` (back to `/home/player`).
5. `mkdir magic` — creates the directory.
6. `touch magic/token.txt` — creates the empty file.
7. `ls` now shows `secrets/` without the `[locked]` tag.

### Stage 3 — The config file

1. `cd secrets` then `ls`.
2. `cat egg2.txt` — 🥚 #2 collected. It points you at `secrets.cfg`.
3. `edit secrets.cfg` — opens the built-in editor.
4. Change the line `path_to_vault_locked = true` to
   `path_to_vault_locked = false`. Save.
5. `cd ..` then `ls`. The `vault/` directory is now unlocked.

### Stage 4 — Decode the password

1. `cd vault` then `ls`.
2. `cat egg3.txt` — 🥚 #3 collected.
3. `cat sudo_clue.b64` — shows the string `c2VjcmV0LWVnZw==`.
4. `base64 -d c2VjcmV0LWVnZw==` — outputs **`secret-egg`**.
   This is the `sudo` password.

### Stage 5 — Privilege escalation

1. `cat how-to-sudo.txt` — explains `sudo`.
2. Try `edit /etc/privilege.cfg` — permission denied. The file lives in
   `/etc` and requires root.
3. `sudo edit /etc/privilege.cfg` — password prompt. Enter `secret-egg`.
4. In the editor, change `allow_admin = false` to `allow_admin = true`.
   Save.
5. `cd /home/player` then `ls` — the `admin/` directory is now unlocked.
6. `cd admin` then `cat egg4.txt` — 🥚 #4 collected.

### Stage 6 — Become root

1. `egg4.txt` tells you the final egg lives in `/root`.
2. `cd /root` — permission denied. Suggests `sudo cd /root`.
3. `sudo cd /root` — password prompt. Enter `secret-egg` again.
4. `cat final_egg.txt` — 🏆 the final egg!
5. Type `eggs` to confirm: **5 / 5**. You win.

---

## Build prompt (for AI / future contributors)

If you are an AI assistant or a developer reading this file and you want to
rebuild or extend **Eggshell**, here is the complete specification.

### Tech stack

- **React 19** + **Vite** + **TypeScript** + **Tailwind CSS** (already in
  `package.json`).
- No other runtime dependencies. The terminal is a `<textarea>`-driven
  React component — no `xterm.js`, no heavy shell emulators.

### File layout

```
src/
  App.tsx              — terminal UI: prompt, history, scroll, modals
  game/
    fs.ts              — virtual filesystem (tree of FsNode), game state
    commands.ts        — command dictionary: ls, cd, cat, edit, sudo, …
  main.tsx, index.css  — entry points (unchanged from default template)
README.md              — this file (manifesto + solutions)
index.html             — <title> set to "Eggshell — The CLI Easter Egg Hunt"
```

### Game-state model

A single `GameState` object lives in `src/game/fs.ts`. Locked directories
carry a predicate `(state) => boolean` — when it returns `true`, the
directory is shown with `[locked]` in `ls` and `cd` refuses to enter it.
Commands mutate this state via `setState((s) => …)`.

### The six-stage puzzle graph

1. **Wi-Fi gate.** `wifi list` shows 4 networks. Only `EggHunt-5G` with
   password `yolk-yolk-123` gives internet. Unlocks `/home/player/documents`.
2. **Create gate.** Player must `mkdir magic` and `touch magic/token.txt`.
   Unlocks `/home/player/secrets`.
3. **Editor gate.** `edit secrets.cfg`, flip `path_to_vault_locked` from
   `true` to `false`. Unlocks `/home/player/vault`.
4. **Decoder gate.** `base64 -d c2VjcmV0LWVnZw==` → `secret-egg`.
5. **sudo gate.** `sudo edit /etc/privilege.cfg`, flip `allow_admin` from
   `false` to `true`. Unlocks `/home/player/admin` and `/root`.
6. **Root.** `sudo cd /root`, `cat final_egg.txt`.

Each stage contains one `eggN.txt`. Reading it with `cat` appends the path
to `state.eggsFound[]`.

### Visual / UX rules

- Strictly monochrome terminal palette: black background, emerald/gray/red
  foreground, monospace font only.
- A fake "window chrome" at the top with three dots (red/yellow/green) and
  a counter `🥚 eggs N/5 · stage: <stage>`.
- Command history on arrow-up/arrow-down. `Ctrl+L` or `clear` clears the
  screen.
- Password prompts and the text editor open as **centered modal windows**
  with `[cancel]` / `[save]` buttons — the editor also accepts `Ctrl+S`
  and `Esc`.
- Unknown commands print `command not found`. Non-existent paths print
  `No such file or directory`. Locked directories print `cd: '<name>' is
  locked.` with a short hint.

### What to teach next (post-game)

Once a player finishes Eggshell, point them at a real shell:

- **Windows:** install WSL. Open the Ubuntu terminal. Run `ls`.
- **macOS:** open `/Applications/Utilities/Terminal.app`.
- **Linux:** you already have one.

Suggested first commands in a real shell: `ls -la`, `cd ~`, `pwd`,
`mkdir projects`, `nano hello.txt`, `cat hello.txt`, `sudo apt update`
(or `brew install`). They already know the concepts — they just need real
muscle memory.

---

## License

MIT — do whatever you want with this. Teach it in classrooms. Steal ideas
for your own game. Just don't call it "AI-powered" unless it actually is.
