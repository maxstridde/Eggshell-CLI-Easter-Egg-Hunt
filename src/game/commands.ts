import { Difficulty, FsNode, GameState, findNode, initialState, resolvePath } from "./fs";
import { STAGES, stageHint, stageOf } from "./stage";

export interface CmdContext {
  root: FsNode;
  state: GameState;
  cwd: string;
  setCwd: (p: string) => void;
  setState: (updater: (s: GameState) => GameState) => void;
  print: (line: string, cls?: string) => void;
  openEditor: (path: string, initial: string, onSave: (newContent: string) => void) => void;
  sudoActive: boolean;
  setSudoActive: (b: boolean) => void;
  passwordPrompt: (onSubmit: (pwd: string) => void, title?: string, onCancel?: () => void) => void;
}

export type CommandHandler = (args: string[], ctx: CmdContext) => void;

// Returns the player's current progress level (0–5) used to filter help entries.
function progressLevel(s: GameState): number {
  if (s.adminUnlocked) return 5;
  if (s.knowsSudoPassword) return 4;
  if (s.secretsUnlocked) return 3;
  if (s.createdMagicDir && s.createdTokenFile) return 2;
  if (s.wifiConnected) return 1;
  return 0;
}

interface HelpEntry {
  cmd: string;
  desc: string;
  minLevel: number;
}

const HELP_ENTRIES: HelpEntry[] = [
  { cmd: "help [all]",               desc: "show this message  (help all: show every command)", minLevel: 0 },
  { cmd: "clear / cls",              desc: "clear the screen", minLevel: 0 },
  { cmd: "pwd",                      desc: "print current directory", minLevel: 0 },
  { cmd: "ls [path]",                desc: "list directory contents", minLevel: 0 },
  { cmd: "cat <file>",               desc: "print file contents", minLevel: 0 },
  { cmd: "wifi list",                desc: "show available Wi-Fi networks", minLevel: 0 },
  { cmd: "wifi connect <SSID>",      desc: "connect to a Wi-Fi network", minLevel: 0 },
  { cmd: "eggs",                     desc: "show collected eggs", minLevel: 0 },
  { cmd: "stage",                    desc: "show current stage objective", minLevel: 0 },
  { cmd: "hint [N]",                 desc: "get a hint for stage N (or current stage)", minLevel: 0 },
  { cmd: "difficulty [level]",       desc: "show or set difficulty (easy/medium/hard/impossible)", minLevel: 0 },
  { cmd: "save",                     desc: "export game progress to a save string", minLevel: 0 },
  { cmd: "load <string>",            desc: "restore game progress from a save string", minLevel: 0 },
  { cmd: "asciizoo <animal>",        desc: "fetch ASCII art  (asciizoo list for all animals)", minLevel: 0 },
  { cmd: "cd <path>",                desc: "change directory  (cd with no arg goes home, .. goes up)", minLevel: 1 },
  { cmd: "mkdir <name>",             desc: "create a new directory (inside /home/player)", minLevel: 2 },
  { cmd: "touch <name>",             desc: "create an empty file", minLevel: 2 },
  { cmd: "rm <name>",                desc: "remove a file or empty directory (inside /home/player)", minLevel: 2 },
  { cmd: "edit <file>",              desc: "open the built-in text editor", minLevel: 3 },
  { cmd: "base64 -d <string|file>",  desc: "decode a base64 string or file", minLevel: 4 },
  { cmd: "sudo <command>",           desc: "run a command as administrator (requires password)", minLevel: 4 },
  { cmd: "unzip <file>",             desc: "extract a zip archive in the current directory", minLevel: 5 },
  { cmd: "map",                      desc: "toggle the map panel (medium/hard only)", minLevel: 5 },
];

const IMPOSSIBLE_HELP_TEXT = `Commands available on impossible difficulty:
  help                     this message  (help all shows everything)
  difficulty <level>       change difficulty (you can leave impossible any time)
  clear / cls              clear the screen
  eggs                     show collected eggs
  [all other commands work — no guidance provided]`;

const ASCII_ANIMALS: Record<string, string> = {
  cat:
    " /\\_/\\ \n" +
    "( o.o )\n" +
    " > ^ <\n",
  dog:
    "  / \\__\n" +
    " (    @\\___\n" +
    " /         O\n" +
    "/   (_____/\n" +
    "/_____/   U\n",
  rabbit:
    " (\\(\\  \n" +
    " ( -.-)o\n" +
    " o_(\")(\") \n",
  bird:
    "   .--.\n" +
    "  (o  o)\n" +
    "   )  (\n" +
    "  (_><_)\n" +
    "   |  |\n" +
    "  /|  |\\\n",
  fish:
    "  ><(((º>\n",
  cow:
    "  ___\n" +
    " (o  o)\n" +
    " /|\\|/|\\\n" +
    "/ |   | \\\n" +
    "  ^   ^\n",
  donkey:
    "  /\\ /\\\n" +
    " (  v  ) <(hee-haw!)\n" +
    "  ) = (\n" +
    " /| | |\\\n" +
    " *  ^ ^  *\n",
  fox:
    "  /\\   /\\\n" +
    " ( ^   ^ )\n" +
    " (  v v  )\n" +
    " /|=====|\\\n" +
    "(_|     |_)\n",
  duck:
    "  .---.\n" +
    " ( <  )\n" +
    "  `---'\n" +
    " /|   |\\\n" +
    "  ^   ^\n",
  frog:
    "  @ @\n" +
    " (o o)\n" +
    " ( ∪ )\n" +
    "  \\_/\n",
};

const DIFFICULTY_LEVELS: Difficulty[] = ["easy", "medium", "hard", "impossible"];

function addVisited(ctx: CmdContext, path: string) {
  ctx.setState((s) => {
    if (s.visited.includes(path)) return s;
    return { ...s, visited: [...s.visited, path] };
  });
}

export const commands: Record<string, CommandHandler> = {
  help: (args, ctx) => {
    const showAll = args[0] === "all";
    if (ctx.state.difficulty === "impossible" && !showAll) {
      ctx.print(IMPOSSIBLE_HELP_TEXT, "text-emerald-300");
      return;
    }
    const level = showAll ? 99 : progressLevel(ctx.state);
    const visible = HELP_ENTRIES.filter((e) => e.minLevel <= level);
    ctx.print("Available commands:", "text-emerald-300");
    for (const e of visible) {
      ctx.print(`  ${e.cmd.padEnd(32)} ${e.desc}`);
    }
    ctx.print("");
    if (!showAll) {
      ctx.print("  help all                         show all commands regardless of stage", "text-stone-400");
    }
    ctx.print("");
    ctx.print("Tip: paths starting with / are absolute. '~' = /home/player. '..' goes up.", "text-stone-400");
  },

  start: (_, ctx) => {
    ctx.print("Welcome to Eggshell! Here is how to begin:", "text-emerald-300");
    ctx.print("");
    ctx.print("  1. Type `cat README.txt` to read the intro file.");
    ctx.print("  2. Type `ls` to see what is in your home directory.");
    ctx.print("  3. Type `stage` at any time to see your current objective.");
    ctx.print("");
    ctx.print("Your first mission: get online. Try `wifi list`.", "text-yellow-300");
  },

  clear: () => { /* handled at UI level */ },
  cls: () => { /* handled at UI level */ },

  pwd: (_, ctx) => ctx.print(ctx.cwd),

  stage: (_, ctx) => {
    const text = stageOf(ctx.state);
    if (text) ctx.print(text, "text-yellow-300");
    // silent on impossible (stageOf returns "")
  },

  hint: (args, ctx) => {
    const { difficulty } = ctx.state;
    if (difficulty === "impossible") {
      ctx.print("hint: access denied on impossible difficulty", "text-red-400");
      return;
    }

    let stageIndex: number | undefined;
    if (args[0]) {
      const n = parseInt(args[0], 10);
      if (isNaN(n) || n < 1 || n > STAGES.length) {
        ctx.print(`hint: invalid stage number '${args[0]}' — use 1 to ${STAGES.length}`, "text-red-400");
        return;
      }
      stageIndex = n - 1;
    }

    const h = stageHint(ctx.state, stageIndex);
    if (!h && stageIndex === undefined) {
      ctx.print("No hints needed — all eggs found!", "text-yellow-300");
      return;
    }
    if (!h) {
      ctx.print("hint: no hint available for that stage", "text-stone-400");
      return;
    }
    ctx.print(h, "text-yellow-300");
  },

  difficulty: (args, ctx) => {
    const level = args[0]?.toLowerCase();
    if (!level) {
      ctx.print(`Current difficulty: ${ctx.state.difficulty}`, "text-yellow-300");
      ctx.print("Usage: difficulty <easy|medium|hard|impossible>");
      return;
    }
    if (!DIFFICULTY_LEVELS.includes(level as Difficulty)) {
      ctx.print(`difficulty: unknown level '${level}'`, "text-red-400");
      ctx.print(`  valid: ${DIFFICULTY_LEVELS.join(", ")}`);
      return;
    }
    ctx.setState((s) => ({ ...s, difficulty: level as Difficulty }));
    ctx.print(`Difficulty set to: ${level}`, "text-emerald-300");
    if (level === "impossible") {
      ctx.print("Good luck. The shell is now silent.", "text-stone-400");
    }
  },

  map: (_, ctx) => {
    const { difficulty, mapVisible } = ctx.state;
    if (difficulty === "impossible") {
      ctx.print("map: access denied", "text-red-400");
      return;
    }
    if (difficulty === "easy") {
      ctx.print("The map is always visible on easy difficulty.", "text-stone-400");
      return;
    }
    const next = !mapVisible;
    ctx.setState((s) => ({ ...s, mapVisible: next }));
    ctx.print(next ? "Map shown." : "Map hidden.", "text-stone-400");
  },

  save: (_, ctx) => {
    const s = ctx.state;
    const data = {
      v: 1,
      eggsFound: s.eggsFound,
      wifiConnected: s.wifiConnected,
      wifiSSID: s.wifiSSID,
      createdMagicDir: s.createdMagicDir,
      createdTokenFile: s.createdTokenFile,
      secretsUnlocked: s.secretsUnlocked,
      knowsSudoPassword: s.knowsSudoPassword,
      adminUnlocked: s.adminUnlocked,
      rootEntered: s.rootEntered,
      finalEggFound: s.finalEggFound,
      edits: s.edits,
      userCreated: s.userCreated,
      sudoTries: s.sudoTries,
      difficulty: s.difficulty,
      terminalUser: s.terminalUser,
      visited: s.visited,
      mapVisible: s.mapVisible,
    };
    const encoded = btoa(JSON.stringify(data));
    ctx.print("Save string:", "text-stone-400");
    ctx.print(encoded);
    ctx.print("Use `load <string>` to restore.", "text-stone-400");
    navigator.clipboard?.writeText(encoded).catch(() => {
      ctx.print("(clipboard unavailable — copy the string above manually)", "text-stone-500");
    });
  },

  load: (args, ctx) => {
    const str = args.join("").trim();
    if (!str) {
      ctx.print("load: usage — `load <save-string>`", "text-red-400");
      return;
    }
    try {
      const data = JSON.parse(atob(str));
      if (data.v !== 1) {
        ctx.print(`load: incompatible save version (got v${data.v}, expected v1)`, "text-red-400");
        return;
      }
      ctx.setState(() => ({
        ...initialState,
        eggsFound: data.eggsFound ?? [],
        wifiConnected: data.wifiConnected ?? false,
        wifiSSID: data.wifiSSID ?? "",
        createdMagicDir: data.createdMagicDir ?? false,
        createdTokenFile: data.createdTokenFile ?? false,
        secretsUnlocked: data.secretsUnlocked ?? false,
        knowsSudoPassword: data.knowsSudoPassword ?? false,
        adminUnlocked: data.adminUnlocked ?? false,
        rootEntered: data.rootEntered ?? false,
        finalEggFound: data.finalEggFound ?? false,
        edits: data.edits ?? {},
        userCreated: data.userCreated ?? [],
        sudoTries: data.sudoTries ?? 0,
        difficulty: data.difficulty ?? "easy",
        terminalUser: data.terminalUser ?? "player",
        visited: data.visited ?? ["/home/player"],
        mapVisible: data.mapVisible ?? false,
      }));
      ctx.setCwd("/home/player");
      ctx.print("Save loaded. Welcome back!", "text-emerald-300");
    } catch {
      ctx.print("load: invalid save string", "text-red-400");
    }
  },

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
    const isUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === target);

    if (!node && !isUserDir) {
      ctx.print(`ls: cannot access '${args[0] ?? target}': No such file or directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "file") {
      ctx.print(node.name);
      return;
    }

    addVisited(ctx, target);

    const names: string[] = [];

    if (node && node.kind === "dir") {
      for (const child of node.children) {
        const isLocked = child.kind === "dir" && child.locked && child.locked(ctx.state);
        const suffix = child.kind === "dir" ? (isLocked ? "/  [locked]" : "/") : "";
        names.push(child.name + suffix);
      }
    }

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
      ctx.print(`cd: '${args[0] ?? target}' is locked`, "text-red-400");
      return;
    }
    // /root requires sudo for the first entry even after adminUnlocked
    if (target === "/root" && !ctx.sudoActive && !ctx.state.rootEntered) {
      ctx.print("cd: /root: permission denied", "text-red-400");
      return;
    }
    if (target === "/root" && ctx.sudoActive && !ctx.state.rootEntered) {
      ctx.setState((s) => ({ ...s, rootEntered: true }));
    }
    ctx.setCwd(target);
    addVisited(ctx, target);
  },

  cat: (args, ctx) => {
    if (!args[0]) {
      ctx.print("cat: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);

    // Binary file guard
    if (target.endsWith(".zip")) {
      ctx.print("PK   ¥ÓX«Íï", "text-stone-500");
      ctx.print("ø²Ô ÃµBÑxäÇ.ú»...", "text-stone-500");
      ctx.print("(binary file — output truncated)", "text-stone-500");
      return;
    }

    const node = findNode(ctx.root, target);
    const userFile = ctx.state.userCreated.find(
      (u) => u.type === "file" && u.path === target
    );
    const override = ctx.state.edits[target];

    if (!node && !userFile) {
      ctx.print(`cat: ${args[0]}: No such file or directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "dir") {
      ctx.print(`cat: ${args[0]}: Is a directory`, "text-red-400");
      return;
    }
    const content = override ?? (node?.kind === "file" ? node.content : userFile?.content ?? "");
    ctx.print(content.trimEnd());

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
      ctx.print("mkdir: permission denied", "text-red-400");
      return;
    }
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
      ctx.print("touch: permission denied", "text-red-400");
      return;
    }
    const parentPath = target.split("/").slice(0, -1).join("/") || "/";
    const parentInFs = findNode(ctx.root, parentPath);
    const parentIsUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === parentPath);
    if (!parentInFs && !parentIsUserDir) {
      ctx.print(`touch: cannot touch '${args[0]}': No such file or directory`, "text-red-400");
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
    const userFile = ctx.state.userCreated.find(
      (u) => u.type === "file" && u.path === target
    );

    if (target === "/etc/privilege.cfg" && !ctx.sudoActive) {
      ctx.print("edit: /etc/privilege.cfg: permission denied", "text-red-400");
      return;
    }

    if (!node && !userFile) {
      ctx.print(`edit: ${args[0]}: No such file or directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "dir") {
      ctx.print(`edit: ${args[0]}: Is a directory`, "text-red-400");
      return;
    }
    if (node && node.kind === "file" && !node.editable) {
      ctx.print(`edit: ${args[0]}: file is read-only`, "text-red-400");
      return;
    }

    const initial =
      ctx.state.edits[target] ??
      (node?.kind === "file" ? node.content : userFile?.content ?? "");

    ctx.openEditor(target, initial, (newContent) => {
      let saved = false;
      ctx.setState((s) => {
        const next = { ...s, edits: { ...s.edits, [target]: newContent } };
        const result =
          node && node.kind === "file" && node.onEdit
            ? node.onEdit(newContent)
            : null;
        if (result?.error) {
          ctx.print(`edit: ${result.error}`, "text-red-400");
          return s;
        }
        if (result?.patch) Object.assign(next, result.patch);
        saved = true;
        return next;
      });
      if (saved) ctx.print(`"${args[0]}" saved.`, "text-emerald-300");
    });
  },

  wifi: (args, ctx) => {
    const sub = args[0];
    if (sub === "list") {
      const wifiNode = findNode(ctx.root, "/etc/wifi.json");
      const raw = wifiNode?.kind === "file" ? wifiNode.content : null;
      ctx.print("SSID              SIGNAL  STATUS", "text-emerald-300");
      ctx.print("----------------  ------  ------", "text-emerald-300");
      if (raw) {
        try {
          const data = JSON.parse(raw) as { networks: { ssid: string; signal: number; password: string }[] };
          for (const n of data.networks) {
            const ssid = n.ssid.padEnd(18);
            const signal = `${n.signal}%`.padStart(5);
            const status = n.password === "???" ? (n.signal === 0 ? "hidden" : "open") : "encrypted";
            ctx.print(`${ssid}${signal}   ${status}`);
          }
        } catch {
          ctx.print("(error reading wifi data)", "text-red-400");
        }
      }
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
            ctx.print("Connected to EggHunt-5G — you are ONLINE.", "text-emerald-300");
          } else {
            ctx.print("wifi: authentication failed — wrong password", "text-red-400");
          }
        }, `Password for ${ssid}:`);
        return;
      }
      if (ssid === "NETGEAR-guest" || ssid === "Starbucks-WiFi") {
        ctx.print(
          `wifi: ${ssid} has no internet access in this simulation.`,
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
      ctx.print("base64: usage — `base64 -d <encoded-string-or-file>`", "text-red-400");
      return;
    }
    const raw = args.slice(1).join(" ");
    if (!raw) {
      ctx.print("base64: empty input", "text-red-400");
      return;
    }

    const filePath = resolvePath(ctx.cwd, raw.trim());
    const fileNode = findNode(ctx.root, filePath);
    const userFile = ctx.state.userCreated.find(
      (u) => u.type === "file" && u.path === filePath
    );

    let encoded: string;
    let isFileDecode = false;
    if (fileNode?.kind === "file" || userFile) {
      encoded =
        ctx.state.edits[filePath] ??
        (fileNode?.kind === "file" ? fileNode.content : userFile?.content ?? "");
      ctx.print(`(reading ${filePath})`, "text-stone-500");
      isFileDecode = true;
    } else {
      encoded = raw;
    }

    try {
      const decoded = atob(encoded.replace(/\s/g, ""));
      ctx.print(decoded);
      if (decoded === "secret-egg") {
        ctx.setState((s) => ({ ...s, knowsSudoPassword: true }));
      }
    } catch {
      if (isFileDecode) {
        // Strip to base64 chars only and decode whatever remains
        const b64only = encoded.replace(/[^A-Za-z0-9+/]/g, "");
        if (b64only.length >= 4) {
          try {
            const padded = b64only + "=".repeat((4 - (b64only.length % 4)) % 4);
            ctx.print(atob(padded));
            return;
          } catch {
            // fall through
          }
        }
      }
      ctx.print("base64: invalid base64 input", "text-red-400");
    }
  },

  rm: (args, ctx) => {
    if (!args[0]) {
      ctx.print("rm: missing operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (!target.startsWith("/home/player")) {
      ctx.print("rm: permission denied", "text-red-400");
      return;
    }
    const entry = ctx.state.userCreated.find((u) => u.path === target);
    if (!entry) {
      if (findNode(ctx.root, target)) {
        ctx.print(`rm: cannot remove '${args[0]}': Permission denied (system file)`, "text-red-400");
      } else {
        ctx.print(`rm: cannot remove '${args[0]}': No such file or directory`, "text-red-400");
      }
      return;
    }
    if (entry.type === "dir") {
      const hasChildren = ctx.state.userCreated.some((u) =>
        u.path.startsWith(target + "/")
      );
      if (hasChildren) {
        ctx.print(`rm: cannot remove '${args[0]}': Directory not empty`, "text-red-400");
        return;
      }
    }
    ctx.setState((s) => ({
      ...s,
      userCreated: s.userCreated.filter((u) => u.path !== target),
    }));
    ctx.print(`removed '${target}'`, "text-emerald-300");
  },

  unzip: (args, ctx) => {
    if (!args[0]) {
      ctx.print("unzip: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    const node = findNode(ctx.root, target);
    if (!node || node.kind !== "file") {
      ctx.print(`unzip: cannot open ${args[0]}: No such file or directory`, "text-red-400");
      return;
    }
    if (!args[0].endsWith(".zip") && !target.endsWith(".zip")) {
      ctx.print(`unzip: ${args[0]}: not a zip file`, "text-red-400");
      return;
    }
    if (target === "/root/final_egg.zip") {
      const outPath = "/root/final_egg.txt";
      const already = ctx.state.userCreated.some((u) => u.path === outPath);
      if (already) {
        ctx.print("unzip: final_egg.txt already extracted.", "text-stone-400");
        return;
      }
      const eggContent =
        "🏆 EGG #5 — 'THE PRIZE' 🏆\n" +
        "You made it to /root. Congratulations.\n" +
        "\n" +
        "Skills demonstrated:\n" +
        "  ls · cd · pwd · cat · mkdir · touch · rm\n" +
        "  edit · wifi · base64 -d · unzip · sudo\n" +
        "\n" +
        "Now go try a real shell:\n" +
        "  Windows: install WSL — open the Ubuntu app\n" +
        "  macOS:   Applications → Utilities → Terminal\n" +
        "  Linux:   you're already home\n" +
        "\n" +
        "Type `eggs` to confirm your collection.\n";
      ctx.print("Archive:  final_egg.zip", "text-stone-400");
      ctx.print("  inflating: final_egg.txt", "text-emerald-300");
      ctx.setState((s) => ({
        ...s,
        userCreated: [...s.userCreated, { type: "file", path: outPath, content: eggContent }],
      }));
      return;
    }
    ctx.print(`unzip: ${args[0]}: no handler for this archive`, "text-red-400");
  },

  sudo: (args, ctx) => {
    if (args.length === 0) {
      ctx.print("sudo: usage — `sudo <command> <args...>`", "text-red-400");
      return;
    }
    ctx.passwordPrompt((pwd) => {
      if (pwd !== "secret-egg") {
        let tries = 0;
        ctx.setState((s) => { tries = s.sudoTries + 1; return { ...s, sudoTries: tries }; });
        ctx.print(`sudo: ${tries} incorrect password attempt${tries === 1 ? "" : "s"}`, "text-red-400");
        return;
      }
      ctx.print("(elevated to root for this command)", "text-yellow-300");
      const [cmd, ...rest] = args;
      const handler = commands[cmd];
      if (!handler) {
        ctx.print(`${cmd}: command not found`, "text-red-400");
        return;
      }
      handler(rest, { ...ctx, sudoActive: true });
    }, "[sudo] password for player:");
  },

  asciizoo: (args, ctx) => {
    if (args.length === 0) {
      ctx.print("asciizoo: usage — `asciizoo <animal> [animal2 ...]`", "text-red-400");
      ctx.print("  run `asciizoo list` to see all available animals", "text-stone-400");
      return;
    }
    if (args[0] === "list" || args[0] === "help") {
      ctx.print("asciizoo v0.5.0 — available animals:", "text-stone-400");
      ctx.print("  " + Object.keys(ASCII_ANIMALS).join(", "));
      return;
    }
    const unknown = args.filter((a) => !ASCII_ANIMALS[a.toLowerCase()]);
    if (unknown.length > 0) {
      ctx.print(`asciizoo: unknown animal(s): ${unknown.join(", ")}`, "text-red-400");
      ctx.print("  try 'asciizoo list'", "text-stone-400");
      return;
    }
    ctx.print("asciizoo v0.5.0 — ASCII Zoo Service Client", "text-stone-400");
    ctx.print("bundling request → animals.zip … sending to ascii-zoo.local …", "text-stone-400");
    ctx.print("");
    for (const raw of args) {
      const name = raw.toLowerCase();
      ctx.print(`=== ${name} ===`, "text-emerald-300");
      ctx.print(ASCII_ANIMALS[name]);
    }
  },
};

export function isClear(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  return c === "clear" || c === "cls";
}
