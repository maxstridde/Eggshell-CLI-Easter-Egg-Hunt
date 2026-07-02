import { Difficulty, GameState } from "../types";

// A hint tier is plain text, or a function so the text can react to
// sub-progress within the stage (e.g. "mkdir done, touch missing").
type HintText = string | ((s: GameState) => string);

interface StageDef {
  label: string;
  description: string; // easy: full step-by-step guidance
  partial: string;     // medium: objective without exact commands
  // Escalating tiers: [0] gentle nudge, [1] concrete direction, [2] exact commands.
  hints: [HintText, HintText, HintText];
  gate: (s: GameState) => boolean;
}

const EGG6_PATH = "/var/backups/egg6.txt";

const finalEggExtracted = (s: GameState) =>
  s.userCreated.some((u) => u.path === "/root/final_egg.txt");

export const STAGES: StageDef[] = [
  {
    label: "1-offline",
    description: "Stage 1 — OFFLINE: connect to Wi-Fi  (`wifi list`, then `wifi connect <SSID>`)",
    partial: "Stage 1 — OFFLINE: you are not connected to the internet",
    hints: [
      "This machine is offline, and locked doors around here care about that. What do computers need before they can reach anything?",
      "There is a command for managing wireless networks — try `wifi` on its own and see what it tells you. Network details also tend to live in /etc.",
      "Run `wifi list`, then `wifi connect EggHunt-5G`. The password is written in /etc/wifi.json — `cat` it if you haven't.",
    ],
    gate: (s) => !s.wifiConnected,
  },
  {
    label: "2-create",
    description:
      "Stage 2 — CREATE: go home (`cd ~`), then `mkdir magic`, `cd magic`, `touch token.txt`  (the file must be named token.txt)",
    partial: "Stage 2 — CREATE: build a special directory structure in your home folder",
    hints: [
      "The riddle in ~/documents/clue2.riddle spells out exactly what to build. Read it again, word by word.",
      (s) =>
        s.createdMagicDir
          ? "The magic folder exists — now it needs a token left inside it. There is a command for creating empty files."
          : "You need to build something in your home folder: a directory with a specific name, and a file left inside it. `help` lists the commands for both.",
      (s) =>
        s.createdMagicDir
          ? "`cd ~/magic`, then `touch token.txt`."
          : "`cd ~`, `mkdir magic`, `cd magic`, `touch token.txt`. Check with `ls`.",
    ],
    gate: (s) => !s.createdMagicDir || !s.createdTokenFile,
  },
  {
    label: "3-edit",
    description:
      "Stage 3 — EDIT: `cd ~/secrets` then `edit secrets.cfg` and flip the flag to false",
    partial: "Stage 3 — EDIT: a config file in ~/secrets controls the vault door",
    hints: [
      "Locked doors on this system tend to be controlled by config files. Have you read everything in ~/secrets?",
      "secrets.cfg in ~/secrets controls the vault door — and files can be changed, not just read. editor-tips.txt explains how.",
      "`cd ~/secrets`, then `edit secrets.cfg`. Change `path_to_vault_locked = true` to `false`. Save with Ctrl+S (or Cmd+S on Mac).",
    ],
    gate: (s) => !s.secretsUnlocked,
  },
  {
    label: "4-decode",
    description:
      "Stage 4 — DECODE: find and decode the base64 credential in ~/vault",
    partial: "Stage 4 — DECODE: a file in ~/vault contains an encoded clue",
    hints: [
      "The vault holds a credential, but part of it doesn't look readable. Some text is encoded, not secret.",
      "The passphrase field in ~/vault/sudo_clue.json is base64 — there is a command that decodes it.",
      "`cd ~/vault`, `cat sudo_clue.json`, then `base64 -d` the passphrase value. Remember the result.",
    ],
    gate: (s) => !s.knowsSudoPassword,
  },
  {
    label: "5-sudo",
    description:
      "Stage 5 — SUDO: `sudo edit /etc/privilege.cfg` and flip allow_admin to true",
    partial: "Stage 5 — SUDO: a system config file needs privileged access to edit",
    hints: [
      "Admin rights on this machine are controlled somewhere. System-wide configuration lives in /etc.",
      "/etc/privilege.cfg needs elevated privileges to edit — how-to-sudo.txt in ~/vault explains the command you need.",
      "Run `sudo edit /etc/privilege.cfg`, enter the decoded passphrase, change `allow_admin=false` to `true`, save.",
    ],
    gate: (s) => !s.adminUnlocked,
  },
  {
    label: "6-root",
    description:
      "Stage 6 — ROOT: get into /root with sudo, unzip the archive, then cat the result",
    partial: "Stage 6 — ROOT: the fifth egg is packed in /root",
    hints: [
      "The next egg lives where only root may go.",
      (s) =>
        !s.rootEntered
          ? "/root is open to administrators now — but a plain `cd` isn't enough. Elevate the command itself."
          : "You're in /root. The egg is packed inside the archive — there's a command for that.",
      (s) =>
        !s.rootEntered
          ? "`sudo cd /root`, then deal with the archive you find there."
          : finalEggExtracted(s)
          ? "`cat final_egg.txt`."
          : "`unzip final_egg.zip`, then `cat final_egg.txt`.",
    ],
    gate: (s) => !s.finalEggFound,
  },
  {
    label: "7-search",
    description:
      "Stage 7 — SEARCH: something left traces in /var/log — `grep` through the logs to find the last egg",
    partial: "Stage 7 — SEARCH: the system logs recorded where the last egg went",
    hints: [
      "Logs remember everything that happens on a system. Nobody reads them line by line — there is a faster way.",
      "`grep <word> <file>` prints only the matching lines, and `grep -r <word> <dir>` searches a whole directory. /var/log is where systems keep their logs.",
      "`grep -r egg /var/log` — then `cat` the path it reveals.",
    ],
    gate: (s) => !s.eggsFound.includes(EGG6_PATH),
  },
];

export function activeStage(s: GameState): StageDef | null {
  return STAGES.find((st) => st.gate(s)) ?? null;
}

export function stageOf(s: GameState): string {
  const st = activeStage(s);
  if (!st) return "🏆 COMPLETE — all eggs collected!";
  const d = s.difficulty;
  if (d === "impossible") return "";
  if (d === "hard") return st.label;
  if (d === "medium") return st.partial;
  return st.description;
}

export function stageLabel(s: GameState): string {
  const st = activeStage(s);
  return st ? st.label : "done";
}

// Index of the current uncompleted stage in STAGES (-1 when all done).
export function activeStageIndex(s: GameState): number {
  return STAGES.findIndex((st) => st.gate(s));
}

// Hint escalation: repeated asks climb the tiers, capped by difficulty.
// easy starts one tier up and can reach the full walkthrough;
// hard never gets past the nudge; impossible gets nothing.
const TIER_START: Record<Difficulty, number> = { easy: 1, medium: 0, hard: 0, impossible: 0 };
const TIER_CAP: Record<Difficulty, number> = { easy: 2, medium: 1, hard: 0, impossible: -1 };

function hintTier(s: GameState, idx: number): number {
  const asks = s.hintAskedCount[idx] ?? 0;
  return Math.min(TIER_START[s.difficulty] + asks, TIER_CAP[s.difficulty]);
}

// Returns the hint for the given stage (or the active stage), escalating with
// each repeated ask up to the difficulty's cap. Null when forbidden or done.
export function stageHint(s: GameState, stageIndex?: number): string | null {
  if (s.difficulty === "impossible") return null;
  const idx = stageIndex ?? activeStageIndex(s);
  const st = STAGES[idx];
  if (!st) return null;
  const h = st.hints[hintTier(s, idx)];
  return typeof h === "function" ? h(s) : h;
}

// True once the player has already seen this stage's top reachable tier —
// the point where asking again cannot give more (used for the difficulty nudge).
export function hintExhausted(s: GameState, idx: number): boolean {
  const asks = s.hintAskedCount[idx] ?? 0;
  return TIER_START[s.difficulty] + asks > TIER_CAP[s.difficulty];
}
