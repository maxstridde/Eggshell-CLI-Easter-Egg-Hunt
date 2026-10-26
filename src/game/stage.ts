import { Difficulty, GameState } from "../types";
import { EGGS, hasBackup, hasEgg } from "./fs";

// A hint tier is plain text, or a function so the text can react to
// sub-progress within the stage (e.g. "mkdir done, touch missing").
type HintText = string | ((s: GameState) => string);

interface StageDef {
  label: string;
  description: string; // easy: full step-by-step guidance
  partial: string;     // medium: objective without exact commands
  // Escalating tiers: [0] gentle nudge, [1] concrete direction, [2] exact commands.
  hints: [HintText, HintText, HintText];
  gate: (s: GameState) => boolean; // true while the stage is unfinished
  // Sub-progress inside the stage. A change resets hint escalation.
  step?: (s: GameState) => string;
  // Door opened but egg not read yet: hints point into `room` instead.
  opened?: (s: GameState) => boolean;
  room?: string;
}

const extracted = (s: GameState) => s.userCreated.some((u) => u.path === EGGS[5]);
const junkLeft = (s: GameState) =>
  s.userCreated.some((u) => /^\/home\/player\/secrets\/[^/]+\.tmp$/.test(u.path));

export const STAGES: StageDef[] = [
  {
    label: "1-offline",
    description: "Stage 1 — OFFLINE: get online. `wifi list`, then `wifi connect <SSID>`.",
    partial: "Stage 1 — OFFLINE: you are not connected to a network.",
    hints: [
      "This machine is offline, and some doors care about that. What does a computer need before it can reach anything?",
      "`wifi` manages wireless networks — run it on its own. Network passwords tend to live in config files under /etc.",
      "`cat /etc/wifi.json`, then `wifi connect EggHunt-5G` with the password you found there.",
    ],
    gate: (s) => !hasEgg(s, 1),
    opened: (s) => s.wifiConnected,
    room: "~/documents",
  },
  {
    label: "2-create",
    description: "Stage 2 — CREATE: in your home folder, `mkdir magic`, then `touch magic/token.txt`.",
    partial: "Stage 2 — CREATE: build what the riddle describes in your home folder.",
    hints: [
      "~/documents/clue2.riddle says exactly what to build. Read it again, word by word.",
      (s) =>
        s.createdMagicDir
          ? "The magic folder exists. Now leave a token inside it — there's a command for creating empty files."
          : "In your home folder: a directory with a specific name, and a file left inside it. `help` lists the commands for both.",
      (s) => (s.createdMagicDir ? "`touch ~/magic/token.txt`." : "`cd ~`, `mkdir magic`, `touch magic/token.txt`."),
    ],
    gate: (s) => !hasEgg(s, 2),
    step: (s) => (s.createdMagicDir ? "token" : "dir"),
    opened: (s) => s.createdMagicDir && s.createdTokenFile,
    room: "~/secrets",
  },
  {
    label: "3-tidy",
    description: "Stage 3 — TIDY: in ~/secrets, delete the .tmp files (`rm`) and move report.txt to ~/documents (`mv`).",
    partial: "Stage 3 — TIDY: ~/secrets is over quota. Clean it up.",
    hints: [
      "~/secrets is a mess. quota.txt lists what has to go and what has to move.",
      (s) =>
        junkLeft(s)
          ? "Delete the files ending in .tmp. One command takes several names, or a pattern like *.tmp."
          : "The junk is gone. report.txt belongs in ~/documents — there's a command that moves files.",
      (s) =>
        junkLeft(s)
          ? "`cd ~/secrets`, `rm *.tmp`, then `mv report.txt ~/documents/`."
          : "`mv ~/secrets/report.txt ~/documents/`.",
    ],
    gate: (s) => !hasEgg(s, 3),
    step: (s) => (junkLeft(s) ? "junk" : "report"),
    opened: (s) => s.userCreated.some((u) => u.path === EGGS[2]),
    room: "~/secrets",
  },
  {
    label: "4-edit",
    description: "Stage 4 — EDIT: back up ~/secrets/secrets.cfg with `cp`, then `edit` it to unlock the vault.",
    partial: "Stage 4 — EDIT: a config file in ~/secrets controls the vault door.",
    hints: [
      "The vault door is controlled by a config file in ~/secrets. Files can be changed, not just read.",
      (s) =>
        hasBackup(s)
          ? "Backup done. Open secrets.cfg in the editor and change the vault setting."
          : "secrets.cfg has a house rule: back it up before changing it. editor-tips.txt shows how to copy a file.",
      (s) =>
        (hasBackup(s) ? "" : "`cp ~/secrets/secrets.cfg ~/secrets/secrets.cfg.bak`, then ") +
        "`edit ~/secrets/secrets.cfg`, set `path_to_vault_locked = false`, save with Ctrl+S (Cmd+S on Mac).",
    ],
    gate: (s) => !hasEgg(s, 4),
    step: (s) => (hasBackup(s) ? "edit" : "backup"),
    opened: (s) => s.secretsUnlocked,
    room: "~/vault",
  },
  {
    label: "5-decode",
    description: "Stage 5 — DECODE: decode the base64 passphrase in ~/vault/sudo_clue.json (`base64 -d`).",
    partial: "Stage 5 — DECODE: a file in ~/vault holds an encoded credential.",
    hints: [
      "The vault holds a credential, but one field looks like gibberish. Encoded isn't the same as secret.",
      "The passphrase in ~/vault/sudo_clue.json is base64, and there's a command that decodes it.",
      "`cat ~/vault/sudo_clue.json`, then `base64 -d` followed by the passphrase value. Remember the result.",
    ],
    gate: (s) => !s.knowsSudoPassword,
  },
  {
    label: "6-sudo",
    description: "Stage 6 — SUDO: `sudo edit /etc/privilege.cfg` and set allow_admin to true.",
    partial: "Stage 6 — SUDO: a system config file needs root to change.",
    hints: [
      "Admin rights are set somewhere system-wide. System configuration lives in /etc.",
      "/etc/privilege.cfg decides who is admin, and only root may edit it. how-to-sudo.txt in ~/vault explains how to borrow root.",
      "`sudo edit /etc/privilege.cfg`, enter the decoded passphrase, set `allow_admin=true`, save.",
    ],
    gate: (s) => !hasEgg(s, 5),
    opened: (s) => s.adminUnlocked,
    room: "~/admin",
  },
  {
    label: "7-root",
    description: "Stage 7 — ROOT: `sudo cd /root`, `unzip` the archive, then `cat` the egg.",
    partial: "Stage 7 — ROOT: an egg is packed away in /root.",
    hints: [
      "The next egg lives where only root may go.",
      (s) =>
        s.rootEntered
          ? "You're in /root. The egg is packed in an archive — there's a command to unpack it."
          : "/root is open to admins, but a plain `cd` isn't enough. Run the command itself as root.",
      (s) => (s.rootEntered ? "`unzip final_egg.zip`, then `cat final_egg.txt`." : "`sudo cd /root`, then `unzip final_egg.zip`."),
    ],
    gate: (s) => !hasEgg(s, 6),
    step: (s) => (s.rootEntered ? "unzip" : "enter"),
    opened: extracted,
    room: "/root",
  },
  {
    label: "8-search",
    description: "Stage 8 — SEARCH: `grep -r` through /var/log to find where the last egg went.",
    partial: "Stage 8 — SEARCH: the system logs recorded where the last egg went.",
    hints: [
      "Logs remember everything. Nobody reads them line by line — there's a faster way.",
      "`grep <word> <file>` prints only matching lines; `grep -r <word> <dir>` searches a whole directory. Logs live in /var/log.",
      "`grep -r egg /var/log`, then `cat` the path it reveals.",
    ],
    gate: (s) => !hasEgg(s, 7),
  },
];

export function activeStage(s: GameState): StageDef | null {
  return STAGES.find((st) => st.gate(s)) ?? null;
}

const doorOpen = (st: StageDef, s: GameState) => !!st.opened?.(s);
const roomLine = (st: StageDef) => `The door is open — look in ${st.room} and read the egg.`;

export function stageOf(s: GameState): string {
  const st = activeStage(s);
  if (!st) return "🏆 COMPLETE — all eggs collected!";
  const d = s.difficulty;
  if (d === "impossible") return "";
  if (d === "hard") return st.label;
  const text = d === "medium" ? st.partial : st.description;
  return doorOpen(st, s) ? `${text}\n${roomLine(st)}` : text;
}

export function stageLabel(s: GameState): string {
  const st = activeStage(s);
  return st ? st.label : "done";
}

// Index of the current uncompleted stage in STAGES (-1 when all done).
export function activeStageIndex(s: GameState): number {
  return STAGES.findIndex((st) => st.gate(s));
}

// --- Hint escalation --------------------------------------------------------
// Repeated asks climb the tiers, capped by difficulty: easy starts one tier
// up and reaches the full walkthrough, hard never gets past the nudge,
// impossible gets nothing. The counter belongs to a situation (stage + step),
// so sub-progress starts over at the nudge; COOLDOWN commands without asking
// drop it one tier. Difficulty change and load reset it entirely.
const TIER_START: Record<Difficulty, number> = { easy: 1, medium: 0, hard: 0, impossible: 0 };
const TIER_CAP: Record<Difficulty, number> = { easy: 2, medium: 1, hard: 0, impossible: -1 };
const COOLDOWN = 8; // ponytail: fixed, tune after playtest

function hintKey(s: GameState, idx: number): string {
  const st = STAGES[idx];
  return `${idx}:${st.step?.(s) ?? ""}:${doorOpen(st, s) ? "open" : ""}`;
}

function asks(s: GameState, idx: number): number {
  return s.hint.key === hintKey(s, idx) ? s.hint.asks : 0;
}

// The hint for the given stage (or the active one) at the current tier.
// Null when forbidden or done.
export function stageHint(s: GameState, stageIndex?: number): string | null {
  if (s.difficulty === "impossible") return null;
  const idx = stageIndex ?? activeStageIndex(s);
  const st = STAGES[idx];
  if (!st) return null;
  if (doorOpen(st, s) && st.gate(s)) return roomLine(st);
  const h = st.hints[Math.min(TIER_START[s.difficulty] + asks(s, idx), TIER_CAP[s.difficulty])];
  return typeof h === "function" ? h(s) : h;
}

// True once asking again cannot give more (used for the difficulty nudge).
export function hintExhausted(s: GameState, idx: number): boolean {
  return TIER_START[s.difficulty] + asks(s, idx) > TIER_CAP[s.difficulty];
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
