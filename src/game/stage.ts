import { GameState } from "./fs";

interface StageDef {
  label: string;
  description: string; // easy: full step-by-step guidance
  partial: string;     // medium: objective without exact commands
  hints: {
    verbose: string; // shown at easy / medium difficulty (hint goes one level easier)
    brief: string;   // shown at hard difficulty (one level easier = medium)
  };
  gate: (s: GameState) => boolean;
}

const STAGES: StageDef[] = [
  {
    label: "1-offline",
    description: "Stage 1 — OFFLINE: connect to Wi-Fi  (`wifi list`, then `wifi connect <SSID>`)",
    partial: "Stage 1 — OFFLINE: you are not connected to the internet",
    hints: {
      verbose:
        "Run `wifi list` to see available networks. Connect with `wifi connect EggHunt-5G` and enter the password.",
      brief: "Try `wifi list` to discover networks you can join.",
    },
    gate: (s) => !s.wifiConnected,
  },
  {
    label: "2-create",
    description:
      "Stage 2 — CREATE: go home (`cd ~`), then `mkdir magic`, `cd magic`, `touch token.txt`",
    partial: "Stage 2 — CREATE: build a special directory structure in your home folder",
    hints: {
      verbose:
        "Go home: `cd ~`. Create a folder: `mkdir magic`. Enter it: `cd magic`. Leave a token: `touch token.txt`.",
      brief: "Create a directory called magic with a file inside it.",
    },
    gate: (s) => !s.createdMagicDir || !s.createdTokenFile,
  },
  {
    label: "3-edit",
    description:
      "Stage 3 — EDIT: `cd ~/secrets` then `edit secrets.cfg` and flip the flag to false",
    partial: "Stage 3 — EDIT: a config file in ~/secrets controls the vault door",
    hints: {
      verbose:
        "Run `cd ~/secrets`, then `edit secrets.cfg`. Change `path_to_vault_locked = true` to `false`. Save with Ctrl+S.",
      brief: "Edit the config file in ~/secrets — flip one boolean flag.",
    },
    gate: (s) => !s.secretsUnlocked,
  },
  {
    label: "4-decode",
    description:
      "Stage 4 — DECODE: decode the base64 clue in ~/vault  (`base64 -d sudo_clue.b64`)",
    partial: "Stage 4 — DECODE: a file in ~/vault contains an encoded clue",
    hints: {
      verbose:
        "Go to ~/vault: `cd ~/vault`. Decode: `base64 -d sudo_clue.b64`. Remember the result — it is the sudo password.",
      brief: "Use `base64 -d` on the .b64 file inside ~/vault.",
    },
    gate: (s) => !s.knowsSudoPassword,
  },
  {
    label: "5-sudo",
    description:
      "Stage 5 — SUDO: `sudo edit /etc/privilege.cfg` and flip allow_admin to true",
    partial: "Stage 5 — SUDO: a system config file needs privileged access to edit",
    hints: {
      verbose:
        "Run `sudo edit /etc/privilege.cfg`. Enter the decoded password. Change `allow_admin=false` to `allow_admin=true`. Save.",
      brief: "sudo edit /etc/privilege.cfg — flip the allow_admin flag.",
    },
    gate: (s) => !s.adminUnlocked,
  },
  {
    label: "6-root",
    description:
      "Stage 6 — ROOT: `sudo cd /root`, `unzip final_egg.zip`, then `cat final_egg.txt`",
    partial: "Stage 6 — ROOT: the final egg is packed in /root",
    hints: {
      verbose:
        "Run `sudo cd /root`. Then `unzip final_egg.zip` to extract the file. Finally `cat final_egg.txt`.",
      brief: "Get into /root with sudo, unzip the archive, then cat the result.",
    },
    gate: (s) => !s.finalEggFound,
  },
];

function activeStage(s: GameState): StageDef | null {
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

// Returns a hint string for the current stage, one level easier than the
// player's difficulty, or null if hints are forbidden (impossible) or not
// needed (all done).
export function stageHint(s: GameState): string | null {
  const d = s.difficulty;
  if (d === "impossible") return null;
  const st = activeStage(s);
  if (!st) return null;
  // hard → show medium-level (brief) hint; easy/medium → show verbose hint
  return d === "hard" ? st.hints.brief : st.hints.verbose;
}
