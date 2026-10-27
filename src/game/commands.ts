import { Difficulty, FsNode, GameState, initialState } from "../types";
import { EGGS, ROOT_EGG, TIDY_EGG, fileContent, findNode, hasBackup, lockedAt, resolvePath } from "./fs";
import { STAGES, activeStageIndex, hintExhausted, nextEggLine, parLine, recordHint, stageHint } from "./stage";
import { exportSave, importSave } from "./save";

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
  openMenu: () => void;
}

export type CommandHandler = (args: string[], ctx: CmdContext) => void;

// minStage: 0-based STAGES index (= egg being hunted) from which the entry
// shows in `help`. Descriptions say what the abbreviation stands for, so the
// name means something instead of being memorised.
interface HelpEntry {
  cmd: string;
  desc: string;
  minStage: number;
  game?: true; // game command, listed separately from the shell commands
}

const HELP_ENTRIES: HelpEntry[] = [
  { cmd: "pwd",                       desc: "print working directory — where am I?", minStage: 0 },
  { cmd: "ls [path]",                 desc: "list — show what's in a folder", minStage: 0 },
  { cmd: "cd <path>",                 desc: "change directory  (cd .. goes up, cd alone goes home)", minStage: 0 },
  { cmd: "cat <file>",                desc: "concatenate — print a file's contents", minStage: 0 },
  { cmd: "clear",                     desc: "clear the screen", minStage: 0 },
  { cmd: "man <command>",             desc: "manual — explain one command", minStage: 0 },
  { cmd: "wifi list | connect <name>", desc: "manage Wi-Fi  (EggshellOS only — real systems differ)", minStage: 0 },
  { cmd: "mkdir <name>",              desc: "make directory — create a folder", minStage: 1 },
  { cmd: "touch <file>",              desc: "touch a file: create it empty (or update its timestamp)", minStage: 1 },
  { cmd: "rm <file...>",              desc: "remove files  (* matches any name: rm *.tmp)", minStage: 2 },
  { cmd: "mv <file> <dest>",          desc: "move a file — or rename it", minStage: 2 },
  { cmd: "cp <file> <dest>",          desc: "copy a file", minStage: 3 },
  { cmd: "edit <file>",               desc: "open the text editor  (nano and vim work too)", minStage: 3 },
  { cmd: "base64 -d <text>",          desc: "decode base64 text back into plain text", minStage: 4 },
  { cmd: "sudo <command>",            desc: "superuser do — run one command as the administrator", minStage: 4 },
  { cmd: "unzip <file>",              desc: "extract a .zip archive", minStage: 5 },
  { cmd: "grep [-r] <text> <path>",   desc: "global regular expression print — search inside files (-r: a whole folder)", minStage: 6 },
  { cmd: "start",                     desc: "how to begin", minStage: 0, game: true },
  { cmd: "help [all]",                desc: "this list  (all: every command, even later ones)", minStage: 0, game: true },
  { cmd: "eggs",                      desc: "your eggs so far, and what's next", minStage: 0, game: true },
  { cmd: "hint [N]",                  desc: "a hint for the current egg (or egg N) — ask again for more", minStage: 0, game: true },
  { cmd: "difficulty [level]",        desc: "show or set difficulty (easy/medium/hard/impossible)", minStage: 0, game: true },
  { cmd: "map",                       desc: "toggle the map panel (medium/hard)", minStage: 0, game: true },
  { cmd: "save / load <string>",      desc: "export progress as a string / restore it", minStage: 0, game: true },
  { cmd: "menu",                      desc: "back to the main menu (progress is kept)", minStage: 0, game: true },
  { cmd: "asciizoo <animal>",         desc: "ASCII animals  (asciizoo list)", minStage: 0, game: true },
];

// Hidden aliases: work, but stay out of `help` and Tab completion.
const HIDDEN = ["quit", "exit", "stage", "vi", "cls"];

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

// Shared access check for every command that touches a path: locked
// directories (including everything below them) and the first-entry sudo
// rule for /root. Prints the error and returns true when access is denied.
function blocked(ctx: CmdContext, cmd: string, path: string, shown: string): boolean {
  const lock = lockedAt(ctx.root, path, ctx.state);
  if (lock) {
    ctx.print(`${cmd}: ${shown}: ${lock} is locked`, "text-red-400");
    return true;
  }
  if ((path === "/root" || path.startsWith("/root/")) && !ctx.sudoActive && !ctx.state.rootEntered) {
    ctx.print(`${cmd}: ${shown}: Permission denied`, "text-red-400");
    return true;
  }
  return false;
}

const parentOf = (path: string) => path.split("/").slice(0, -1).join("/") || "/";
const baseName = (path: string) => path.split("/").pop()!;

function isDir(ctx: CmdContext, path: string): boolean {
  const node = findNode(ctx.root, path);
  return node?.kind === "dir" || ctx.state.userCreated.some((u) => u.type === "dir" && u.path === path);
}

// Content of any readable file (edits override system files), or null.
function readFile(ctx: CmdContext, path: string): string | null {
  const node = findNode(ctx.root, path);
  if (node?.kind === "file") return ctx.state.edits[path] ?? fileContent(node, ctx.state);
  return ctx.state.userCreated.find((u) => u.type === "file" && u.path === path)?.content ?? null;
}

// Stage flags that depend on what the player created (mkdir/touch/cp/mv).
function markCreated(s: GameState, path: string, type: "dir" | "file"): GameState {
  if (type === "dir" && path === "/home/player/magic") return { ...s, createdMagicDir: true };
  if (type === "file" && /^\/home\/player\/magic\/token(\.[^/]*)?$/.test(path)) return { ...s, createdTokenFile: true };
  return s;
}

// TIDY stage: once ~/secrets has no *.tmp and the report sits in ~/documents,
// egg #3 appears. Pure, so it can run inside setState.
function withTidy(s: GameState): GameState {
  const u = s.userCreated;
  const done =
    !u.some((f) => /^\/home\/player\/secrets\/[^/]+\.tmp$/.test(f.path)) &&
    u.some((f) => f.path === "/home/player/documents/report.txt") &&
    !u.some((f) => f.path === EGGS[2]);
  return done ? { ...s, userCreated: [...u, { type: "file", path: EGGS[2], content: TIDY_EGG }] } : s;
}

// Destination for cp/mv: into `dst` if it is a directory, else `dst` itself.
// Prints the error and returns null when the destination is not allowed.
function destination(ctx: CmdContext, cmd: string, src: string, dstArg: string): string | null {
  let dst = resolvePath(ctx.cwd, dstArg);
  if (isDir(ctx, dst)) dst = `${dst === "/" ? "" : dst}/${baseName(src)}`;
  if (blocked(ctx, cmd, dst, dstArg)) return null;
  if (!dst.startsWith("/home/player/")) {
    ctx.print(`${cmd}: ${dstArg}: Permission denied`, "text-red-400");
    return null;
  }
  if (!isDir(ctx, parentOf(dst))) {
    ctx.print(`${cmd}: ${dstArg}: No such file or directory`, "text-red-400");
    return null;
  }
  if (findNode(ctx.root, dst) || dst === src) {
    ctx.print(`${cmd}: ${dstArg}: Permission denied (system file)`, "text-red-400");
    return null;
  }
  return dst;
}

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
    const idx = activeStageIndex(ctx.state);
    const level = showAll || idx < 0 ? 99 : idx;
    const visible = HELP_ENTRIES.filter((e) => e.minStage <= level);
    // Joined since the last `help`: another colour plus a text tag (colour-blind safe).
    const isNew = (e: HelpEntry) => e.minStage > ctx.state.helpSeen && level !== 99;
    const row = (e: HelpEntry) =>
      isNew(e)
        ? ctx.print(`  ${e.cmd.padEnd(28)} ${e.desc}  ← new`, "text-yellow-300")
        : ctx.print(`  ${e.cmd.padEnd(28)} ${e.desc}`);
    if (level !== 99 && level > ctx.state.helpSeen) ctx.setState((s) => ({ ...s, helpSeen: level }));
    ctx.print("Shell commands:", "text-emerald-300");
    visible.filter((e) => !e.game).forEach(row);
    ctx.print("");
    ctx.print("Game commands:", "text-emerald-300");
    visible.filter((e) => e.game).forEach(row);
    ctx.print("");
    if (level !== 99) ctx.print("More commands appear here as you find eggs.", "text-stone-400");
    ctx.print("Paths: / starts at the top, ~ is your home, .. is one folder up. Tab completes names.", "text-stone-400");
  },

  man: (args, ctx) => {
    const name = args[0] === "nano" || args[0] === "vim" || args[0] === "vi" ? "edit" : args[0];
    const e = HELP_ENTRIES.find((h) => h.cmd.split(" ")[0] === name);
    if (!e) {
      ctx.print(name ? `man: no manual entry for ${name}` : "man: which command? e.g. `man ls`", "text-red-400");
      return;
    }
    ctx.print(`${e.cmd}`, "text-emerald-300");
    ctx.print(`  ${e.desc}`);
  },

  start: (_, ctx) => {
    ctx.print("Welcome to Eggshell.", "text-emerald-300");
    ctx.print("This is a shell: you type a command, press Enter, and the computer answers.");
    ctx.print("Commands are short — mostly abbreviations of English words.");
    ctx.print("");
    ctx.print("  ls               list what's in this folder");
    ctx.print("  cat README.txt   print a file to the screen");
    ctx.print("  help             every command you can use, and what its name means");
    ctx.print("");
    ctx.print("Tab completes commands and file names. Stuck? Type `hint` — ask again for more.", "text-stone-400");
  },

  clear: () => { /* handled at UI level */ },
  cls: () => { /* handled at UI level */ },

  pwd: (_, ctx) => ctx.print(ctx.cwd),

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
        ctx.print(`hint: no egg #${args[0]} — use 1 to ${STAGES.length}`, "text-red-400");
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
      ctx.print("hint: no hint available for that egg", "text-stone-400");
      return;
    }
    ctx.print(h, "text-yellow-300");

    const idx = stageIndex ?? activeStageIndex(ctx.state);
    if (idx >= 0) {
      // Exhaustion is checked against the pre-increment count: only nudge once
      // the player has already seen this difficulty's top hint tier before.
      const capped = hintExhausted(ctx.state, idx);
      ctx.setState((s) => recordHint(s, idx));
      if (capped && difficulty !== "easy") {
        ctx.print(
          "That's as specific as hints get on this difficulty. If you're stuck, try `difficulty easy` — you can switch back any time.",
          "text-stone-400"
        );
      }
    }
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
    ctx.setState((s) => ({ ...s, difficulty: level as Difficulty, hint: initialState.hint }));
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

  menu: (_, ctx) => {
    ctx.print("returning to main menu… (your progress is safe)", "text-stone-400");
    ctx.openMenu();
  },

  // Silent alias for `menu` — deliberately hidden from help.
  quit: (_, ctx) => {
    ctx.print("returning to main menu… (your progress is safe)", "text-stone-400");
    ctx.openMenu();
  },

  save: (_, ctx) => {
    const encoded = exportSave(ctx.state);
    ctx.print("Save string:", "text-stone-400");
    ctx.print(encoded);
    ctx.print("Use `load <string>` to restore.", "text-stone-400");
    navigator.clipboard?.writeText(encoded).catch(() => {
      ctx.print("(clipboard unavailable — copy the string above manually)", "text-stone-400");
    });
  },

  load: (args, ctx) => {
    const str = args.join("").trim();
    if (!str) {
      ctx.print("load: usage — `load <save-string>`", "text-red-400");
      return;
    }
    const result = importSave(str);
    if (typeof result === "string") {
      ctx.print(`load: ${result}`, "text-red-400");
      return;
    }
    ctx.setState(() => result);
    ctx.setCwd("/home/player");
    ctx.print("Save loaded. Welcome back!", "text-emerald-300");
  },

  eggs: (_, ctx) => {
    const found = EGGS.filter((e) => ctx.state.eggsFound.includes(e));
    ctx.print(`Eggs: ${found.length} / ${EGGS.length}`, "text-yellow-300");
    EGGS.forEach((e, i) => {
      if (found.includes(e)) ctx.print(`  🥚 #${i + 1} ${STAGES[i].name}`);
    });
    const next = nextEggLine(ctx.state);
    if (next) ctx.print(next, "text-yellow-300");
  },

  ls: (args, ctx) => {
    const target = args[0] ? resolvePath(ctx.cwd, args[0]) : ctx.cwd;
    const node = findNode(ctx.root, target);
    const isUserDir = ctx.state.userCreated.some((u) => u.type === "dir" && u.path === target);

    if (!node && !isUserDir) {
      ctx.print(`ls: cannot access '${args[0] ?? target}': No such file or directory`, "text-red-400");
      return;
    }
    if (blocked(ctx, "ls", target, args[0] ?? target)) return;
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
      if (n.includes("[locked]")) ctx.print(n, "text-stone-400");
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
    const userFile = ctx.state.userCreated.find(
      (u) => u.type === "file" && u.path === target
    );
    if (!node && !userDir && !userFile) {
      ctx.print(`cd: no such file or directory: ${args[0]}`, "text-red-400");
      return;
    }
    if ((node && node.kind === "file") || userFile) {
      ctx.print(`cd: not a directory: ${args[0]}`, "text-red-400");
      return;
    }
    if (blocked(ctx, "cd", target, args[0] ?? target)) return;
    if (target === "/root" && !ctx.state.rootEntered) {
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
    if (blocked(ctx, "cat", target, args[0])) return;

    // Binary file guard
    if (target.endsWith(".zip")) {
      ctx.print("PK   ¥ÓX«Íï", "text-stone-400");
      ctx.print("ø²Ô ÃµBÑxäÇ.ú»...", "text-stone-400");
      ctx.print("(binary file — output truncated)", "text-stone-400");
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
    const content = override ?? (node?.kind === "file" ? fileContent(node, ctx.state) : userFile?.content ?? "");
    ctx.print(content.trimEnd());

    if (EGGS.includes(target) && !ctx.state.eggsFound.includes(target)) {
      ctx.setState((s) => (s.eggsFound.includes(target) ? s : { ...s, eggsFound: [...s.eggsFound, target] }));
      // The egg just read completes its stage; the next stage may bring commands.
      const next = EGGS.indexOf(target) + 1;
      if (HELP_ENTRIES.some((e) => e.minStage === next)) ctx.print("(new commands available — see `help`)", "text-stone-400");
      // Last egg: ctx.state predates this command's count, hence + 1.
      if (next === EGGS.length) ctx.print(parLine(ctx.state.commands + 1), "text-yellow-300");
    }
  },

  mkdir: (args, ctx) => {
    if (!args[0]) {
      ctx.print("mkdir: missing operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (!inHome(target)) {
      ctx.print(`mkdir: cannot create directory '${args[0]}': Permission denied`, "text-red-400");
      ctx.print("Only your home, ~ (/home/player), is yours to change.", "text-stone-400");
      return;
    }
    if (blocked(ctx, "mkdir", target, args[0])) return;
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
    ctx.setState((s) => markCreated({ ...s, userCreated: [...s.userCreated, { type: "dir", path: target }] }, target, "dir"));
    ctx.print(`created directory: ${target}`, "text-emerald-300");
  },

  touch: (args, ctx) => {
    if (!args[0]) {
      ctx.print("touch: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (!inHome(target)) {
      ctx.print(`touch: cannot touch '${args[0]}': Permission denied`, "text-red-400");
      ctx.print("Only your home, ~ (/home/player), is yours to change.", "text-stone-400");
      return;
    }
    if (blocked(ctx, "touch", target, args[0])) return;
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
    ctx.setState((s) =>
      markCreated({ ...s, userCreated: [...s.userCreated, { type: "file", path: target, content: "" }] }, target, "file")
    );
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

    if (blocked(ctx, "edit", target, args[0])) return;
    if (target === "/etc/privilege.cfg" && !ctx.sudoActive) {
      ctx.print("edit: /etc/privilege.cfg: permission denied", "text-red-400");
      return;
    }
    if (target === "/home/player/secrets/secrets.cfg" && !hasBackup(ctx.state)) {
      ctx.print("edit: secrets.cfg: house rule — make a backup copy before editing", "text-red-400");
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
      (node?.kind === "file" ? fileContent(node, ctx.state) : userFile?.content ?? "");

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
      const raw = wifiNode?.kind === "file" ? fileContent(wifiNode, ctx.state) : null;
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
            ctx.print("Connected to EggHunt-5G — you're online.", "text-emerald-300");
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
      if (blocked(ctx, "base64", filePath, raw.trim())) return;
      encoded =
        ctx.state.edits[filePath] ??
        (fileNode?.kind === "file" ? fileContent(fileNode, ctx.state) : userFile?.content ?? "");
      ctx.print(`(reading ${filePath})`, "text-stone-400");
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
    // Expand a simple `*` glob against the player's files (no other shell globbing).
    const targets: { path: string; shown: string }[] = [];
    for (const arg of args) {
      const path = resolvePath(ctx.cwd, arg);
      if (!arg.includes("*")) {
        targets.push({ path, shown: arg });
        continue;
      }
      const dir = parentOf(path);
      const re = new RegExp("^" + baseName(path).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      const hits = ctx.state.userCreated.filter((u) => parentOf(u.path) === dir && re.test(baseName(u.path)));
      if (hits.length === 0) ctx.print(`rm: cannot remove '${arg}': No such file or directory`, "text-red-400");
      for (const h of hits) targets.push({ path: h.path, shown: baseName(h.path) });
    }

    const removed: string[] = [];
    for (const { path, shown } of targets) {
      if (blocked(ctx, "rm", path, shown)) continue;
      if (!path.startsWith("/home/player")) {
        ctx.print(`rm: cannot remove '${shown}': Permission denied`, "text-red-400");
        continue;
      }
      if (EGGS.includes(path)) {
        ctx.print(`rm: cannot remove '${shown}': eggs are fragile — leave them be`, "text-red-400");
        continue;
      }
      if (baseName(path) === "report.txt") {
        ctx.print(`rm: '${shown}' is still needed — file it in ~/documents instead`, "text-red-400");
        continue;
      }
      const entry = ctx.state.userCreated.find((u) => u.path === path);
      if (!entry) {
        const msg = findNode(ctx.root, path) ? "Permission denied (system file)" : "No such file or directory";
        ctx.print(`rm: cannot remove '${shown}': ${msg}`, "text-red-400");
        continue;
      }
      if (entry.type === "dir" && ctx.state.userCreated.some((u) => u.path.startsWith(path + "/") && !removed.includes(u.path))) {
        ctx.print(`rm: cannot remove '${shown}': Directory not empty`, "text-red-400");
        continue;
      }
      removed.push(path);
      ctx.print(`removed '${shown}'`, "text-emerald-300");
    }
    if (removed.length === 0) return;
    const update = (s: GameState) => withTidy({ ...s, userCreated: s.userCreated.filter((u) => !removed.includes(u.path)) });
    ctx.setState(update);
  },

  mv: (args, ctx) => {
    if (args.length < 2) {
      ctx.print("mv: usage — `mv <file> <destination>`", "text-red-400");
      return;
    }
    const src = resolvePath(ctx.cwd, args[0]);
    if (blocked(ctx, "mv", src, args[0])) return;
    const entry = ctx.state.userCreated.find((u) => u.path === src);
    if (!entry) {
      const msg = findNode(ctx.root, src) ? "Permission denied (system file)" : "No such file or directory";
      ctx.print(`mv: cannot move '${args[0]}': ${msg}`, "text-red-400");
      return;
    }
    if (entry.type === "dir") {
      ctx.print(`mv: '${args[0]}': moving directories is not supported here`, "text-red-400");
      return;
    }
    if (EGGS.includes(src)) {
      ctx.print(`mv: cannot move '${args[0]}': eggs stay where they hatched`, "text-red-400");
      return;
    }
    const dst = destination(ctx, "mv", src, args[1]);
    if (!dst) return;
    const update = (s: GameState) =>
      withTidy(markCreated({
        ...s,
        userCreated: [...s.userCreated.filter((u) => u.path !== src && u.path !== dst), { ...entry, path: dst }],
      }, dst, "file"));
    ctx.print(`moved '${args[0]}' → ${dst}`, "text-emerald-300");
    ctx.setState(update);
  },

  cp: (args, ctx) => {
    if (args.length < 2) {
      ctx.print("cp: usage — `cp <file> <destination>`", "text-red-400");
      return;
    }
    const src = resolvePath(ctx.cwd, args[0]);
    if (blocked(ctx, "cp", src, args[0])) return;
    if (isDir(ctx, src)) {
      ctx.print(`cp: '${args[0]}': is a directory (copying directories is not supported here)`, "text-red-400");
      return;
    }
    const content = readFile(ctx, src);
    if (content === null) {
      ctx.print(`cp: cannot stat '${args[0]}': No such file or directory`, "text-red-400");
      return;
    }
    const dst = destination(ctx, "cp", src, args[1]);
    if (!dst) return;
    ctx.setState((s) =>
      markCreated({
        ...s,
        userCreated: [...s.userCreated.filter((u) => u.path !== dst), { type: "file", path: dst, content }],
      }, dst, "file")
    );
    ctx.print(`copied '${args[0]}' → ${dst}`, "text-emerald-300");
  },

  unzip: (args, ctx) => {
    if (!args[0]) {
      ctx.print("unzip: missing file operand", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, args[0]);
    if (blocked(ctx, "unzip", target, args[0])) return;
    const node = findNode(ctx.root, target);
    if (!node || node.kind !== "file") {
      ctx.print(`unzip: cannot open ${args[0]}: No such file or directory`, "text-red-400");
      return;
    }
    if (!args[0].endsWith(".zip") && !target.endsWith(".zip")) {
      ctx.print(`unzip: ${args[0]}: not a zip file`, "text-red-400");
      return;
    }
    if (target === "/root/egg6.zip") {
      const outPath = EGGS[5];
      if (ctx.state.userCreated.some((u) => u.path === outPath)) {
        ctx.print("unzip: egg6.txt already extracted.", "text-stone-400");
        return;
      }
      const eggContent = ROOT_EGG;
      ctx.print("Archive:  egg6.zip", "text-stone-400");
      ctx.print("  inflating: egg6.txt", "text-emerald-300");
      ctx.setState((s) => ({
        ...s,
        userCreated: [...s.userCreated, { type: "file", path: outPath, content: eggContent }],
      }));
      return;
    }
    ctx.print(`unzip: ${args[0]}: no handler for this archive`, "text-red-400");
  },

  grep: (args, ctx) => {
    const recursive = args[0] === "-r";
    const rest = recursive ? args.slice(1) : args;
    const pattern = rest[0];
    if (!pattern) {
      ctx.print("grep: usage — `grep [-r] <text> <file-or-directory>`", "text-red-400");
      return;
    }
    const target = resolvePath(ctx.cwd, rest[1] ?? ".");

    if (blocked(ctx, "grep", target, rest[1] ?? target)) return;

    const node = findNode(ctx.root, target);
    const userEntry = ctx.state.userCreated.find((u) => u.path === target);
    if (!node && !userEntry) {
      ctx.print(`grep: ${rest[1] ?? target}: No such file or directory`, "text-red-400");
      return;
    }
    const isDir = (node && node.kind === "dir") || userEntry?.type === "dir";
    if (isDir && !recursive) {
      ctx.print(`grep: ${rest[1] ?? target}: Is a directory (try grep -r)`, "text-red-400");
      return;
    }

    const files: { path: string; content: string }[] = [];
    const addFile = (path: string, fsFile?: FsNode & { kind: "file" }) => {
      const content =
        ctx.state.edits[path] ??
        (fsFile
          ? fileContent(fsFile, ctx.state)
          : ctx.state.userCreated.find((u) => u.type === "file" && u.path === path)?.content ?? "");
      files.push({ path, content });
    };

    if (!isDir) {
      addFile(target, node?.kind === "file" ? node : undefined);
    } else {
      const walk = (d: FsNode & { kind: "dir" }, path: string) => {
        for (const child of d.children) {
          const childPath = `${path === "/" ? "" : path}/${child.name}`;
          if (child.kind === "dir") {
            if (child.locked && child.locked(ctx.state)) continue;
            walk(child, childPath);
          } else {
            addFile(childPath, child);
          }
        }
      };
      if (node?.kind === "dir") walk(node, target);
      for (const u of ctx.state.userCreated) {
        if (u.type === "file" && u.path.startsWith(target + "/") && !lockedAt(ctx.root, u.path, ctx.state)) addFile(u.path);
      }
    }

    let matches = 0;
    for (const f of files) {
      if (f.path.endsWith(".zip")) continue;
      for (const line of f.content.split("\n")) {
        if (line.includes(pattern)) {
          matches++;
          ctx.print(recursive ? `${f.path}:${line}` : line);
        }
      }
    }
    if (matches === 0) ctx.print("(no matches)", "text-stone-400");
  },

  sudo: (args, ctx) => {
    if (args.length === 0) {
      ctx.print("sudo: usage — `sudo <command> <args...>`", "text-red-400");
      return;
    }
    if (!ctx.state.knowsSudoPassword) {
      ctx.print("sudo: you don't know the admin password yet — it's hidden somewhere on this system", "text-red-400");
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

// Aliases: real editor names for experienced users; exit/stage/vi hidden.
commands.nano = commands.vim = commands.vi = commands.edit;
commands.exit = commands.quit;
commands.stage = commands.eggs;

// Tab completion and ghost text share one source.
// First token completes command names; later tokens complete paths.
// candidates() returns every matching token for the last word of `raw`.
// ponytail: prefix + slash, so /home/playerx isn't "home"
const inHome = (p: string) => p === "/home/player" || p.startsWith("/home/player/");

export function candidates(raw: string, root: FsNode, state: GameState, cwd: string): string[] {
  const parts = raw.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const commandNames = () => Object.keys(commands).filter((c) => !HIDDEN.includes(c));
  if (parts.length === 1) return commandNames().filter((c) => c.startsWith(last)).sort();
  // Fixed-word arguments complete from their own list, not from file names.
  const words = { difficulty: DIFFICULTY_LEVELS, man: commandNames() }[parts[0]];
  if (words) return parts.length === 2 ? words.filter((w) => w.startsWith(last)).sort() : [];

  // Path completion: split the token into directory part + name prefix.
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const prefix = slash >= 0 ? last.slice(slash + 1) : last;
  const dirPath = resolvePath(cwd, dirPart);
  const node = findNode(root, dirPath);

  const names: string[] = [];
  if (lockedAt(root, dirPath, state)) return [];
  // /root's contents stay unseen until you've entered it once (as root).
  if (dirPath === "/root" && !state.rootEntered) return [];
  if (node?.kind === "dir") {
    for (const c of node.children) names.push(c.name + (c.kind === "dir" ? "/" : ""));
  }
  for (const u of state.userCreated) {
    const parent = u.path.split("/").slice(0, -1).join("/") || "/";
    if (parent === dirPath) names.push(u.path.split("/").pop()! + (u.type === "dir" ? "/" : ""));
  }
  return names.filter((n) => n.startsWith(prefix)).map((n) => dirPart + n).sort();
}

// The completed input line (single match, or longest common prefix), or null
// if that adds nothing.
export function completeInput(raw: string, root: FsNode, state: GameState, cwd: string): string | null {
  const list = candidates(raw, root, state, cwd);
  if (list.length === 0) return null;
  const parts = raw.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const trailer = parts.length === 1 ? " " : "";
  const completion = list.length === 1 ? list[0] + trailer : commonPrefix(list);
  if (completion.length <= last.length) return null;
  return raw.slice(0, raw.length - last.length) + completion;
}

function commonPrefix(list: string[]): string {
  let p = list[0];
  for (const s of list) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
  }
  return p;
}

export function isClear(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  return c === "clear" || c === "cls";
}
