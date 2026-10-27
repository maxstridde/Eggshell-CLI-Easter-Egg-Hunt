import React, { useEffect, useRef, useState } from "react";
import { FsNode, GameState, initialState } from "./types";
import { EGGS, buildFilesystem, lastLogin } from "./game/fs";
import { GAME_COMMANDS, candidates, commands, completeInput, isClear } from "./game/commands";
import { STAGES, activeStageIndex, countCommand, doorOpen, parLine, statsLines, tickHint, totalCommands } from "./game/stage";
import { deleteSave, listSaves, loadSave, writeAutosave } from "./game/save";
import { getTheme } from "./terminal/theme";
import { EditorModal } from "./terminal/EditorModal";
import { InlinePasswordForm } from "./terminal/InlinePasswordForm";
import { MapPanel } from "./terminal/MapPanel";
import { IntroModal } from "./terminal/IntroModal";
import { CHICK, Celebration } from "./terminal/Celebration";

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
  visible?: boolean;
}

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
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [, setSavesVersion] = useState(0); // re-render the menu's save list after a delete

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstRender = useRef(true);
  const failStreak = useRef(0); // consecutive commands that printed an error
  const lastKeyTab = useRef(false);

  const theme = getTheme(state.terminalUser);

  // Initial banner
  useEffect(() => {
    setLines([
      { text: "EggshellOS 1.0 — eggshell.local", cls: "text-emerald-300" },
      { text: `Last login: ${lastLogin()} by hen. Account handed over to: player.`, cls: "text-stone-400" },
      { text: "type `start` to begin.", cls: "text-stone-400" },
      { text: "" },
    ]);
  }, []);

  // Autosave (localStorage["eggshell-autosave"], format = exportSave) on every
  // state change after mount — but never while the intro overlay is open:
  // pre-restore changes there (e.g. picking a difficulty) would overwrite the
  // game's save with a fresh state before its [ restore ] is clicked.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Nor before the first egg: a game earns its save slot there, so idle tries don't fill the list.
    if (showIntro || state.eggsFound.length === 0) return;
    writeAutosave(state);
  }, [state, showIntro]);

  // Door announcements: within the same stage, a way to the egg just opened.
  // A stage change (egg read, load) only re-baselines, so nothing replays.
  const door = useRef({ idx: activeStageIndex(state), open: false });
  useEffect(() => {
    const idx = activeStageIndex(state);
    const open = doorOpen(idx, state);
    const announce = STAGES[idx]?.announce;
    if (idx === door.current.idx && open && !door.current.open && announce) print(announce, "text-yellow-300");
    door.current = { idx, open };
  }, [state]);

  // The win: armed by reading the last egg, shown once the stats include that command.
  const winPending = useRef(false);
  useEffect(() => {
    if (!winPending.current || activeStageIndex(state) >= 0) return;
    winPending.current = false;
    setCelebrating(true);
  }, [state]);
  const endCelebration = () => {
    setCelebrating(false);
    // the chick stays; the table sits right under it
    CHICK.slice(2).forEach((l) => print(l, "text-yellow-300"));
    print("");
    print(`${state.playerName ? `${state.playerName}'s hunt` : "Your hunt"} vs. Hen's way`, "text-emerald-300");
    print(parLine(totalCommands(state)), "text-yellow-300");
    statsLines(state).forEach((l, i) => print(l, i === 1 ? "text-emerald-300" : undefined));
  };

  // Grayscale (default_user set to anything unknown): say how to undo it.
  const prevUser = useRef(state.terminalUser);
  useEffect(() => {
    if (state.terminalUser === "other" && prevUser.current !== "other")
      print("The colours are gone. Set default_user back to player in /etc/privilege.cfg to bring them back.", "text-stone-400");
    prevUser.current = state.terminalUser;
  }, [state.terminalUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, editor, inlinePrompt, celebrating]);

  const print = (text: string, cls?: string) => {
    setLines((prev) => [...prev, { text, cls }]);
  };

  const prompt = () => {
    const where = cwd === "/home/player" ? "~" : cwd;
    const sym = sudoActive ? "#" : "$";
    return `player@eggshell:${where}${sym}`;
  };

  const restored = (s: GameState) => {
    const done = activeStageIndex(s) < 0;
    print(`Save restored${s.playerName ? ` — welcome back, ${s.playerName}` : ""}. 🥚 ${s.eggsFound.length}/${EGGS.length}`, "text-emerald-300");
    print(done ? "All eggs found. `eggs` shows your scorecard." : "`eggs` shows where you left off.", "text-stone-400");
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLines((prev) => [...prev, { text: "", prompt: prompt() }]);
      return;
    }
    if (isClear(trimmed)) {
      setLines([]);
      return;
    }
    setLines((prev) => [...prev, { text: "", prompt: `${prompt()} ${trimmed}` }]);

    const [cmd, ...args] = trimmed.split(/\s+/);
    // Nothing runs before `start` (which asks the name), except getting back to a saved game.
    if (!state.started && !["start", "load", "menu", "quit", "exit"].includes(cmd)) {
      print("type `start` first — it begins the game.", "text-red-400");
      return;
    }
    if (!GAME_COMMANDS.has(cmd)) setState((s) => countCommand(s));
    if (cmd !== "hint") setState(tickHint);

    // Auto-nudge (easy/medium): after 3 failing commands in a row, point at `hint`.
    let failed = false;
    const report = (text: string, cls?: string) => {
      if (cls === "text-red-400") failed = true;
      print(text, cls);
    };
    const handler = commands[cmd];
    if (!handler) report(`${cmd}: command not found`, "text-red-400");
    else handler(args, {
      root,
      state,
      cwd,
      setCwd,
      setState: (updater) => setState((s) => updater(s)),
      print: report,
      openEditor: (path, initial, onSave) => setEditor({ path, initial, onSave }),
      openMenu: () => setShowIntro(true),
      celebrate: () => (winPending.current = true),
      sudoActive,
      setSudoActive,
      passwordPrompt: (onSubmit, title, onCancel, visible) =>
        setInlinePrompt({ label: title ?? "Password:", onSubmit, onCancel, visible }),
    });
    failStreak.current = failed && cmd !== "hint" ? failStreak.current + 1 : 0;
    if (failStreak.current >= 3 && (state.difficulty === "easy" || state.difficulty === "medium")) {
      print("stuck? try `hint`", "text-stone-400");
      failStreak.current = 0;
    }
  };

  const onSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const value = input;
    setHistory((h) => [...h, value]);
    setHistoryIdx(null);
    setInput("");
    runCommand(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(e);
    } else if (e.key === "ArrowUp") {
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
    } else if (e.key === "Tab" || (e.key === "ArrowRight" && ghost && e.currentTarget.selectionStart === input.length)) {
      e.preventDefault();
      const completed = completeInput(input, root, state, cwd);
      if (completed !== null) setInput(completed);
      // Second Tab with nothing left to complete lists the options (bash style).
      else if (e.key === "Tab" && lastKeyTab.current) {
        const list = candidates(input, root, state, cwd);
        if (list.length > 1) {
          setLines((prev) => [...prev, { text: "", prompt: `${prompt()} ${input}` }, { text: list.join("  "), cls: "text-stone-400" }]);
        }
      }
    }
    lastKeyTab.current = e.key === "Tab";
  };

  // Grey suggestion after the cursor: what Tab would add.
  const completedLine = input.trim() ? completeInput(input, root, state, cwd) : null;
  const ghost = completedLine?.startsWith(input) ? completedLine.slice(input.length) : "";

  // The input grows with its wrapped lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, showIntro, editor, inlinePrompt]);

  useEffect(() => {
    if (!editor && !inlinePrompt && !celebrating) inputRef.current?.focus();
  }, [editor, inlinePrompt, celebrating]);

  useEffect(() => {
    if (!mobileMapOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMapOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileMapOpen]);

  const totalEggs = EGGS.length;
  const found = state.eggsFound.length;
  const showMap =
    state.difficulty === "easy" ||
    (state.difficulty !== "impossible" && state.mapVisible);

  return (
    <div className={`h-screen w-full ${theme.bg} ${theme.text} ${theme.filter} font-mono text-[13px] sm:text-[15px] leading-[1.4] sm:leading-6 flex flex-col overflow-hidden`}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800 bg-stone-950/60">
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500/80" />
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 text-stone-400 hidden sm:inline">eggshell — bash</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          {state.difficulty !== "impossible" && (
            <button
              onClick={() => setMobileMapOpen((v) => !v)}
              className="sm:hidden px-2 py-0.5 border border-stone-700 text-xs hover:border-stone-500"
            >
              [map]
            </button>
          )}
          <span>🥚 {found}/{totalEggs}</span>
          {state.difficulty !== "impossible" && activeStageIndex(state) >= 0 && (
            <span className="hidden sm:inline">· next: <span className={theme.remap["text-yellow-300"] ?? "text-yellow-300"}>{STAGES[activeStageIndex(state)].name}</span></span>
          )}
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
                <span className={(ln.cls && theme.remap[ln.cls]) ?? ln.cls ?? theme.text}>{ln.text || " " /* empty lines keep their height */}</span>
              )}
            </div>
          ))}

          {inlinePrompt && (
            <InlinePasswordForm
              label={inlinePrompt.label}
              visible={inlinePrompt.visible}
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

          {celebrating && <Celebration onDone={endCelebration} cls={theme.remap["text-yellow-300"] ?? "text-yellow-300"} />}

          {!editor && !inlinePrompt && !showIntro && !celebrating && (
            <form onSubmit={onSubmit} className="flex items-start gap-2">
              <span className={`${theme.prompt} shrink-0`}>
                <span className="sm:hidden">{cwd === "/home/player" ? "~" : cwd}{sudoActive ? "#" : "$"}</span>
                <span className="hidden sm:inline">{prompt()}</span>
              </span>
              <div className="relative flex-1">
                {/* ghost text: invisible copy of the input, then the suggestion */}
                {/* a textarea, so long lines (a save string) wrap instead of scrolling away */}
                <div aria-hidden className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-all overflow-hidden">
                  <span className="invisible">{input}</span>
                  <span className="text-stone-500">{ghost}</span>
                </div>
                <textarea
                  ref={inputRef}
                  autoFocus
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/\n/g, " "))}
                  onKeyDown={onKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                  className={`relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-all bg-transparent outline-none ${theme.input} ${theme.caret}`}
                />
              </div>
            </form>
          )}
        </div>

        {showMap && (
          <div className="hidden sm:block">
            <MapPanel state={state} root={root} cwd={cwd} />
          </div>
        )}
      </div>

      {/* Intro / main-menu overlay (also reachable in-game via `menu` / `quit`) */}
      {showIntro && (
        <IntroModal
          saves={showIntro ? listSaves() : []}
          onDelete={(slot) => { deleteSave(slot); setSavesVersion((v) => v + 1); }}
          currentDifficulty={state.difficulty}
          onDifficultyChange={(d) => setState((s) => ({ ...s, difficulty: d, hint: initialState.hint }))}
          onClose={() => setShowIntro(false)}
          onRestore={(slot) => {
            const saved = loadSave(slot);
            if (saved) {
              setState(saved);
              setCwd("/home/player");
              restored(saved);
            }
            setShowIntro(false);
          }}
          onLoadSave={(saved) => {
            setState(saved);
            setCwd("/home/player");
            restored(saved);
            setShowIntro(false);
          }}
        />
      )}

      {/* Mobile map overlay */}
      {mobileMapOpen && state.difficulty !== "impossible" && (
        <div className="fixed inset-0 bg-black/90 z-30 sm:hidden flex flex-col font-mono">
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-950">
            <span className="text-stone-400 text-xs">[ MAP ]</span>
            <button
              onClick={() => setMobileMapOpen(false)}
              className="text-stone-400 text-xs px-2 py-1 border border-stone-700 hover:bg-stone-800"
            >
              [ close ]
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MapPanel state={state} root={root} cwd={cwd} mobile />
          </div>
        </div>
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
