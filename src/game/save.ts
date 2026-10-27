// Save / load: serialize GameState to a UTF-8-safe base64 string and back.
// Shared by the `save`/`load` commands and App.tsx autosave.

import { Difficulty, GameState, TerminalUser, initialState } from "../types";

export const SAVE_KEY = "eggshell-autosave";
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
    commands: s.commands,
    helpSeen: s.helpSeen,
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
    commands: (data.commands as number) ?? 0,
    helpSeen: (data.helpSeen as number) ?? 0,
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

// Read the autosave from localStorage (null if absent/invalid/unavailable).
export function loadAutosave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const result = importSave(raw);
    return typeof result === "string" ? null : result;
  } catch {
    return null;
  }
}

// Write the autosave to localStorage (silent on failure).
export function writeAutosave(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, exportSave(state));
  } catch {
    /* storage may be unavailable */
  }
}
