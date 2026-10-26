# 🥚 Eggshell — The CLI Easter Egg Hunt

A minimal, browser-based terminal game for people who have never used a command line. It is a *training shell*, not a real one, but every concept maps 1:1 onto a real Linux, macOS, or WSL terminal.

**Play:** https://maxstridde.de/Eggshell-CLI-Easter-Egg-Hunt/

## Story

Hen, the retiring admin of `eggshell.local`, hid 7 eggs in the system. One egg = one stage. Each stage teaches a real skill and unlocks the next room.

| # | Egg | Skill |
| --- | --- | --- |
| 1 | The Signal | `wifi`, reading config files |
| 2 | The Builder | `mkdir`, `touch` |
| 3 | The Janitor | `rm`, `mv` |
| 4 | The Editor | `cp`, `edit` (also `nano` / `vim`) |
| 5 | The Administrator | `base64`, `sudo` |
| 6 | The Root | `sudo cd`, `unzip` |
| 7 | The Investigator | `grep -r` |

Reading an `eggN.txt` with `cat` collects it. Win = all 7.

## Features

- `help` reveals commands progressively, with the meaning of each name. `man <cmd>` explains one in detail.
- `hint` escalates in 3 tiers (nudge, direction, exact commands), capped by difficulty: easy 3, medium 2, hard 1, impossible none. Change with `difficulty <level>`.
- Tab completion for commands and paths. `nano` and `vim` are aliases of `edit`.
- `save` / `load <string>` export and restore progress; the game also autosaves to localStorage.
- A map panel shows the filesystem (always on for easy, `map` toggles it otherwise).
- Arrow keys walk history, `Ctrl+L` clears the screen.

## Run locally

```bash
npm install
npm run dev       # dev server
npm run build     # single self-contained HTML (vite-plugin-singlefile) in dist/
npm run preview   # preview the build
npx tsc --noEmit  # type-check
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml`.

<details>
<summary>Solution (spoilers)</summary>

```
cat /etc/wifi.json
wifi connect EggHunt-5G        # password: yolk-yolk-123
cat ~/documents/egg1.txt
mkdir ~/magic
touch ~/magic/token.txt
cat ~/secrets/egg2.txt
cd ~/secrets
rm *.tmp
mv report.txt ~/documents/
cat egg3.txt
cp secrets.cfg secrets.cfg.bak
edit secrets.cfg               # path_to_vault_locked = false, Ctrl+S
cat ~/vault/egg4.txt
base64 -d c2VjcmV0LWVnZw==     # → secret-egg
sudo edit /etc/privilege.cfg   # password secret-egg; allow_admin=true, Ctrl+S
cat ~/admin/egg5.txt
sudo cd /root
unzip egg6.zip
cat egg6.txt
grep -r egg /var/log
cat /var/backups/egg7.txt
```

</details>

## Code layout

See `CLAUDE.md` for architecture notes. In short: `src/game/fs.ts` (virtual filesystem and lock predicates), `commands.ts` (handlers), `stage.ts` (stages and hints), `save.ts` (save/load), `src/terminal/` (UI).

## Credits and license

Built with React, Vite, TypeScript and Tailwind CSS, with Anthropic's Claude as a coding collaborator; game design and direction are human. Released under the [MIT License](LICENSE).
