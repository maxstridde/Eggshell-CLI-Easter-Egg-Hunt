// Virtual filesystem + game state for Eggshell
// Nodes are either directories or files.
// Locked directories cannot be `cd`'d into until a predicate returns true.

export type FsNode =
  | {
      kind: "dir";
      name: string;
      children: FsNode[];
      // If set, this directory shows as [locked] in `ls` and cannot be cd'd into.
      locked?: (state: GameState) => boolean;
      hint?: string;
    }
  | {
      kind: "file";
      name: string;
      // Content shown by `cat`.
      content: string;
      // If this file is "config-like" and editable by `edit`.
      editable?: boolean;
      // A validator that runs after an edit; returns error message or null.
      // Also used to mutate game-state flags based on file content.
      onEdit?: (newContent: string, state: GameState) => string | null;
    };

export interface GameState {
  wifiConnected: boolean;
  wifiSSID: string;
  createdMagicDir: boolean;
  createdTokenFile: boolean;
  secretsUnlocked: boolean; // via editing secrets.cfg
  knowsSudoPassword: boolean; // decoded from base64 clue
  adminUnlocked: boolean; // via editing /etc/privilege.cfg
  eggsFound: string[]; // paths of discovered eggs
  finalEggFound: boolean;
  // raw file overrides from edits
  edits: Record<string, string>;
  // user-created files / dirs (relative to /home/player)
  userCreated: { type: "dir" | "file"; path: string; content?: string }[];
  // for wifi stage
  sudoTries: number;
}

export const initialState: GameState = {
  wifiConnected: false,
  wifiSSID: "",
  createdMagicDir: false,
  createdTokenFile: false,
  secretsUnlocked: false,
  knowsSudoPassword: false,
  adminUnlocked: false,
  eggsFound: [],
  finalEggFound: false,
  edits: {},
  userCreated: [],
  sudoTries: 0,
};

// --- Helpers for building the tree with less repetition -----------------

const dir = (
  name: string,
  children: FsNode[],
  opts: { locked?: (s: GameState) => boolean; hint?: string } = {}
): FsNode => ({ kind: "dir", name, children, ...opts });

const file = (
  name: string,
  content: string,
  opts: { editable?: boolean; onEdit?: (c: string, s: GameState) => string | null } = {}
): FsNode => ({ kind: "file", name, content, ...opts });

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
        "# /etc/privilege.cfg — requires sudo\n" +
          "# Change `allow_admin=false` to `allow_admin=true` to unlock the /admin directory.\n" +
          "allow_admin=false\n" +
          "default_user=player\n",
        {
          editable: true,
          onEdit: (c, s) => {
            // simple validator — must contain allow_admin=true
            if (/allow_admin\s*=\s*true/i.test(c)) {
              s.adminUnlocked = true;
              return null;
            }
            s.adminUnlocked = false;
            return null;
          },
        }
      ),
    ]),
    dir("home", [
      dir("player", [
        file(
          "README.txt",
          "=== WELCOME TO EGGSHELL ===\n" +
            "\n" +
            "You are sitting at a fresh terminal. Your mission:\n" +
            "find the 5 hidden easter eggs scattered through this system.\n" +
            "\n" +
            "Useful commands to try:\n" +
            "  help        — show the command list\n" +
            "  ls          — list files in the current directory\n" +
            "  cd <dir>    — change directory (cd .. goes up)\n" +
            "  cat <file>  — print a file\n" +
            "  pwd         — print current path\n" +
            "\n" +
            "Stage 1: You are OFFLINE. Find a way to connect to Wi-Fi.\n" +
            "         Hint: the system keeps network info in /etc/wifi.json.\n" +
            "         Try: `wifi list` then `wifi connect <SSID>`.\n"
        ),
        file(
          "notes.txt",
          "Player's notebook:\n" +
            "- First egg is said to be in ~/documents/egg1.txt\n" +
            "- But documents is LOCKED until you are ONLINE.\n" +
            "  Try `wifi list` to find a network to join.\n" +
            "- There's a strange note about a 'magic' directory.\n" +
            "  It has to be created right here, in your home folder /home/player.\n" +
            "  And there must be a file called token.txt inside it.\n" +
            "  Then something will unlock...\n"
        ),
        dir("documents", [
          file(
            "egg1.txt",
            "🥚 EGG #1 FOUND — 'The Starter' 🥚\n" +
              "Good, you made it past the Wi-Fi gate.\n" +
              "\n" +
              "Next clue:\n" +
              "  Look at the file `clue2.riddle` in this same folder.\n"
          ),
          file(
            "clue2.riddle",
            "Riddle #2:\n" +
              "  'Deep in the player's home there is a hollow.\n" +
              "   Fill it with a folder called magic,\n" +
              "   and inside that folder, leave a token.\n" +
              "   Only then will the secrets room open its gates.'\n" +
              "\n" +
              "--- Step-by-step ---\n" +
              "  1. Go home first:          cd /home/player\n" +
              "  2. Create the folder:      mkdir magic\n" +
              "  3. Step inside:            cd magic\n" +
              "  4. Leave your token:       touch token.txt\n" +
              "  5. Go back and look:       cd ..   then   ls\n" +
              "\n" +
              "You should now see ~/secrets unlocked. Good luck.\n"
          ),
        ], {
          locked: (s) => !s.wifiConnected,
          hint: "[locked — requires internet]",
        }),
        dir("secrets", [
          file(
            "secrets.cfg",
            "# secrets.cfg — controls access to deeper rooms.\n" +
              "# Change `path_to_vault_locked = true` to `false` below.\n" +
              "\n" +
              "path_to_vault_locked = true\n" +
              "debug_mode = off\n",
            {
              editable: true,
              onEdit: (c, s) => {
                if (/path_to_vault_locked\s*=\s*false/i.test(c)) {
                  s.secretsUnlocked = true;
                  return null;
                }
                s.secretsUnlocked = false;
                return null;
              },
            }
          ),
          file(
            "egg2.txt",
            "🥚 EGG #2 FOUND — 'The Gatekeeper' 🥚\n" +
              "You used a text editor! That's one of the most important\n" +
              "skills on the command line.\n" +
              "\n" +
              "Next clue:\n" +
              "  Edit secrets.cfg and flip `path_to_vault_locked` to false,\n" +
              "  then look inside ~/vault.\n"
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
          hint: "[locked — create /home/player/magic/ and /home/player/magic/token.txt first]",
        }),
        dir("vault", [
          file(
            "egg3.txt",
            "🥚 EGG #3 FOUND — 'The Vault Dweller' 🥚\n" +
              "Flipping config flags is how real systems get unlocked.\n" +
              "\n" +
              "Next clue:\n" +
              "  There is a file called `sudo_clue.b64` in this directory.\n" +
              "  Read it. It contains a password... encoded in base64.\n" +
              "  Use the command `base64 -d <text>` to decode it.\n" +
              "  You will need that password for `sudo`.\n"
          ),
          file(
            "sudo_clue.b64",
            "c2VjcmV0LWVnZw==\n"
          ),
          file(
            "how-to-sudo.txt",
            "=== sudo ===\n" +
              "`sudo` runs a single command as the administrator (root).\n" +
              "Syntax:  sudo <command> <args...>\n" +
              "You will be asked for the admin password. The password is\n" +
              "hidden somewhere in this vault — find the base64 clue and\n" +
              "decode it with: base64 -d <encoded-string>\n" +
              "\n" +
              "Try:  sudo edit /etc/privilege.cfg\n"
          ),
        ], {
          locked: (s) => !s.secretsUnlocked,
          hint: "[locked — edit secrets.cfg to unlock]",
        }),
        dir("admin", [
          file(
            "egg4.txt",
            "🥚 EGG #4 FOUND — 'The Administrator' 🥚\n" +
              "You just used sudo to modify a system configuration file.\n" +
              "That's basically 80% of being a sysadmin.\n" +
              "\n" +
              "Final clue:\n" +
              "  The last egg lives at /root/final_egg.txt\n" +
              "  But /root is only reachable by root. Try: sudo cd /root\n" +
              "  (Hint: in this game, `sudo cd /root` actually works. Real\n" +
              "   shells don't work that way — but we're being friendly.)\n"
          ),
          file(
            "admin-note.txt",
            "You are in /admin — a directory that required editing /etc/privilege.cfg.\n" +
            "Real-world equivalents: /etc/sudoers, group policies, ACLs, etc.\n"
          ),
        ], {
          locked: (s) => !s.adminUnlocked,
          hint: "[locked — requires allow_admin=true in /etc/privilege.cfg]",
        }),
      ]),
    ]),
    dir("root", [
      file(
        "final_egg.txt",
        "🏆 EGG #5 — 'THE PRIZE' 🏆\n" +
          "You made it to /root. Congratulations, you can now officially\n" +
          "call yourself a CLI power-user.\n" +
          "\n" +
          "What you learned:\n" +
          "  • ls / cd / pwd / cat          — filesystem navigation\n" +
          "  • mkdir / touch                 — creating paths\n" +
          "  • edit                          — a built-in text editor\n" +
          "  • wifi list / wifi connect      — network management\n" +
          "  • base64 -d                     — decoding\n" +
          "  • sudo                          — privilege escalation\n" +
          "\n" +
          "Thanks for playing Eggshell. Now go try a real shell!\n"
      ),
    ], {
      locked: (s) => !s.adminUnlocked,
      hint: "[locked — root only. use sudo]",
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

export function pathOfChild(parentPath: string, childName: string): string {
  if (parentPath === "/") return "/" + childName;
  return parentPath + "/" + childName;
}
