// Virtual filesystem + game state for Eggshell
// Nodes are either directories or files.
// Locked directories cannot be `cd`'d into until a predicate returns true.

export type Difficulty = "easy" | "medium" | "hard" | "impossible";
export type TerminalUser = "player" | "admin" | "other";

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
      // Runs after an edit; returns error string or null, plus optional state patch.
      onEdit?: (newContent: string) => { error: string | null; patch?: Partial<GameState> };
    };

export interface GameState {
  wifiConnected: boolean;
  wifiSSID: string;
  createdMagicDir: boolean;
  createdTokenFile: boolean;
  secretsUnlocked: boolean; // via editing secrets.cfg
  knowsSudoPassword: boolean; // decoded from base64 clue
  adminUnlocked: boolean; // via editing /etc/privilege.cfg
  rootEntered: boolean; // set after first successful sudo cd /root
  eggsFound: string[]; // paths of discovered eggs
  finalEggFound: boolean;
  // raw file overrides from edits
  edits: Record<string, string>;
  // user-created files / dirs (relative to /home/player)
  userCreated: { type: "dir" | "file"; path: string; content?: string }[];
  sudoTries: number;
  difficulty: Difficulty;
  terminalUser: TerminalUser; // set by default_user in /etc/privilege.cfg
  visited: string[]; // directories the player has ls-ed or cd-ed into
  mapVisible: boolean; // medium/hard: whether map panel is toggled on
}

export const initialState: GameState = {
  wifiConnected: false,
  wifiSSID: "",
  createdMagicDir: false,
  createdTokenFile: false,
  secretsUnlocked: false,
  knowsSudoPassword: false,
  adminUnlocked: false,
  rootEntered: false,
  eggsFound: [],
  finalEggFound: false,
  edits: {},
  userCreated: [],
  sudoTries: 0,
  difficulty: "easy",
  terminalUser: "player",
  visited: ["/home/player"],
  mapVisible: false,
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
  opts: { editable?: boolean; onEdit?: (c: string) => { error: string | null; patch?: Partial<GameState> } } = {}
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
        file(
          "README.txt",
          "=== WELCOME TO EGGSHELL ===\n" +
            "\n" +
            "You are sitting at a fresh terminal. Your mission:\n" +
            "find the 5 hidden easter eggs scattered through this system.\n" +
            "\n" +
            "Useful commands:\n" +
            "  help        — show the command list\n" +
            "  ls          — list files in the current directory\n" +
            "  cat <file>  — print a file\n" +
            "  pwd         — print current path\n" +
            "\n" +
            "Something is preventing you from exploring further.\n" +
            "The system keeps network information in /etc.\n"
        ),
        file(
          "notes.txt",
          "Player's notebook:\n" +
            "- First egg is said to be in ~/documents/\n" +
            "  But that directory is LOCKED.\n" +
            "  You need to be connected to a network to enter.\n" +
            "- Somewhere in this home folder, a special directory must be created.\n" +
            "  And something left inside it — like proof you were there.\n" +
            "  Only then will a certain door open...\n"
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
              "Config files store secrets. Now you know.\n"
          ),
          file(
            "clue2.riddle",
            "Riddle #2:\n" +
              "  'Deep in the player's home there is a hollow.\n" +
              "   Fill it with a folder called magic,\n" +
              "   and inside that folder, leave a token.\n" +
              "   Only then will the secrets room open its gates.'\n"
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
              "Filesystems are built one node at a time.\n"
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
              "Config files are the API of the system.\n"
          ),
          file(
            "sudo_clue.json",
            "# .b64 — structured credential token\n" +
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
          file(
            "how-to-sudo.txt",
            "=== sudo ===\n" +
              "`sudo` runs a single command as the administrator (root).\n" +
              "Syntax:  sudo <command> <args...>\n" +
              "\n" +
              "You will be asked for the admin password.\n" +
              "The credential is stored somewhere in this vault.\n" +
              "Look around — encoded things can be decoded.\n"
          ),
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
              "You now understand the basics of privilege escalation.\n"
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
