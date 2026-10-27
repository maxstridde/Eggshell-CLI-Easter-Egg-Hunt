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

// Story dates follow the player's clock, so the machine never looks abandoned:
// Hen's logs are from yesterday, the retirement is 3 days out (survives a
// midnight mid-play). Computed at read time — nothing date-like is saved.
const DAY = 86_400_000;
const dayOf = (offset: number) => new Date(Date.now() + offset * DAY);
const pad = (n: number) => String(n).padStart(2, "0");
const sysDate = (d: Date) => `${d.toLocaleDateString("en-US", { month: "short" })} ${String(d.getDate()).padStart(2, " ")}`;
const sysDay = (offset: number) => sysDate(dayOf(offset));
const isoDay = (offset: number) => {
  const d = dayOf(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// syslog stamp `minutes` from now — date and time from one Date, so midnight can't split them
const stamp = (minutes: number) => {
  const d = new Date(Date.now() + minutes * 60_000);
  return `${sysDate(d)} ${d.toTimeString().slice(0, 8)}`;
};
export const retireDate = () =>
  dayOf(3).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const lastLogin = () => `${sysDay(-1)} 08:31`;

// Egg files in stage order. Reading one (cat) completes its stage.
export const EGGS = [
  "/home/player/documents/egg1.txt",
  "/home/player/secrets/egg2.txt",
  "/home/player/secrets/egg3.txt", // created by tidying ~/secrets (userCreated)
  "/home/player/vault/egg4.txt",
  "/home/player/admin/egg5.txt",
  "/root/egg6.txt", // created by unzip (userCreated)
  "/var/backups/egg7.txt",
];

export const hasEgg = (s: GameState, n: number) => s.eggsFound.includes(EGGS[n - 1]);
// True once eggs 1..n are all read — doors open only in stage order.
const upTo = (s: GameState, n: number) => EGGS.slice(0, n).every((e) => s.eggsFound.includes(e));

// The original secrets.cfg; any player file with exactly this content counts as a backup.
const SECRETS_CFG =
  "# secrets.cfg — access control for protected directories\n" +
  "# house rule: make a backup copy of this file before you change it\n" +
  "\n" +
  "path_to_vault_locked = true\n";
export const hasBackup = (s: GameState) =>
  s.userCreated.some((u) => u.type === "file" && u.content === SECRETS_CFG);

// Every egg: what you did, something worth knowing, Hen's pointer to the next.
// Egg texts name actions in full words (remove, move, copy), never command names
// the player hasn't been told about — `help` explains the abbreviations.
export const TIDY_EGG =
  "🥚 EGG #3 of 7 — The Janitor\n" +
  "You removed the junk and moved the report where it belongs.\n" +
  "\n" +
  "Careful out there: a real shell has no trash can. What you remove is gone.\n" +
  "Renaming is just moving to a new name — the same command does both.\n" +
  "Real disks fill up exactly like this: caches, temp files, half-done downloads.\n" +
  "\n" +
  "Next: the vault door is set in secrets.cfg. Mind my house rule.  — Hen\n";

export const ROOT_EGG =
  "🥚 EGG #6 of 7 — The Root\n" +
  "You entered the administrator's home and unpacked an archive.\n" +
  "\n" +
  "/root is kept apart from /home on purpose: the admin's files stay\n" +
  "safe even when a user's home is a mess.\n" +
  "Archives pack many files into one. .zip is everywhere; on Linux you'll\n" +
  "often meet .tar.gz instead (unpacked with: tar -xzf file.tar.gz).\n" +
  "\n" +
  "Next: something just wrote to the system logs, and /var is open now.\n" +
  "Nobody reads logs line by line.  — Hen\n";

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
        "EggshellOS 1.0 — eggshell.local\n"
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
        "# /etc/privilege.cfg — who holds administrative rights on this machine\n" +
          "# Only root may change this file.\n" +
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
        file("README.txt", (s) =>
          "Hello, whoever you are.\n" +
            "\n" +
            "I'm Hen, the admin of this machine. I retire on " + retireDate() + ".\n" +
            "Before I go, I've hidden seven eggs on this system. Each one\n" +
            "holds something I think is worth knowing. Find them all and\n" +
            "the machine is yours.\n" +
            "\n" +
            "The first egg is in ~/documents. That door stays shut\n" +
            "while this machine is offline.\n" +
            (isHardOrWorse(s) ? "" : "I always keep the network settings in /etc.\n") +
            (isEasy(s) ? "`help` lists the commands you can use.\n" : "") +
            "\n" +
            "— Hen\n"
        ),
        file("notes.txt", (s) =>
          "Sticky notes on Hen's monitor:\n" +
            "- ~ is short for your home folder: /home/player\n" +
            "- .. means one folder up. `cd ..` takes you there.\n" +
            "- in `ls`, a name ending in / is a folder.\n" +
            (isHardOrWorse(s) ? "" : "- wifi password? wrote it down somewhere in /etc\n")
        ),
        dir("documents", [
          file(
            "egg1.txt",
            "🥚 EGG #1 of 7 — The Signal\n" +
              "You read a password out of a config file and used it to get online.\n" +
              "\n" +
              "A confession: `wifi` exists only here on EggshellOS.\n" +
              "Real systems each have their own words for it:\n" +
              "  Linux    nmcli device wifi connect <name> password <password>\n" +
              "  macOS    networksetup -setairportnetwork en0 <name> <password>\n" +
              "  Windows  netsh wlan connect name=<name>\n" +
              "Different words, same idea. Commands differ; concepts travel.\n" +
              "And passwords lying around in plain text files? Happens more than it should.\n" +
              "\n" +
              "Next: I left a riddle right here in documents/.  — Hen\n"
          ),
          file("clue2.riddle", (s) =>
            "A riddle from Hen:\n" +
              "\n" +
              "  Not in here — in your home itself, in ~,\n" +
              "  there is room for something new.\n" +
              "  Make it magic — a folder by that very name.\n" +
              "  Then leave a token inside, token.txt,\n" +
              "  to prove you were there. My secrets will open to you.\n" +
              (isEasy(s) ? "\n(A folder you make; a file you leave. `help` knows how to do both.)\n" : "")
          ),
        ], {
          locked: (s) => !s.wifiConnected,
        }),
        dir("secrets", [
          file(
            "secrets.cfg",
            SECRETS_CFG,
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
            "🥚 EGG #2 of 7 — The Builder\n" +
              "You made a folder and a file out of nothing.\n" +
              "\n" +
              "The command for files was really built to update a file's timestamp —\n" +
              "to \"touch\" it. Creating an empty file when none exists was a side effect,\n" +
              "and now everyone uses it for exactly that.\n" +
              "Every project on every computer started like this: one folder, one file.\n" +
              "\n" +
              "Next: sorry about the mess in here. quota.txt says what needs doing.  — Hen\n"
          ),
          file(
            "editor-tips.txt",
            "=== The editor ===\n" +
              "`edit <file>` opens a small text editor. (nano and vim work too.)\n" +
              "  - change the text, then save with Ctrl+S (Cmd+S on Mac)\n" +
              "  - Esc leaves without saving\n" +
              "\n" +
              "House rule: back up before you change. A copy named <file>.bak\n" +
              "is the custom — if the edit goes wrong, the original is safe.\n"
          ),
          file("quota.txt", (s) =>
            s.userCreated.some((u) => u.path === EGGS[2])
              ? "~/secrets is within quota. Thank you!  — Hen\n"
              : "!! ~/secrets is over quota !!\n" +
                "- the temporary files (*.tmp) can go\n" +
                "- report.txt is a document — it belongs with the other documents\n" +
                (isEasy(s)
                  ? "\n(`help` lists commands to remove and to move files.\n" +
                    " * is a wildcard: *.tmp means every name ending in .tmp)\n"
                  : "")
          ),
        ], {
          locked: (s) => !(s.createdMagicDir && s.createdTokenFile) || !upTo(s, 1),
        }),
        dir("vault", [
          file(
            "egg4.txt",
            "🥚 EGG #4 of 7 — The Editor\n" +
              "You made a backup, changed one line, and a door opened.\n" +
              "\n" +
              "That's how real systems are run: settings live in plain text files\n" +
              "(~/.ssh/config, /etc/hosts), and one changed line changes behaviour.\n" +
              "Real editors: nano is the friendly one; vim is powerful and famous\n" +
              "for being hard to quit. (Stuck in vim? Press Esc, type :q! and Enter.)\n" +
              "\n" +
              "Next: the admin password is in this vault. Not in plain text — I learned that much.  — Hen\n"
          ),
          file(
            "sudo_clue.json",
            () =>
            "# structured credential token\n" +
              "# encoded field values must be decoded before use\n" +
              "\n" +
              "{\n" +
              "  \"token_type\":  \"system-credential\",\n" +
              "  \"issued_by\":   \"hen\",\n" +
              "  \"expires\":     \"" + isoDay(3) + "\",\n" +
              "  \"passphrase\":  \"c2VjcmV0LWVnZw==\"\n" +
              "}\n"
          ),
          file("how-to-sudo.txt", (s) =>
            "=== sudo ===\n" +
              "sudo means \"superuser do\": run one command as the administrator (root).\n" +
              "  sudo <command> <args...>\n" +
              "You'll be asked for the admin password.\n" +
              (isHardOrWorse(s)
                ? ""
                : "\n" +
                  "The password isn't stored in plain text. But encoded isn't encrypted.\n" +
                  "Who counts as an admin is written in /etc — and only root may change that.\n") +
              (isEasy(s) ? "(That file is /etc/privilege.cfg. `help` lists a decoder.)\n" : "")
          ),
        ], {
          locked: (s) => !s.secretsUnlocked || !upTo(s, 3),
        }),
        dir("admin", [
          file(
            "egg5.txt",
            "🥚 EGG #5 of 7 — The Administrator\n" +
              "You decoded a password and used it to make yourself an admin.\n" +
              "\n" +
              "base64 is an encoding, not encryption: anyone can reverse it, no key needed.\n" +
              "It exists to carry any data as plain letters — through email, URLs, configs.\n" +
              "sudo has a Windows twin: right-click → \"Run as administrator\".\n" +
              "Use it sparingly. Root can break anything, and never asks twice.\n" +
              "\n" +
              "Next: /root, my own home, is open to admins now. The first time, ask as root.  — Hen\n"
          ),
        ], {
          locked: (s) => !s.adminUnlocked || !upTo(s, 4),
        }),
      ]),
    ]),
    dir("root", [
      file(
        "egg6.zip",
        "[binary archive]\n"
      ),
    ], {
      locked: (s) => !s.adminUnlocked || !upTo(s, 5),
    }),
    dir("var", [
      dir("log", [
        file(
          "auth.log",
          () =>
          sysDay(-1) + " 06:25:01 eggshell CRON[882]: pam_unix(cron:session): session opened for user root\n" +
            sysDay(-1) + " 06:25:03 eggshell CRON[882]: pam_unix(cron:session): session closed for user root\n" +
            sysDay(-1) + " 07:14:22 eggshell sshd[1203]: Failed password for invalid user admin from 10.0.0.5 port 51122\n" +
            sysDay(-1) + " 07:14:25 eggshell sshd[1203]: Connection closed by invalid user admin 10.0.0.5 port 51122\n" +
            sysDay(-1) + " 08:02:11 eggshell sudo:   hen : TTY=pts/0 ; PWD=/root ; COMMAND=/usr/bin/nano /etc/privilege.cfg\n" +
            sysDay(-1) + " 08:02:11 eggshell sudo: pam_unix(sudo:session): session opened for user root\n" +
            sysDay(-1) + " 08:02:14 eggshell sudo: pam_unix(sudo:session): session closed for user root\n" +
            sysDay(-1) + " 08:31:47 eggshell sshd[1490]: Accepted publickey for hen from 10.0.0.9 port 40018\n"
        ),
        file(
          "syslog",
          () =>
          sysDay(-1) + " 06:25:01 eggshell rsyslogd: [origin software=\"rsyslogd\"] rsyslogd was HUPed\n" +
            sysDay(-1) + " 06:30:00 eggshell systemd[1]: Starting Daily apt download activities...\n" +
            sysDay(-1) + " 06:30:02 eggshell systemd[1]: apt-daily.service: Succeeded.\n" +
            sysDay(-1) + " 06:47:19 eggshell kernel: [ 8123.442] usb 1-2: new high-speed USB device number 4\n" +
            sysDay(-1) + " 07:00:00 eggshell systemd[1]: logrotate.service: Succeeded.\n" +
            sysDay(-1) + " 07:12:38 eggshell NetworkManager[610]: <info> device (wlan0): state change: activated\n" +
            sysDay(-1) + " 08:00:00 eggshell systemd[1]: Starting Cleanup of Temporary Directories...\n" +
            sysDay(-1) + " 08:00:01 eggshell systemd[1]: systemd-tmpfiles-clean.service: Succeeded.\n" +
            sysDay(-1) + " 08:17:44 eggshell kernel: [13544.108] audit: type=1400 apparmor=\"ALLOWED\" profile=\"lsb_release\"\n" +
            sysDay(-1) + " 08:30:00 eggshell systemd[1]: Starting Rotate log files...\n" +
            sysDay(-1) + " 08:30:01 eggshell systemd[1]: logrotate.service: Succeeded.\n" +
            // ponytail: easterd ran "just now" (read time), so the time moves on re-read
            `${stamp(-2)} eggshell easterd[312]: sweep complete — one asset still unaccounted for\n` +
            `${stamp(-1)} eggshell easterd[312]: relocating asset to /var/backups/egg7.txt\n` +
            `${stamp(-1)} eggshell easterd[312]: asset secured. nobody reads the logs anyway.\n`
        ),
        file(
          "dpkg.log",
          () =>
          isoDay(-2) + " 22:10:03 startup archives unpack\n" +
            isoDay(-2) + " 22:10:05 install curl:amd64 <none> 7.88.1-10\n" +
            isoDay(-2) + " 22:10:06 status installed curl:amd64 7.88.1-10\n" +
            isoDay(-2) + " 22:10:09 install jq:amd64 <none> 1.6-2.1\n" +
            isoDay(-2) + " 22:10:10 status installed jq:amd64 1.6-2.1\n" +
            isoDay(-2) + " 22:11:31 install tree:amd64 <none> 2.1.0-1\n" +
            isoDay(-2) + " 22:11:32 status installed tree:amd64 2.1.0-1\n"
        ),
      ]),
      dir("backups", [
        file(
          "egg7.txt",
          "🥚 EGG #7 of 7 — The Investigator\n" +
            "You didn't read the logs. You searched them.\n" +
            "\n" +
            "grep stands for \"global regular expression print\": it prints every\n" +
            "line that matches. The same move finds real problems:\n" +
            "  grep error app.log                    lines containing \"error\"\n" +
            "  grep -r \"Failed password\" /var/log    search a whole folder\n" +
            "\n" +
            "That's all seven. You've hatched — the shell is yours now.\n" +
            "\n" +
            "Try a real terminal next:\n" +
            "  macOS    Applications → Utilities → Terminal\n" +
            "  Windows  install WSL, then open Ubuntu\n" +
            "  Linux    you're already home\n" +
            "Almost everything you typed here works there unchanged — except wifi and edit.\n" +
            "\n" +
            "Thank you for playing.  — Hen\n"
        ),
      ]),
    ], {
      locked: (s) => !upTo(s, 6),
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

// First locked directory on the way to `path` (the path itself included),
// or null. Every command checks this, so a lock covers everything below it.
export function lockedAt(root: FsNode, path: string, state: GameState): string | null {
  let cur = root;
  let curPath = "";
  for (const p of path.split("/").filter(Boolean)) {
    if (cur.kind !== "dir") return null;
    const next = cur.children.find((c) => c.name === p);
    if (!next) return null;
    curPath += "/" + p;
    if (next.kind === "dir" && next.locked?.(state)) return curPath;
    cur = next;
  }
  return null;
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
