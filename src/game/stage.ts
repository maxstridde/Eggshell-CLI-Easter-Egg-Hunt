import { GameState } from "./fs";

export function stageOf(s: GameState): string {
  if (!s.wifiConnected) return "Stage 1 — OFFLINE: connect to Wi-Fi";
  if (!s.createdMagicDir || !s.createdTokenFile)
    return "Stage 2 — go home (`cd /home/player`), then `mkdir magic`, `cd magic`, `touch token.txt`";
  if (!s.secretsUnlocked) return "Stage 3 — edit ~/secrets/secrets.cfg";
  if (!s.knowsSudoPassword) return "Stage 4 — decode the base64 sudo clue";
  if (!s.adminUnlocked) return "Stage 5 — sudo edit /etc/privilege.cfg";
  if (!s.finalEggFound) return "Stage 6 — reach /root and find the final egg";
  return "🏆 COMPLETE — all eggs collected!";
}

export function stageLabel(s: GameState): string {
  if (!s.wifiConnected) return "1-online";
  if (!s.createdMagicDir || !s.createdTokenFile) return "2-magic";
  if (!s.secretsUnlocked) return "3-secrets.cfg";
  if (!s.knowsSudoPassword) return "4-base64";
  if (!s.adminUnlocked) return "5-sudo";
  if (!s.finalEggFound) return "6-root";
  return "done";
}
