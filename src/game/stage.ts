import { Difficulty, GameState } from "../types";
import { EGGS, hasBackup, hasEgg } from "./fs";

// Egg = stage. Each stage is the hunt for one egg; reading the egg completes it.
// Help comes in four levels: 0 is the world itself (files, eggs, messages),
// then `hint` tiers 1–3: nudge, direction, exact commands.

// A hint tier is plain text, or a function so the text can react to
// sub-progress within the stage (e.g. "folder made, file missing").
type HintText = string | ((s: GameState) => string);

interface StageDef {
  name: string; // egg name, shown in `eggs` and the top bar
  goal: string; // objective in story terms — never names a command
  hints: [HintText, HintText, HintText];
  gate: (s: GameState) => boolean; // true while the egg is not found yet
  // Sub-progress inside the stage. A change resets hint escalation.
  step?: (s: GameState) => string;
  // The way to the egg is open but the egg is unread: announce once, and
  // `hint` repeats the announcement instead of a tier.
  opened?: (s: GameState) => boolean;
  announce?: string;
}

const extracted = (s: GameState) => s.userCreated.some((u) => u.path === EGGS[5]);
const junkLeft = (s: GameState) =>
  s.userCreated.some((u) => /^\/home\/player\/secrets\/[^/]+\.tmp$/.test(u.path));

export const STAGES: StageDef[] = [
  {
    name: "The Signal",
    goal: "Hen's first egg waits in ~/documents, but this machine is offline.",
    hints: [
      "Read README.txt in your home folder. What keeps the first door shut?",
      "You need a network. `help` lists a command for Wi-Fi, and Hen kept the password in a file in /etc.",
      "`cat /etc/wifi.json`, then `wifi connect EggHunt-5G` and type the password from that file.",
    ],
    gate: (s) => !hasEgg(s, 1),
    opened: (s) => s.wifiConnected,
    announce: "🔓 ~/documents just unlocked.",
  },
  {
    name: "The Builder",
    goal: "Solve Hen's riddle in ~/documents.",
    hints: [
      "The riddle in ~/documents describes something to build. Read it word by word.",
      (s) =>
        s.createdMagicDir
          ? "The magic folder exists. Now leave a token inside it — an empty file will do. `help` shows how."
          : "Make a folder named magic in your home folder. `help` shows the command for making directories.",
      (s) => (s.createdMagicDir ? "`touch ~/magic/token.txt`" : "`mkdir ~/magic`, then `touch ~/magic/token.txt`"),
    ],
    gate: (s) => !hasEgg(s, 2),
    step: (s) => (s.createdMagicDir ? "token" : "dir"),
    opened: (s) => s.createdMagicDir && s.createdTokenFile,
    announce: "🔓 ~/secrets just unlocked.",
  },
  {
    name: "The Janitor",
    goal: "~/secrets is over quota. Clean it up.",
    hints: [
      "Read quota.txt in ~/secrets. Two jobs: some files go, one file moves.",
      (s) =>
        junkLeft(s)
          ? "Remove the files ending in .tmp. One command takes several names — or the wildcard *.tmp."
          : "The junk is gone. Now move report.txt into ~/documents. `help` lists a command for moving.",
      (s) =>
        junkLeft(s)
          ? "`cd ~/secrets`, `rm *.tmp`, then `mv report.txt ~/documents/`"
          : "`mv ~/secrets/report.txt ~/documents/`",
    ],
    gate: (s) => !hasEgg(s, 3),
    step: (s) => (junkLeft(s) ? "junk" : "report"),
    opened: (s) => s.userCreated.some((u) => u.path === EGGS[2]),
    announce: "✨ Something new appeared in ~/secrets.",
  },
  {
    name: "The Editor",
    goal: "Open the vault. Its door is set in a config file in ~/secrets.",
    hints: [
      "secrets.cfg controls the vault door. Files can be changed, not just read — and this one has a house rule.",
      (s) =>
        hasBackup(s)
          ? "Backup done. Open secrets.cfg in the editor and unlock the vault. editor-tips.txt explains saving."
          : "First make a backup copy of secrets.cfg (`help` shows how to copy), then open it in the editor.",
      (s) =>
        (hasBackup(s) ? "" : "`cp ~/secrets/secrets.cfg ~/secrets/secrets.cfg.bak`, then ") +
        "`edit ~/secrets/secrets.cfg`, change true to false, save with Ctrl+S (Cmd+S on Mac).",
    ],
    gate: (s) => !hasEgg(s, 4),
    step: (s) => (hasBackup(s) ? "edit" : "backup"),
    opened: (s) => s.secretsUnlocked,
    announce: "🔓 ~/vault just unlocked.",
  },
  {
    name: "The Administrator",
    goal: "Become an administrator. The vault knows the password.",
    hints: [
      (s) =>
        s.knowsSudoPassword
          ? "You know the password. Who counts as an admin is written in a file in /etc."
          : "Hen hid the admin password in the vault. Read every file there.",
      (s) =>
        s.knowsSudoPassword
          ? "/etc/privilege.cfg decides who is admin, and only root may change it. how-to-sudo.txt explains how to act as root."
          : "The passphrase in sudo_clue.json is base64 — an encoding anyone can reverse. `help` lists a decoder.",
      (s) =>
        s.knowsSudoPassword
          ? "`sudo edit /etc/privilege.cfg`, enter the decoded password, set allow_admin=true, save."
          : "`base64 -d c2VjcmV0LWVnZw==` — the output is the admin password.",
    ],
    gate: (s) => !hasEgg(s, 5),
    step: (s) => (s.knowsSudoPassword ? "sudo" : "decode"),
    opened: (s) => s.adminUnlocked,
    announce: "🔓 ~/admin just unlocked.",
  },
  {
    name: "The Root",
    goal: "Get into /root, the administrator's home.",
    hints: [
      "The next egg is in /root, the administrator's own home folder.",
      (s) =>
        s.rootEntered
          ? "The egg is packed in an archive. `help` lists a command to unpack it."
          : "A plain `cd /root` is refused the first time. Run the command itself as root.",
      (s) => (s.rootEntered ? "`unzip egg6.zip`, then `cat egg6.txt`" : "`sudo cd /root`, then `unzip egg6.zip`"),
    ],
    gate: (s) => !hasEgg(s, 6),
    step: (s) => (s.rootEntered ? "unzip" : "enter"),
    opened: extracted,
  },
  {
    name: "The Investigator",
    goal: "Find out where the last egg went.",
    hints: [
      "Something wrote to the system logs in /var/log. Which log mentions an egg?",
      "Don't read logs line by line — search them. `grep <word> <file>` prints matching lines; -r searches a whole folder.",
      "`grep -r egg /var/log`, then `cat` the path it shows.",
    ],
    gate: (s) => !hasEgg(s, 7),
  },
];

// Index of the egg being hunted (-1 when all are found).
export function activeStageIndex(s: GameState): number {
  return STAGES.findIndex((st) => st.gate(s));
}

export const doorOpen = (idx: number, s: GameState) => !!STAGES[idx]?.opened?.(s);

// `eggs` / top bar: the objective for the egg being hunted, per difficulty.
export function nextEggLine(s: GameState): string {
  const idx = activeStageIndex(s);
  if (idx < 0) return "🏆 All seven eggs found. You've hatched.";
  if (s.difficulty === "impossible") return "";
  const st = STAGES[idx];
  const head = `Next: #${idx + 1} ${st.name}`;
  return s.difficulty === "hard" ? head : `${head} — ${st.goal}`;
}

// --- Hint escalation --------------------------------------------------------
// Repeated asks climb tiers 1→3, capped by difficulty. The counter belongs to
// a situation (stage + step), so sub-progress starts over at the nudge;
// COOLDOWN commands without asking drop it one tier. Difficulty change and
// load reset it entirely.
const TIER_CAP: Record<Difficulty, number> = { easy: 2, medium: 1, hard: 0, impossible: -1 };
const COOLDOWN = 8; // ponytail: fixed, tune after playtest

function hintKey(s: GameState, idx: number): string {
  return `${idx}:${STAGES[idx].step?.(s) ?? ""}:${doorOpen(idx, s) ? "open" : ""}`;
}

function asks(s: GameState, idx: number): number {
  return s.hint.key === hintKey(s, idx) ? s.hint.asks : 0;
}

// The hint for the given stage (or the active one) at the current tier,
// prefixed "hint n/max:". Null when forbidden or all eggs are found.
export function stageHint(s: GameState, stageIndex?: number): string | null {
  const cap = TIER_CAP[s.difficulty];
  const idx = stageIndex ?? activeStageIndex(s);
  const st = STAGES[idx];
  if (cap < 0 || !st) return null;
  if (doorOpen(idx, s) && st.gate(s)) return st.announce ?? "The way is open — find the egg.";
  const tier = Math.min(asks(s, idx), cap);
  const h = st.hints[tier];
  return `hint ${tier + 1}/${cap + 1}: ${typeof h === "function" ? h(s) : h}`;
}

// True once asking again cannot give more (used for the difficulty nudge).
export function hintExhausted(s: GameState, idx: number): boolean {
  return asks(s, idx) > TIER_CAP[s.difficulty];
}

export function recordHint(s: GameState, idx: number): GameState {
  return { ...s, hint: { key: hintKey(s, idx), asks: asks(s, idx) + 1, since: 0 } };
}

// Called once per non-hint command: drives the cooldown.
export function tickHint(s: GameState): GameState {
  const since = s.hint.since + 1;
  if (since >= COOLDOWN && s.hint.asks > 0) return { ...s, hint: { ...s.hint, asks: s.hint.asks - 1, since: 0 } };
  return { ...s, hint: { ...s.hint, since } };
}
