// Save / load: serialize GameState to a UTF-8-safe base64 string and back.
// Shared by the `save`/`load` commands and App.tsx autosave.

import { Difficulty, GameState, TerminalUser, initialState } from "../types";

export const SAVE_KEY = "eggshell-autosave"; // the single save of earlier builds, migrated into SAVES_KEY
export const SAVES_KEY = "eggshell-saves"; // { [slot]: save string }, one slot per started game
const MAX_SAVES = 10; // ponytail: ~2 KB each, the oldest drops off beyond this
export const SAVE_VERSION = 2; // v2: 7 eggs = 7 stages, v1 saves are not compatible

function encodeBase64(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(str: string): unknown {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function serializeState(s: GameState) {
  return {
    v: SAVE_VERSION,
    eggsFound: s.eggsFound,
    wifiConnected: s.wifiConnected,
    wifiSSID: s.wifiSSID,
    createdMagicDir: s.createdMagicDir,
    createdTokenFile: s.createdTokenFile,
    secretsUnlocked: s.secretsUnlocked,
    knowsSudoPassword: s.knowsSudoPassword,
    adminUnlocked: s.adminUnlocked,
    rootEntered: s.rootEntered,
    edits: s.edits,
    userCreated: s.userCreated,
    sudoTries: s.sudoTries,
    difficulty: s.difficulty,
    terminalUser: s.terminalUser,
    visited: s.visited,
    mapVisible: s.mapVisible,
    stats: s.stats,
    helpSeen: s.helpSeen,
    started: s.started,
    playerName: s.playerName,
    slot: s.slot,
    savedAt: Date.now(),
  };
}

function deserializeState(data: Record<string, unknown>): GameState {
  return {
    ...initialState,
    eggsFound: (data.eggsFound as string[]) ?? [],
    wifiConnected: (data.wifiConnected as boolean) ?? false,
    wifiSSID: (data.wifiSSID as string) ?? "",
    createdMagicDir: (data.createdMagicDir as boolean) ?? false,
    createdTokenFile: (data.createdTokenFile as boolean) ?? false,
    secretsUnlocked: (data.secretsUnlocked as boolean) ?? false,
    knowsSudoPassword: (data.knowsSudoPassword as boolean) ?? false,
    adminUnlocked: (data.adminUnlocked as boolean) ?? false,
    rootEntered: (data.rootEntered as boolean) ?? false,
    edits: (data.edits as Record<string, string>) ?? {},
    userCreated: (data.userCreated as GameState["userCreated"]) ?? initialState.userCreated,
    sudoTries: (data.sudoTries as number) ?? 0,
    // ponytail: pad to 7 per-egg entries, saves from earlier builds may hold fewer
    stats: initialState.stats.map((e, i) => ({ ...e, ...(data.stats as GameState["stats"] | undefined)?.[i] })),
    helpSeen: (data.helpSeen as number) ?? 0,
    started: (data.started as boolean) ?? true, // saves from before the start gate were started
    playerName: (data.playerName as string) ?? "",
    slot: (data.slot as number) ?? ((data.savedAt as number) || Date.now()),
    difficulty: (data.difficulty as Difficulty) ?? "easy",
    terminalUser: (data.terminalUser as TerminalUser) ?? "player",
    visited: (data.visited as string[]) ?? ["/home/player"],
    mapVisible: (data.mapVisible as boolean) ?? false,
  };
}

// Serialize state to a save string for the user to copy.
export function exportSave(state: GameState): string {
  return encodeBase64(serializeState(state));
}

// Decode/validate a save string. Returns GameState on success, else an error message.
export function importSave(str: string): GameState | string {
  try {
    const data = decodeBase64(str.trim()) as Record<string, unknown>;
    if (data.v !== SAVE_VERSION) return `Incompatible save version (v${data.v})`;
    return deserializeState(data);
  } catch {
    return "Invalid save string";
  }
}

export interface SaveInfo { slot: number; name: string; eggs: number; savedAt: number }

// All save slots from localStorage ({} if unavailable). Folds the single
// autosave of earlier builds in once.
function readSaves(): Record<string, string> {
  try {
    const saves = JSON.parse(localStorage.getItem(SAVES_KEY) ?? "{}") as Record<string, string>;
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy) {
      const st = importSave(legacy);
      if (typeof st !== "string") saves[st.slot] = legacy;
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
      localStorage.removeItem(SAVE_KEY);
    }
    return saves;
  } catch {
    return {};
  }
}

// What the menu lists: whose game, how far, when — newest first.
export function listSaves(): SaveInfo[] {
  return Object.entries(readSaves())
    .map(([slot, raw]) => {
      try {
        const d = decodeBase64(raw) as Record<string, unknown>;
        if (d.v !== SAVE_VERSION) return null;
        return { slot: Number(slot), name: (d.playerName as string) ?? "", eggs: (d.eggsFound as string[])?.length ?? 0, savedAt: (d.savedAt as number) ?? 0 };
      } catch {
        return null;
      }
    })
    .filter((x): x is SaveInfo => x !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function loadSave(slot: number): GameState | null {
  const raw = readSaves()[slot];
  const st = raw ? importSave(raw) : null;
  return st && typeof st !== "string" ? st : null;
}

export function deleteSave(slot: number): void {
  const saves = readSaves();
  delete saves[slot];
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch {
    /* storage may be unavailable */
  }
}

// Write the game into its own slot (silent on failure), keeping the newest MAX_SAVES.
export function writeAutosave(state: GameState): void {
  try {
    const saves: Record<string, string> = { ...readSaves(), [state.slot]: exportSave(state) };
    const keep = Object.keys(saves).sort((a, b) => Number(b) - Number(a)).slice(0, MAX_SAVES);
    localStorage.setItem(SAVES_KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, saves[k]]))));
  } catch {
    /* storage may be unavailable */
  }
}
