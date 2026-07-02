// Shared types for Eggshell — game state, filesystem nodes, difficulty.

export type Difficulty = "easy" | "medium" | "hard" | "impossible";
export type TerminalUser = "player" | "admin" | "other";

export type FsNode =
  | {
      kind: "dir";
      name: string;
      children: FsNode[];
      // If set, this directory shows as [locked] in `ls` and cannot be cd'd into.
      locked?: (state: GameState) => boolean;
      hint?: string;
    }
  | {
      kind: "file";
      name: string;
      // Content shown by `cat`. A function allows difficulty/progress-aware text.
      content: string | ((state: GameState) => string);
      // If this file is "config-like" and editable by `edit`.
      editable?: boolean;
      // Runs after an edit; returns error string or null, plus optional state patch.
      onEdit?: (newContent: string) => { error: string | null; patch?: Partial<GameState> };
    };

export interface GameState {
  wifiConnected: boolean;
  wifiSSID: string;
  createdMagicDir: boolean;
  createdTokenFile: boolean;
  secretsUnlocked: boolean; // via editing secrets.cfg
  knowsSudoPassword: boolean; // decoded from base64 clue
  adminUnlocked: boolean; // via editing /etc/privilege.cfg
  rootEntered: boolean; // set after first successful sudo cd /root
  eggsFound: string[]; // paths of discovered eggs
  finalEggFound: boolean;
  // raw file overrides from edits
  edits: Record<string, string>;
  // user-created files / dirs (relative to /home/player)
  userCreated: { type: "dir" | "file"; path: string; content?: string }[];
  sudoTries: number;
  difficulty: Difficulty;
  terminalUser: TerminalUser; // set by default_user in /etc/privilege.cfg
  visited: string[]; // directories the player has ls-ed or cd-ed into
  mapVisible: boolean; // medium/hard: whether map panel is toggled on
  hintAskedCount: Record<number, number>; // per-stage hint request counter
}

export const initialState: GameState = {
  wifiConnected: false,
  wifiSSID: "",
  createdMagicDir: false,
  createdTokenFile: false,
  secretsUnlocked: false,
  knowsSudoPassword: false,
  adminUnlocked: false,
  rootEntered: false,
  eggsFound: [],
  finalEggFound: false,
  edits: {},
  userCreated: [],
  sudoTries: 0,
  difficulty: "easy",
  terminalUser: "player",
  visited: ["/home/player"],
  mapVisible: false,
  hintAskedCount: {},
};
