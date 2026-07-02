// Virtual filesystem for Eggshell
// Nodes are either directories or files.
// Locked directories cannot be `cd`'d into until a predicate returns true.

import { FsNode, GameState, TerminalUser } from "../types";

// Resolves a file node's content, calling it if it's a difficulty/progress-aware function.
export function fileContent(node: FsNode & { kind: "file" }, state: GameState): string {
  return typeof node.content === "function" ? node.content(state) : node.content;
}

// --- Helpers for building the tree with less repetition -----------------

const dir = (
  name: string,
  children: FsNode[],
  opts: { locked?: (s: GameState) => boolean; hint?: string } = {}
): FsNode => ({ kind: "dir", name, children, ...opts });

const file = (
  name: string,
  content: string | ((s: GameState) => string),
  opts: { editable?: boolean; onEdit?: (c: string) => { error: string | null; patch?: Partial<GameState> } } = {}
): FsNode => ({ kind: "file", name, content, ...opts });

// Clue-text pattern: easy = base + explicit extra pointer, medium = base,
// hard/impossible = base with the hand-holding lines stripped.
const isEasy = (s: GameState) => s.difficulty === "easy";
const isHardOrWorse = (s: GameState) => s.difficulty === "hard" || s.difficulty === "impossible";

// --- The actual filesystem ----------------------------------------------

export function buildFilesystem(): FsNode {
  return dir("/", [
    dir("etc", [
      file(
        "hostname",
        "eggshell.local\n"
      ),
      file(
        "issue",
        "EggshellOS 1.0 — Welcome, player. Type `help` to get started.\n"
      ),
      dir("cron.d", [
        file(
          "daily-backup",
          "# run daily at 02:30 — backs up /var and /etc\n" +
            "30 2 * * * root /usr/local/bin/backup.sh /var /etc >> /var/log/backup.log 2>&1\n"
        ),
      ]),
      file(
        "wifi.json",
        JSON.stringify(
          {
            networks: [
              { ssid: "NETGEAR-guest", signal: 42, password: "???" },
              { ssid: "EggHunt-5G", signal: 88, password: "yolk-yolk-123" },
              { ssid: "Starbucks-WiFi", signal: 21, password: "???" },
              { ssid: "hidden-ssid", signal: 0, password: "???" },
            ],
          },
          null,
          2
        ) + "\n"
      ),
      file(
        "privilege.cfg",
        "# /etc/privilege.cfg — system privilege configuration\n" +
          "# This file requires elevated access to modify.\n" +
          "#\n" +
          "# Settings here control which accounts hold administrative rights\n" +
          "# on this machine. Incorrect values may have unexpected side effects.\n" +
          "\n" +
          "allow_admin=false\n" +
          "default_user=player    # default is 'player'; also accepts 'admin'\n",
        {
          editable: true,
          onEdit: (c) => {
            const adminUnlocked = /allow_admin\s*=\s*true/i.test(c);
            const userMatch = c.match(/default_user\s*=\s*(\S+)/i);
            const terminalUser: TerminalUser = userMatch
              ? (["player", "admin"].includes(userMatch[1])
                  ? (userMatch[1] as TerminalUser)
                  : "other")
              : "player";
            return { error: null, patch: { adminUnlocked, terminalUser } };
          },
        }
      ),
    ]),
    dir("home", [
      dir("player", [
        file("README.txt", (s) => {
          const base =
            "=== WELCOME TO EGGSHELL ===\n" +
            "\n" +
            "You are sitting at a fresh terminal. Your mission:\n" +
            "find the 6 hidden easter eggs scattered through this system.\n" +
            "\n" +
            "Useful commands:\n" +
            "  help        — show the command list\n" +
            "  ls          — list files in the current directory\n" +
            "  cat <file>  — print a file\n" +
            "  pwd         — print current path\n" +
            "\n" +
            "Something is preventing you from exploring further.\n";
          if (isHardOrWorse(s)) return base;
          return (
            base +
            "The system keeps network information in /etc.\n" +
            (isEasy(s) ? "Try `ls /etc` and read what you find there.\n" : "")
          );
        }),
        file("notes.txt", (s) =>
          isHardOrWorse(s)
            ? "Player's notebook:\n" +
              "- First egg is said to be in ~/documents/ — but that directory is LOCKED.\n" +
              "- Somewhere in this home folder, a special directory must be created.\n" +
              "  And something left inside it.\n"
            : "Player's notebook:\n" +
              "- First egg is said to be in ~/documents/\n" +
              "  But that directory is LOCKED.\n" +
              "  You need to be connected to a network to enter.\n" +
              "- Somewhere in this home folder, a special directory must be created.\n" +
              "  And something left inside it — like proof you were there.\n" +
              "  Only then will a certain door open...\n" +
              (isEasy(s)
                ? "- PS: the `wifi` command manages networks. Passwords tend to\n" +
                  "  sit in config files — and config files live in /etc.\n"
                : "")
        ),
        dir("documents", [
          file(
            "egg1.txt",
            "🥚 EGG #1 FOUND — 'The Starter' 🥚\n" +
              "You connected to a network and found your way here.\n" +
              "\n" +
              "Skills demonstrated:\n" +
              "  wifi list / wifi connect — network management\n" +
              "  ls                       — list directory contents\n" +
              "  cd                       — navigate the filesystem\n" +
              "\n" +
              "On real machines, /etc/network/interfaces or NetworkManager\n" +
              "handle this. On macOS: System Settings → Wi-Fi.\n" +
              "Config files store secrets. Now you know.\n" +
              "\n" +
              "Brilliant start — you're already thinking like a shell user. Keep going!\n"
          ),
          file("clue2.riddle", (s) =>
            "Riddle #2:\n" +
              "  'Deep in the player's home there is a hollow.\n" +
              "   Fill it with a folder called magic,\n" +
              "   and inside that folder, leave a token.\n" +
              "   Only then will the secrets room open its gates.'\n" +
              (isEasy(s)
                ? "\n(In plain words: in your home folder, create a directory\n" +
                  " named magic, and create a file named token.txt inside it.\n" +
                  " `help` lists the commands for both.)\n"
                : "")
          ),
        ], {
          locked: (s) => !s.wifiConnected,
        }),
        dir("secrets", [
          file(
            "secrets.cfg",
            "# secrets.cfg — access control for protected directories\n" +
              "\n" +
              "path_to_vault_locked = true\n" +
              "debug_mode = off\n",
            {
              editable: true,
              onEdit: (c) => ({
                error: null,
                patch: { secretsUnlocked: /path_to_vault_locked\s*=\s*false/i.test(c) },
              }),
            }
          ),
          file(
            "egg2.txt",
            "🥚 EGG #2 FOUND — 'The Builder' 🥚\n" +
              "You created a directory and a file from scratch.\n" +
              "\n" +
              "Skills demonstrated:\n" +
              "  mkdir  — create a directory\n" +
              "  touch  — create an empty file\n" +
              "\n" +
              "Every project starts this way.\n" +
              "Filesystems are built one node at a time.\n" +
              "\n" +
              "Nicely done — you're building, not just browsing. That's the real skill.\n"
          ),
          file(
            "editor-tips.txt",
            "=== Using `edit` ===\n" +
              "`edit <filename>` opens a tiny built-in text editor.\n" +
              "  - Change lines, then press [SAVE] to write.\n" +
              "  - Press [CANCEL] to quit without saving.\n" +
              "Only `.cfg`, `.txt`, `.md`, and `.riddle` files can be edited here.\n"
          ),
        ], {
          locked: (s) => !(s.createdMagicDir && s.createdTokenFile),
        }),
        dir("vault", [
          file(
            "egg3.txt",
            "🥚 EGG #3 FOUND — 'The Editor' 🥚\n" +
              "You opened a config file and changed a value.\n" +
              "\n" +
              "Skills demonstrated:\n" +
              "  edit  — modify a text file in the built-in editor\n" +
              "\n" +
              "Real systems work exactly like this:\n" +
              "/etc/nginx/nginx.conf, ~/.ssh/config, /etc/fstab —\n" +
              "a line changed, a service restarted.\n" +
              "Config files are the API of the system.\n" +
              "\n" +
              "You just bent the system to your will with one edit. That's power — well earned.\n"
          ),
          file(
            "sudo_clue.json",
            "# structured credential token\n" +
              "# field values that are encoded must be decoded before use\n" +
              "# this file can be decoded in full, but only one field matters\n" +
              "\n" +
              "{\n" +
              "  \"token_type\":  \"system-credential\",\n" +
              "  \"issued_by\":   \"eggshell-vault\",\n" +
              "  \"expires\":     \"never\",\n" +
              "  \"note\":        \"you can read the metadata just fine — clever, right?\",\n" +
              "  \"passphrase\":  \"c2VjcmV0LWVnZw==\"\n" +
              "}\n"
          ),
          file("how-to-sudo.txt", (s) => {
            const base =
              "=== sudo ===\n" +
              "`sudo` runs a single command as the administrator (root).\n" +
              "Syntax:  sudo <command> <args...>\n" +
              "\n" +
              "You will be asked for the admin password.\n";
            if (isHardOrWorse(s)) return base;
            return (
              base +
              "The credential is stored somewhere in this vault.\n" +
              "Look around — encoded things can be decoded.\n" +
              (isEasy(s)
                ? "(The passphrase in sudo_clue.json is base64 —\n" +
                  " `base64 -d <value>` turns it back into plain text.)\n"
                : "")
            );
          }),
        ], {
          locked: (s) => !s.secretsUnlocked,
        }),
        dir("admin", [
          file(
            "egg4.txt",
            "🥚 EGG #4 FOUND — 'The Administrator' 🥚\n" +
              "You ran a command as root and changed a system-level config.\n" +
              "\n" +
              "Skills demonstrated:\n" +
              "  sudo  — execute as administrator\n" +
              "  edit  — modify a protected file\n" +
              "\n" +
              "In real systems, sudo gives temporary root access.\n" +
              "Every Linux server relies on this — from installing packages\n" +
              "to editing /etc/sudoers itself.\n" +
              "You now understand the basics of privilege escalation.\n" +
              "\n" +
              "Root is almost yours — one egg to go. You've come impressively far.\n"
          ),
          file(
            "admin-note.txt",
            "You are in /admin — a directory that required editing /etc/privilege.cfg.\n" +
              "Real-world equivalents: /etc/sudoers, group policies, ACLs.\n" +
              "\n" +
              "Admin access here grants elevated capabilities.\n" +
              "The root of this machine may now be within reach.\n"
          ),
        ], {
          locked: (s) => !s.adminUnlocked,
        }),
      ]),
    ]),
    dir("root", [
      file(
        "final_egg.zip",
        "[binary archive]\n"
      ),
    ], {
      locked: (s) => !s.adminUnlocked,
    }),
    dir("var", [
      dir("log", [
        file(
          "auth.log",
          "Apr 12 06:25:01 host01 CRON[882]: pam_unix(cron:session): session opened for user root\n" +
            "Apr 12 06:25:03 host01 CRON[882]: pam_unix(cron:session): session closed for user root\n" +
            "Apr 12 07:14:22 host01 sshd[1203]: Failed password for invalid user admin from 10.0.0.5 port 51122\n" +
            "Apr 12 07:14:25 host01 sshd[1203]: Connection closed by invalid user admin 10.0.0.5 port 51122\n" +
            "Apr 12 08:02:11 host01 sudo:   player : TTY=pts/0 ; PWD=/home/player ; COMMAND=/usr/bin/edit /etc/privilege.cfg\n" +
            "Apr 12 08:02:11 host01 sudo: pam_unix(sudo:session): session opened for user root\n" +
            "Apr 12 08:02:14 host01 sudo: pam_unix(sudo:session): session closed for user root\n" +
            "Apr 12 08:31:47 host01 sshd[1490]: Accepted publickey for player from 10.0.0.9 port 40018\n"
        ),
        file(
          "syslog",
          "Apr 12 06:25:01 host01 rsyslogd: [origin software=\"rsyslogd\"] rsyslogd was HUPed\n" +
            "Apr 12 06:30:00 host01 systemd[1]: Starting Daily apt download activities...\n" +
            "Apr 12 06:30:02 host01 systemd[1]: apt-daily.service: Succeeded.\n" +
            "Apr 12 06:47:19 host01 kernel: [ 8123.442] usb 1-2: new high-speed USB device number 4\n" +
            "Apr 12 07:00:00 host01 systemd[1]: logrotate.service: Succeeded.\n" +
            "Apr 12 07:12:38 host01 NetworkManager[610]: <info> device (wlan0): state change: activated\n" +
            "Apr 12 07:55:03 host01 easterd[312]: sweep complete — one asset still unaccounted for\n" +
            "Apr 12 07:55:04 host01 easterd[312]: relocating asset to /var/backups/egg6.txt\n" +
            "Apr 12 07:55:04 host01 easterd[312]: asset secured. nobody reads the logs anyway.\n" +
            "Apr 12 08:00:00 host01 systemd[1]: Starting Cleanup of Temporary Directories...\n" +
            "Apr 12 08:00:01 host01 systemd[1]: systemd-tmpfiles-clean.service: Succeeded.\n" +
            "Apr 12 08:17:44 host01 kernel: [13544.108] audit: type=1400 apparmor=\"ALLOWED\" profile=\"lsb_release\"\n" +
            "Apr 12 08:30:00 host01 systemd[1]: Starting Rotate log files...\n" +
            "Apr 12 08:30:01 host01 systemd[1]: logrotate.service: Succeeded.\n"
        ),
        file(
          "dpkg.log",
          "2026-04-11 22:10:03 startup archives unpack\n" +
            "2026-04-11 22:10:05 install curl:amd64 <none> 7.88.1-10\n" +
            "2026-04-11 22:10:06 status installed curl:amd64 7.88.1-10\n" +
            "2026-04-11 22:10:09 install jq:amd64 <none> 1.6-2.1\n" +
            "2026-04-11 22:10:10 status installed jq:amd64 1.6-2.1\n" +
            "2026-04-11 22:11:31 install tree:amd64 <none> 2.1.0-1\n" +
            "2026-04-11 22:11:32 status installed tree:amd64 2.1.0-1\n"
        ),
      // cd/ls only check the target node's lock, so subdirs repeat the parent's
      ], { locked: (s) => !s.finalEggFound }),
      dir("backups", [
        file(
          "egg6.txt",
          "🥚 EGG #6 FOUND — 'The Investigator' 🥚\n" +
            "You didn't read the logs. You searched them. That's the way.\n" +
            "\n" +
            "Skills demonstrated:\n" +
            "  grep     — search file contents for matching lines\n" +
            "  grep -r  — search a whole directory tree\n" +
            "\n" +
            "This is how real problems get found:\n" +
            "  grep -r \"error\" /var/log\n" +
            "  grep \"Failed password\" /var/log/auth.log\n" +
            "The needle never stood a chance.\n" +
            "\n" +
            "That's all six eggs — the hunt is complete. Outstanding work.\n" +
            "\n" +
            "Now go try a real shell:\n" +
            "  Windows: install WSL — open the Ubuntu app\n" +
            "  macOS:   Applications → Utilities → Terminal\n" +
            "  Linux:   you're already home\n" +
            "\n" +
            "Type `eggs` to admire your collection. You've earned it.\n"
        ),
      ], { locked: (s) => !s.finalEggFound }),
    ], {
      locked: (s) => !s.finalEggFound,
    }),
  ]);
}

// --- Filesystem helpers --------------------------------------------------

export function resolvePath(cwd: string, target: string): string {
  if (!target) return cwd;
  // expand ~ to home directory
  if (target === "~") return "/home/player";
  if (target.startsWith("~/")) target = "/home/player/" + target.slice(2);
  const isAbs = target.startsWith("/");
  const base = isAbs ? "/" : cwd;
  const parts = base.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return "/" + parts.join("/");
}

export function findNode(root: FsNode, path: string): FsNode | null {
  if (path === "/" || path === "") return root;
  const parts = path.split("/").filter(Boolean);
  let cur: FsNode = root;
  for (const p of parts) {
    if (cur.kind !== "dir") return null;
    const next = cur.children.find((c) => c.name === p);
    if (!next) return null;
    cur = next;
  }
  return cur;
}
