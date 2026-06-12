import { useEffect, useRef, useState } from "react";
import { Difficulty, FsNode, GameState, TerminalUser, buildFilesystem, findNode, initialState } from "./game/fs";
import { commands, isClear } from "./game/commands";
import { stageLabel } from "./game/stage";

const SAVE_KEY = "eggshell-autosave";
const SAVE_VERSION = 1;

interface Line {
  text: string;
  cls?: string;
  prompt?: string;
}

interface EditorState {
  path: string;
  initial: string;
  onSave: (c: string) => void;
}

interface InlinePromptState {
  label: string;
  onSubmit: (pwd: string) => void;
  onCancel?: () => void;
}

// --- Theme ---------------------------------------------------------------

type Theme = {
  bg: string;
  text: string;
  prompt: string;
  caret: string;
  input: string;
  filter: string;
};

function getTheme(terminalUser: TerminalUser): Theme {
  switch (terminalUser) {
    case "admin":
      return {
        bg: "bg-black",
        text: "text-cyan-200",
        prompt: "text-cyan-300",
        caret: "caret-cyan-300",
        input: "text-cyan-100",
        filter: "",
      };
    case "other":
      return {
        bg: "bg-zinc-950",
        text: "text-zinc-300",
        prompt: "text-zinc-400",
        caret: "caret-zinc-300",
        input: "text-zinc-200",
        filter: "grayscale",
      };
    default:
      return {
        bg: "bg-black",
        text: "text-emerald-200",
        prompt: "text-emerald-300",
        caret: "caret-emerald-300",
        input: "text-emerald-100",
        filter: "",
      };
  }
}

// --- Save / load helpers -------------------------------------------------

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
    finalEggFound: s.finalEggFound,
    edits: s.edits,
    userCreated: s.userCreated,
    sudoTries: s.sudoTries,
    difficulty: s.difficulty,
    terminalUser: s.terminalUser,
    visited: s.visited,
    mapVisible: s.mapVisible,
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
    finalEggFound: (data.finalEggFound as boolean) ?? false,
    edits: (data.edits as Record<string, string>) ?? {},
    userCreated: (data.userCreated as GameState["userCreated"]) ?? [],
    sudoTries: (data.sudoTries as number) ?? 0,
    difficulty: (data.difficulty as Difficulty) ?? "easy",
    terminalUser: (data.terminalUser as TerminalUser) ?? "player",
    visited: (data.visited as string[]) ?? ["/home/player"],
    mapVisible: (data.mapVisible as boolean) ?? false,
  };
}

function loadAutosave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(atob(raw));
    if (data.v !== SAVE_VERSION) return null;
    return deserializeState(data);
  } catch {
    return null;
  }
}

function tryDeserializeSaveString(str: string): GameState | string {
  try {
    const data = JSON.parse(atob(str.trim()));
    if (data.v !== SAVE_VERSION) return `Incompatible save version (v${data.v})`;
    return deserializeState(data);
  } catch {
    return "Invalid save string";
  }
}

// --- App -----------------------------------------------------------------

export default function App() {
  const [root] = useState<FsNode>(() => buildFilesystem());
  const [state, setState] = useState<GameState>(initialState);
  const [cwd, setCwd] = useState<string>("/home/player");
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [inlinePrompt, setInlinePrompt] = useState<InlinePromptState | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [sudoActive, setSudoActive] = useState(false);
  const [hasSave] = useState<boolean>(() => loadAutosave() !== null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const theme = getTheme(state.terminalUser);

  // Initial banner
  useEffect(() => {
    setLines([
      { text: "EggshellOS 1.0 — terminal session started", cls: "text-emerald-300" },
      { text: "type `start` to begin.", cls: "text-stone-400" },
      { text: "" },
    ]);
  }, []);

  // Autosave on every state change after mount
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(serializeState(state))));
    } catch { /* storage may be unavailable */ }
  }, [state]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, editor, inlinePrompt]);

  const print = (text: string, cls?: string) => {
    setLines((prev) => [...prev, { text, cls }]);
  };

  const prompt = () => {
    const where = cwd === "/home/player" ? "~" : cwd;
    const sym = sudoActive ? "#" : "$";
    return `player@eggshell:${where}${sym}`;
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLines((prev) => [...prev, { text: "" }]);
      return;
    }
    if (isClear(trimmed)) {
      setLines([]);
      return;
    }
    setLines((prev) => [...prev, { text: "", prompt: `${prompt()} ${trimmed}` }]);

    const [cmd, ...args] = trimmed.split(/\s+/);
    const handler = commands[cmd];
    if (!handler) {
      print(`${cmd}: command not found`, "text-red-400");
      return;
    }
    handler(args, {
      root,
      state,
      cwd,
      setCwd,
      setState: (updater) => setState((s) => updater(s)),
      print,
      openEditor: (path, initial, onSave) => setEditor({ path, initial, onSave }),
      sudoActive,
      setSudoActive,
      passwordPrompt: (onSubmit, title, onCancel) =>
        setInlinePrompt({ label: title ?? "Password:", onSubmit, onCancel }),
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input;
    setHistory((h) => [...h, value]);
    setHistoryIdx(null);
    setInput("");
    runCommand(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === null ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInput(history[nextIdx] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === null) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(null);
        setInput("");
      } else {
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] ?? "");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  useEffect(() => {
    if (!editor && !inlinePrompt) inputRef.current?.focus();
  }, [editor, inlinePrompt]);

  const totalEggs = 5;
  const found = state.eggsFound.length;
  const showMap =
    state.difficulty === "easy" ||
    (state.difficulty !== "impossible" && state.mapVisible);

  return (
    <div className={`h-screen w-full ${theme.bg} ${theme.text} ${theme.filter} font-mono text-[15px] leading-6 flex flex-col overflow-hidden`}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800 bg-stone-950/60">
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500/80" />
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 text-stone-400">eggshell — bash</span>
        </div>
        <div className="text-stone-400 text-sm">
          🥚 eggs {found}/{totalEggs} · stage: <span className="text-yellow-300">{stageLabel(state)}</span>
        </div>
      </div>

      {/* terminal body + optional map panel */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={scrollRef}
          onClick={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus();
          }}
          className="flex-1 overflow-y-auto px-4 py-3 cursor-text"
        >
          {lines.map((ln, i) => (
            <div key={i} className="whitespace-pre-wrap break-words select-text">
              {ln.prompt ? (
                <span className={ln.cls ?? theme.prompt}>{ln.prompt}</span>
              ) : (
                <span className={ln.cls ?? theme.text}>{ln.text}</span>
              )}
            </div>
          ))}

          {inlinePrompt && (
            <InlinePasswordForm
              label={inlinePrompt.label}
              onSubmit={(pwd) => {
                inlinePrompt.onSubmit(pwd);
                setInlinePrompt(null);
              }}
              onCancel={() => {
                inlinePrompt.onCancel?.();
                setInlinePrompt(null);
              }}
              theme={theme}
            />
          )}

          {!editor && !inlinePrompt && !showIntro && (
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <span className={`${theme.prompt} shrink-0`}>{prompt()}</span>
              <input
                ref={inputRef}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                className={`flex-1 bg-transparent outline-none ${theme.input} ${theme.caret}`}
              />
            </form>
          )}
        </div>

        {showMap && (
          <MapPanel state={state} root={root} cwd={cwd} />
        )}
      </div>

      {/* Intro overlay */}
      {showIntro && (
        <IntroModal
          hasSave={hasSave}
          currentDifficulty={state.difficulty}
          onDifficultyChange={(d) => setState((s) => ({ ...s, difficulty: d }))}
          onClose={() => setShowIntro(false)}
          onRestore={() => {
            const saved = loadAutosave();
            if (saved) setState(saved);
            setShowIntro(false);
          }}
          onLoadSave={(saved) => {
            setState(saved);
            setShowIntro(false);
          }}
        />
      )}

      {/* Editor modal */}
      {editor && (
        <EditorModal
          path={editor.path}
          initial={editor.initial}
          onCancel={() => setEditor(null)}
          onSave={(c) => {
            editor.onSave(c);
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}


// --- IntroModal ----------------------------------------------------------

function IntroModal({
  hasSave,
  currentDifficulty,
  onDifficultyChange,
  onClose,
  onRestore,
  onLoadSave,
}: {
  hasSave: boolean;
  currentDifficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onClose: () => void;
  onRestore: () => void;
  onLoadSave: (state: GameState) => void;
}) {
  const [showLoadInput, setShowLoadInput] = useState(false);
  const [loadInput, setLoadInput] = useState("");
  const [loadError, setLoadError] = useState("");

  const difficultyLabels: { value: Difficulty; label: string; desc: string }[] = [
    { value: "easy", label: "Easy", desc: "full guidance" },
    { value: "medium", label: "Medium", desc: "partial hints" },
    { value: "hard", label: "Hard", desc: "stage name only" },
    { value: "impossible", label: "Impossible", desc: "total silence" },
  ];

  const mapNote: Record<Difficulty, string> = {
    easy: "Map panel always visible",
    medium: "Map panel toggleable with `map`",
    hard: "Map panel toggleable with `map`",
    impossible: "Map panel hidden",
  };

  const handleLoadConfirm = () => {
    const result = tryDeserializeSaveString(loadInput);
    if (typeof result === "string") {
      setLoadError(result);
    } else {
      onLoadSave(result);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
      <div className="max-w-2xl w-full border border-stone-700 bg-stone-950 text-emerald-200 p-6 shadow-2xl">
        <div className="text-emerald-300 text-lg mb-2"># Eggshell</div>
        <div className="text-stone-400 mb-4">
          A minimal terminal game for learning the command line.
        </div>
        <div className="space-y-3 text-sm leading-6">
          <p>
            You are a new user on <span className="text-emerald-300">eggshell.local</span>.
            The system hides <span className="text-yellow-300">5 easter eggs</span>. Your job
            is to find them all by typing commands — no mouse, no buttons, no icons.
          </p>
          <p>
            Along the way you'll learn how real systems get unlocked: connecting Wi-Fi,
            creating files &amp; folders, editing config files with a CLI text editor,
            decoding a base64 clue, and escalating privileges with <code>sudo</code>.
          </p>
          <p className="text-stone-400">
            Type <code className="text-emerald-300">start</code> to begin, or try the{" "}
            <code className="text-emerald-300">help</code> command.
          </p>
        </div>

        {/* Difficulty selector */}
        <div className="mt-5">
          <div className="text-stone-400 text-xs mb-2">DIFFICULTY</div>
          <div className="flex gap-2 flex-wrap">
            {difficultyLabels.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => onDifficultyChange(value)}
                className={`px-3 py-1 border text-sm ${
                  currentDifficulty === value
                    ? "border-emerald-500 text-emerald-300 bg-emerald-900/30"
                    : "border-stone-700 text-stone-400 hover:border-stone-500"
                }`}
              >
                {label}
                <span className="ml-1 text-xs opacity-60">({desc})</span>
              </button>
            ))}
          </div>
          <div className="mt-1 text-xs text-stone-600">
            {mapNote[currentDifficulty]}
          </div>
        </div>

        {/* Load save input (revealed on demand) */}
        {showLoadInput && (
          <div className="mt-4 border border-stone-700 p-3 bg-black/40">
            <div className="text-xs text-stone-400 mb-2">Paste save string:</div>
            <textarea
              autoFocus
              value={loadInput}
              onChange={(e) => { setLoadInput(e.target.value); setLoadError(""); }}
              rows={3}
              spellCheck={false}
              className="w-full bg-transparent text-emerald-200 font-mono text-xs outline-none resize-none border border-stone-800 p-1"
              placeholder="eyJ2IjoxLCJlZ2dzR..."
            />
            {loadError && (
              <div className="text-red-400 text-xs mt-1">{loadError}</div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleLoadConfirm}
                className="px-3 py-1 border border-emerald-600 text-emerald-300 text-sm hover:bg-emerald-600/20"
              >
                [ confirm ]
              </button>
              <button
                onClick={() => { setShowLoadInput(false); setLoadError(""); setLoadInput(""); }}
                className="px-3 py-1 border border-stone-700 text-stone-400 text-sm hover:bg-stone-800"
              >
                [ cancel ]
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {hasSave && !showLoadInput && (
              <button
                onClick={onRestore}
                className="px-4 py-2 border border-stone-600 text-stone-300 hover:bg-stone-800 text-sm"
              >
                [ restore save ]
              </button>
            )}
            {!showLoadInput && (
              <button
                onClick={() => setShowLoadInput(true)}
                className="px-4 py-2 border border-stone-700 text-stone-400 hover:bg-stone-800 text-sm"
              >
                [ load save ]
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-emerald-600 text-emerald-300 hover:bg-emerald-600/20"
          >
            [ enter shell ]
          </button>
        </div>
      </div>
    </div>
  );
}


// --- MapPanel ------------------------------------------------------------

function MapPanel({ state, root, cwd }: { state: GameState; root: FsNode; cwd: string }) {
  const homeNode = findNode(root, "/home/player");
  const homeBuiltinDirs = homeNode?.kind === "dir"
    ? homeNode.children.filter((c) => c.kind === "dir")
    : [];

  const rootDirNode = findNode(root, "/root");
  const rootLocked = rootDirNode?.kind === "dir" && rootDirNode.locked
    ? rootDirNode.locked(state)
    : false;

  const isCurrent = (path: string) => cwd === path || cwd.startsWith(path + "/");
  const isVisited = (path: string) => state.visited.includes(path);

  // Files in a dir from the FS (names without extension, max 4)
  const getFsFiles = (dirPath: string): string[] => {
    const node = findNode(root, dirPath);
    if (node?.kind !== "dir") return [];
    return node.children
      .filter((c) => c.kind === "file")
      .map((c) => c.name.replace(/\.[^.]+$/, ""))
      .slice(0, 4);
  };

  // User-created items directly inside a path
  const getUserChildren = (parentPath: string) =>
    state.userCreated.filter((u) => {
      const parent = u.path.split("/").slice(0, -1).join("/") || "/";
      return parent === parentPath;
    });

  // User-created dirs directly inside /home/player
  const userHomeDirs = state.userCreated.filter((u) => {
    const parent = u.path.split("/").slice(0, -1).join("/") || "/";
    return u.type === "dir" && parent === "/home/player";
  });

  // All /home/player subdirectories in display order
  const allHomeDirs = [
    ...homeBuiltinDirs.map((c) => ({
      name: c.name,
      path: `/home/player/${c.name}`,
      locked: c.kind === "dir" && c.locked ? c.locked(state) : false,
      isUser: false,
    })),
    ...userHomeDirs.map((u) => ({
      name: u.path.split("/").pop()!,
      path: u.path,
      locked: false,
      isUser: true,
    })),
  ];

  const renderFileList = (dirPath: string, _isUser: boolean, isLastParent: boolean) => {
    if (!isVisited(dirPath)) return null;
    const fsFiles = getFsFiles(dirPath);
    const userChildren = getUserChildren(dirPath);
    const allItems = [
      ...fsFiles.map((f) => ({ name: f, isUser: false, isDir: false })),
      ...userChildren.map((u) => ({
        name: u.path.split("/").pop()!.replace(/\.[^.]+$/, ""),
        isUser: true,
        isDir: u.type === "dir",
      })),
    ].slice(0, 5);
    if (allItems.length === 0) return null;
    const indent = isLastParent ? "    " : "│   ";
    return allItems.map((item, idx) => {
      const conn = idx === allItems.length - 1 ? "└─" : "├─";
      return (
        <div key={item.name} className={`pl-1 ${item.isUser ? "text-sky-400" : "text-stone-600"}`}>
          {indent}{conn} {item.name}{item.isDir ? "/" : ""}
        </div>
      );
    });
  };

  return (
    <div className={`w-48 shrink-0 border-l border-stone-800 bg-stone-950 px-3 py-3 text-xs font-mono overflow-y-auto relative ${state.difficulty === "easy" ? "group" : ""}`}>
      {/* Hover tooltip — easy mode only */}
      {state.difficulty === "easy" && (
        <div className="hidden group-hover:flex absolute inset-0 bg-stone-950/95 items-center justify-center z-10 p-3">
          <div className="text-stone-400 text-center leading-5">
            navigate with<br />
            <span className="text-emerald-300">ls</span> and{" "}
            <span className="text-emerald-300">cd</span>
          </div>
        </div>
      )}

      <div className="text-stone-600 mb-2">[ MAP ]</div>

      {/* /home/player */}
      <div className={isCurrent("/home/player") ? "text-emerald-300" : "text-stone-400"}>
        ~ /home/player
      </div>

      {/* Subdirs of /home/player */}
      {allHomeDirs.map((d, idx) => {
        const isLast = idx === allHomeDirs.length - 1 && !state.visited.includes("/etc");
        const active = isCurrent(d.path);
        const cls = active
          ? "text-emerald-300"
          : d.locked
          ? "text-stone-700"
          : d.isUser
          ? "text-sky-400"
          : "text-stone-400";
        const conn = isLast ? "└─" : "├─";
        return (
          <div key={d.path}>
            <div className={`pl-1 ${cls}`}>
              {conn} {d.name}/{d.locked ? " [locked]" : ""}
            </div>
            {!d.locked && renderFileList(d.path, d.isUser, isLast)}
          </div>
        );
      })}

      {/* /etc — show if visited */}
      {state.visited.includes("/etc") && (
        <>
          <div className={`mt-2 ${isCurrent("/etc") ? "text-emerald-300" : "text-stone-400"}`}>
            /etc
          </div>
          {renderFileList("/etc", false, false)}
        </>
      )}

      {/* /root */}
      <div className={`mt-2 ${isCurrent("/root") ? "text-emerald-300" : rootLocked ? "text-stone-700" : "text-stone-400"}`}>
        /root{rootLocked ? " [locked]" : ""}
      </div>
      {!rootLocked && renderFileList("/root", false, true)}
    </div>
  );
}


// --- EditorModal ---------------------------------------------------------

function EditorModal({
  path,
  initial,
  onCancel,
  onSave,
}: {
  path: string;
  initial: string;
  onCancel: () => void;
  onSave: (c: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isMac =
    typeof navigator !== "undefined" &&
    (/mac|iphone|ipad/i.test(navigator.userAgent) ||
      navigator.platform?.toLowerCase().includes("mac"));
  const saveShortcut = isMac ? "Cmd+S" : "Ctrl+S";

  useEffect(() => taRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="w-full max-w-3xl border border-stone-700 bg-stone-950 text-emerald-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-900">
          <div className="text-sm text-stone-300">edit — {path}</div>
          <div className="text-xs text-stone-500">{saveShortcut} to save · Esc to cancel</div>
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSave(value);
            }
          }}
          className="bg-black text-emerald-200 p-3 font-mono text-[14px] leading-6 outline-none resize-y min-h-[320px] caret-emerald-300"
        />
        <div className="flex justify-end gap-2 px-3 py-2 border-t border-stone-800 bg-stone-900">
          <button
            onClick={onCancel}
            className="px-3 py-1 border border-stone-700 text-stone-300 hover:bg-stone-800"
          >
            cancel
          </button>
          <button
            onClick={() => onSave(value)}
            className="px-3 py-1 border border-emerald-600 text-emerald-300 hover:bg-emerald-600/20"
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}


// --- InlinePasswordForm --------------------------------------------------

function InlinePasswordForm({
  label,
  onSubmit,
  onCancel,
  theme,
}: {
  label: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  theme: Theme;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="flex items-center gap-2"
    >
      <span className={`${theme.prompt} shrink-0`}>{label}</span>
      <input
        ref={ref}
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        spellCheck={false}
        autoComplete="off"
        className={`flex-1 bg-transparent outline-none ${theme.input} ${theme.caret}`}
      />
    </form>
  );
}
