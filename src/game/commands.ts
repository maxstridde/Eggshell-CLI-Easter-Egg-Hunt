import { FsNode, GameState, findNode, resolvePath } from "./fs";

export interface CmdContext {
  root: FsNode;
  state: GameState;
  cwd: string;
  setCwd: (p: string) => void;
  setState: (updater: (s: GameState) => GameState) => void;
  print: (line: string, cls?: string) => void;
  openEditor: (path: string, initial: string, onSave: (newContent: string) => void) => void;
  // pending sudo context — when true, next command runs as root
  sudoActive: boolean;
  setSudoActive: (b: boolean) => void;
  passwordPrompt: (onSubmit: (pwd: string) => void, title?: string, onCancel?: () => void) => void;
}

export type CommandHandler = (args: string[], ctx: CmdContext) => void;

const HELP_TEXT = `Available commands:
  help                     show this message
  clear / cls              clear the screen
  pwd                      print current directory
  ls [path]                list directory contents
  cd <path>                change directory
  cat <file>               print file contents
  mkdir <name>             create a new directory (in cwd)
  touch <name>             create an empty file (in cwd)
  edit <file>              open the built-in text editor
  wifi list                show available Wi-Fi networks
  wifi connect <SSID>      connect to a Wi-Fi network (asks for password)
  base64 -d <string>       decode a base64 string
  sudo <command...>        run a command as administrator (needs password)
  eggs                     show collected eggs
  stage                    show which stage you are currently on

Tip: paths starting with / are absolute. Otherwise they are relative to cwd.
     Use '..' to go up one level.`;

function stageOf(s: GameState): string {
  if (!s.wifiConnected) return "Stage 1 — OFFLINE: connect to Wi-Fi";
  if (!s.createdMagicDir || !s.createdTokenFile)
    return "Stage 2 — go home (`cd /home/player`), then `mkdir magic`, `cd magic`, `touch token.txt`";
  if (!s.secretsUnlocked) return "Stage 3 — edit ~/secrets/secrets.cfg";
  if (!s.knowsSudoPassword) return "Stage 4 — decode the base64 sudo clue";
  if (!s.adminUnlocked) return "Stage 5 — sudo edit /etc/privilege.cfg";
  if (!s.finalEggFound) return "Stage 6 — reach /root and find the final egg";
  return "🏆 COMPLETE — all eggs collected!";
}

export const commands: Record<string, CommandHandler> = {
  help: (_, ctx) => ctx.print(HELP_TEXT, "text-emerald-300"),

  start: (_, ctx) => {
    ctx.print("Welcome to Eggshell! Here is how to begin:", "text-emerald-300");
    ctx.print("");
    ctx.print("  1. Type `cat README.txt` to read the intro file.");
    ctx.print("  2. Type `ls` to see what is in your home directory.");
    ctx.print("  3. Type `stage` at any time to see your current objective.");
    ctx.print("");
    ctx.print("Your first mission: get online. Type `wifi list`.", "text-yellow-300");
  },

  clear: () => {
    /* handled at UI level */
  },
  cls: () => {
    /* handled at UI level */
  },

  pwd: (_, ctx) => ctx.print(ctx.cwd),

  stage: (_, ctx) => ctx.print(stageOf(ctx.state), "text-yellow-300"),

  eggs: (_, ctx) => {
    const found = ctx.state.eggsFound;
    if (found.length === 0) {
      ctx.print("No eggs yet. Keep exploring!", "text-yellow-300");
      return;
    }
    ctx.print(`Eggs found: ${found.length} / 5`, "text-yellow-300");
    found.forEach((p, i) => ctx.print(`  ${i + 1}. ${p}`));
  },

  ls: (args, ctx) => {
    const target = args[0] ? resolvePath(ctx.cwd, args[0]) : ctx.cwd;
    const node = findNode(ctx.root, target);
    // also check if target is a user-created directory
    const isUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === target);

    if (!node && !isUserDir) {
      ctx.print(`ls: cannot access '${args[0] ?? target}': No such file or directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "file") {
      ctx.print(node.name);
      return;
    }

    const names: string[] = [];

    // children from the real FS tree (only if node exists and is a dir)
    if (node && node.kind === "dir") {
      for (const child of node.children) {
        const isLocked = child.kind === "dir" && child.locked && child.locked(ctx.state);
        const suffix = child.kind === "dir" ? (isLocked ? "/  [locked]" : "/") : "";
        names.push(child.name + suffix);
      }
    }

    // children from userCreated whose parent equals target
    const userStuff = ctx.state.userCreated.filter((u) => {
      const uParent = u.path.split("/").slice(0, -1).join("/") || "/";
      return uParent === target;
    });
    for (const u of userStuff) {
      const name = u.path.split("/").pop()!;
      names.push(u.type === "dir" ? name + "/" : name);
    }

    if (names.length === 0) {
      ctx.print("(empty)");
      return;
    }
    names.sort();
    names.forEach((n) => {
      if (n.includes("[locked]")) ctx.print(n, "text-stone-500");
      else if (n.endsWith("/")) ctx.print(n, "text-sky-300");
      else ctx.print(n);
    });
  },

  cd: (args, ctx) => {
    const target = args[0] ? resolvePath(ctx.cwd, args[0]) : "/home/player";
    const node = findNode(ctx.root, target);
    // allow user-created dirs
    const userDir = ctx.state.userCreated.find(
      (u) => u.type === "dir" && u.path === target
    );
    if (!node && !userDir) {
      ctx.print(`cd: no such file or directory: ${args[0]}`, "text-red-400");
      return;
    }
    if (node && node.kind === "file") {
      ctx.print(`cd: not a directory: ${args[0]}`, "text-red-400");
      return;
    }
    if (node && node.kind === "dir" && node.locked && node.locked(ctx.state)) {
      // /root special message for sudo
      if (target === "/root" && !ctx.sudoActive) {
        ctx.print(
          "cd: permission denied: /root  (try `sudo cd /root`)",
          "text-red-400"
        );
        return;
      }
      ctx.print(
        `cd: '${args[0]}' is locked. ${node.hint ?? ""}`,
        "text-red-400"
      );
      return;
    }
    ctx.setCwd(target);
  },

  cat: (args, ctx) => {
    if (!args[0]) {
      ctx.print("cat: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    const node = findNode(ctx.root, target);
    // user-created file?
    const userFile = ctx.state.userCreated.find(
      (u) => u.type === "file" && u.path === target
    );
    // edited file overrides?
    const override = ctx.state.edits[target];

    if (!node && !userFile) {
      ctx.print(`cat: ${args[0]}: No such file or directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "dir") {
      ctx.print(`cat: ${args[0]}: Is a directory`, "text-red-400");
      return;
    }
    let content = override ?? (node?.kind === "file" ? node.content : userFile?.content ?? "");
    ctx.print(content.trimEnd());

    // egg detection
    const eggFiles = [
      "/home/player/documents/egg1.txt",
      "/home/player/secrets/egg2.txt",
      "/home/player/vault/egg3.txt",
      "/home/player/admin/egg4.txt",
      "/root/final_egg.txt",
    ];
    if (eggFiles.includes(target)) {
      ctx.setState((s) => {
        if (s.eggsFound.includes(target)) return s;
        const next = { ...s, eggsFound: [...s.eggsFound, target] };
        if (target === "/root/final_egg.txt") next.finalEggFound = true;
        return next;
      });
    }
  },

  mkdir: (args, ctx) => {
    if (!args[0]) {
      ctx.print("mkdir: missing operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (!target.startsWith("/home/player")) {
      ctx.print("mkdir: permission denied (stay inside /home/player for now)", "text-red-400");
      return;
    }
    // validate parent exists
    const parentPath = target.split("/").slice(0, -1).join("/") || "/";
    const parentInFs = findNode(ctx.root, parentPath);
    const parentIsUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === parentPath);
    if (!parentInFs && !parentIsUserDir) {
      ctx.print(`mkdir: cannot create directory '${args[0]}': No such file or directory`, "text-red-400");
      return;
    }
    if (findNode(ctx.root, target) || ctx.state.userCreated.some((u) => u.path === target)) {
      ctx.print(`mkdir: cannot create directory '${args[0]}': File exists`, "text-red-400");
      return;
    }
    ctx.setState((s) => {
      const next: GameState = {
        ...s,
        userCreated: [...s.userCreated, { type: "dir", path: target }],
      };
      if (target === "/home/player/magic") next.createdMagicDir = true;
      return next;
    });
    ctx.print(`created directory: ${target}`, "text-emerald-300");
  },

  touch: (args, ctx) => {
    if (!args[0]) {
      ctx.print("touch: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (!target.startsWith("/home/player")) {
      ctx.print("touch: permission denied (stay inside /home/player for now)", "text-red-400");
      return;
    }
    // validate parent exists
    const parentPath = target.split("/").slice(0, -1).join("/") || "/";
    const parentInFs = findNode(ctx.root, parentPath);
    const parentIsUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === parentPath);
    if (!parentInFs && !parentIsUserDir) {
      ctx.print(`touch: cannot touch '${args[0]}': No such file or directory`, "text-red-400");
      ctx.print(`  Hint: create the parent directory first with \`mkdir\`.`, "text-yellow-300");
      return;
    }
    if (findNode(ctx.root, target) || ctx.state.userCreated.some((u) => u.path === target)) {
      // already exists — no-op like real touch
      return;
    }
    ctx.setState((s) => {
      const next: GameState = {
        ...s,
        userCreated: [...s.userCreated, { type: "file", path: target, content: "" }],
      };
      if (target === "/home/player/magic/token.txt") next.createdTokenFile = true;
      return next;
    });
    ctx.print(`created file: ${target}`, "text-emerald-300");
  },

  edit: (args, ctx) => {
    if (!args[0]) {
      ctx.print("edit: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    const node = findNode(ctx.root, target);

    // /etc/privilege.cfg requires sudo
    if (target === "/etc/privilege.cfg" && !ctx.sudoActive) {
      ctx.print(
        "edit: permission denied: /etc/privilege.cfg  (try `sudo edit /etc/privilege.cfg`)",
        "text-red-400"
      );
      return;
    }

    if (!node || node.kind !== "file") {
      ctx.print(`edit: ${args[0]}: No such editable file`, "text-red-400");
      return;
    }
    if (!node.editable) {
      ctx.print(`edit: ${args[0]}: file is read-only`, "text-red-400");
      return;
    }
    const initial = ctx.state.edits[target] ?? node.content;
    ctx.openEditor(target, initial, (newContent) => {
      let saved = false;
      ctx.setState((s) => {
        const next = { ...s, edits: { ...s.edits, [target]: newContent } };
        const mut: GameState = { ...next };
        const err = node.onEdit ? node.onEdit(newContent, mut) : null;
        if (err) {
          ctx.print(`edit: ${err}`, "text-red-400");
          return s;
        }
        Object.assign(next, mut);
        saved = true;
        return next;
      });
      if (saved) ctx.print(`"${args[0]}" saved.`, "text-emerald-300");
    });
  },

  wifi: (args, ctx) => {
    const sub = args[0];
    if (sub === "list") {
      // read /etc/wifi.json for flavor
      ctx.print("SSID              SIGNAL  STATUS", "text-emerald-300");
      ctx.print("----------------  ------  ------", "text-emerald-300");
      ctx.print("NETGEAR-guest       42%   open");
      ctx.print("EggHunt-5G          88%   encrypted");
      ctx.print("Starbucks-WiFi      21%   open");
      ctx.print("hidden-ssid           0%   hidden");
      if (ctx.state.wifiConnected) {
        ctx.print(`\nCurrently connected to: ${ctx.state.wifiSSID}`, "text-emerald-300");
      }
      return;
    }
    if (sub === "connect") {
      const ssid = args[1];
      if (!ssid) {
        ctx.print("wifi connect: expected SSID", "text-red-400");
        return;
      }
      if (ssid === "EggHunt-5G") {
        ctx.passwordPrompt((pwd) => {
          if (pwd === "yolk-yolk-123") {
            ctx.setState((s) => ({ ...s, wifiConnected: true, wifiSSID: "EggHunt-5G" }));
            ctx.print("connected to EggHunt-5G — you are ONLINE.", "text-emerald-300");
            ctx.print(
              "New paths are now visible. Try `ls` and explore ~/documents.",
              "text-yellow-300"
            );
          } else {
            ctx.print("wifi: authentication failed — wrong password", "text-red-400");
          }
        }, `Password for ${ssid}:`);
        return;
      }
      if (ssid === "NETGEAR-guest" || ssid === "Starbucks-WiFi") {
        ctx.print(
          `wifi: ${ssid} has no internet access in this simulation. Try a different network.`,
          "text-yellow-300"
        );
        return;
      }
      ctx.print(`wifi: no network with SSID '${ssid}'`, "text-red-400");
      return;
    }
    ctx.print("wifi: usage — `wifi list` or `wifi connect <SSID>`", "text-red-400");
  },

  base64: (args, ctx) => {
    if (args[0] !== "-d") {
      ctx.print("base64: usage — `base64 -d <encoded-string>`", "text-red-400");
      return;
    }
    const encoded = args.slice(1).join(" ");
    if (!encoded) {
      ctx.print("base64: empty input", "text-red-400");
      return;
    }
    try {
      const decoded = atob(encoded.trim());
      ctx.print(decoded);
      if (decoded === "secret-egg") {
        ctx.setState((s) => ({ ...s, knowsSudoPassword: true }));
        ctx.print(
          "That looks like a sudo password. Remember it.",
          "text-yellow-300"
        );
      }
    } catch {
      ctx.print("base64: invalid input", "text-red-400");
    }
  },

  sudo: (args, ctx) => {
    if (args.length === 0) {
      ctx.print("sudo: usage — `sudo <command> <args...>`", "text-red-400");
      return;
    }
    ctx.passwordPrompt((pwd) => {
      if (pwd !== "secret-egg") {
        ctx.setState((s) => ({ ...s, sudoTries: s.sudoTries + 1 }));
        ctx.print("sudo: 1 incorrect password attempt", "text-red-400");
        return;
      }
      ctx.print("(elevated to root for this command)", "text-yellow-300");
      ctx.setSudoActive(true);
      // re-run the inner command
      const [cmd, ...rest] = args;
      const handler = commands[cmd];
      if (!handler) {
        ctx.print(`${cmd}: command not found`, "text-red-400");
        ctx.setSudoActive(false);
        return;
      }
      handler(rest, ctx);
      ctx.setSudoActive(false);
    }, "[sudo] password for player:");
  },
};

// Small helper used by the main loop to also detect `clear` before printing.
export function isClear(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  return c === "clear" || c === "cls";
}
