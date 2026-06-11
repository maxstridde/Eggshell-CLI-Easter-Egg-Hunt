import { useEffect, useRef, useState } from "react";
import { buildFilesystem, FsNode, GameState, initialState } from "./game/fs";
import { commands, isClear } from "./game/commands";
import { stageLabel } from "./game/stage";

interface Line {
  text: string;
  cls?: string;
  prompt?: string; // if set, this line is an echo of a user-entered command
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // initial banner
  useEffect(() => {
    const banner: Line[] = [
      { text: "EggshellOS 1.0 — terminal session started", cls: "text-emerald-300" },
      { text: "type `help` to see commands, or `start` to begin.", cls: "text-stone-400" },
      { text: "" },
    ];
    setLines(banner);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, editor, inlinePrompt]);

  const print = (text: string, cls?: string) => {
    setLines((prev) => [...prev, { text, cls }]);
  };

  const prompt = () => {
    const user = "player";
    const host = "eggshell";
    const where = cwd === "/home/player" ? "~" : cwd;
    const sym = sudoActive ? "#" : "$";
    return `${user}@${host}:${where}${sym}`;
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
    // echo the prompt + command
    setLines((prev) => [...prev, { text: "", prompt: `${prompt()} ${trimmed}` }]);

    const [cmd, ...args] = trimmed.split(/\s+/);
    const handler = commands[cmd];
    if (!handler) {
      print(`${cmd}: command not found  (try \`help\`)`, "text-red-400");
      return;
    }
    handler(args, {
      root,
      state,
      cwd,
      setCwd,
      setState: (updater) => setState((s) => updater(s)),
      print,
      openEditor: (path, initial, onSave) =>
        setEditor({ path, initial, onSave }),
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

  // Focus input when editor/inlinePrompt close
  useEffect(() => {
    if (!editor && !inlinePrompt) inputRef.current?.focus();
  }, [editor, inlinePrompt]);

  const totalEggs = 5;
  const found = state.eggsFound.length;

  return (
    <div className="min-h-screen w-full bg-black text-emerald-200 font-mono text-[15px] leading-6 flex flex-col">
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

      {/* terminal body */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 overflow-y-auto px-4 py-3 cursor-text"
      >
        {lines.map((ln, i) => (
          <div key={i} className="whitespace-pre-wrap break-words select-text">
            {ln.prompt ? (
              <span className={ln.cls ?? ""}>{ln.prompt}</span>
            ) : (
              <span className={ln.cls ?? "text-emerald-200"}>{ln.text}</span>
            )}
          </div>
        ))}

        {/* inline password prompt */}
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
          />
        )}

        {/* live prompt */}
        {!editor && !inlinePrompt && !showIntro && (
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <span className="text-emerald-300 shrink-0">{prompt()}</span>
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent outline-none text-emerald-100 caret-emerald-300"
            />
          </form>
        )}
      </div>

      {/* Intro overlay */}
      {showIntro && (
        <IntroModal onClose={() => setShowIntro(false)} />
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


function IntroModal({ onClose }: { onClose: () => void }) {
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
            Start by typing <code className="text-emerald-300">help</code> and then
            <code className="text-emerald-300"> cat README.txt</code>. Good luck.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
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
  useEffect(() => taRef.current?.focus(), []);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="w-full max-w-3xl border border-stone-700 bg-stone-950 text-emerald-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-900">
          <div className="text-sm text-stone-300">
            edit — {path}
          </div>
          <div className="text-xs text-stone-500">
            Ctrl+S to save · Esc to cancel
          </div>
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

function InlinePasswordForm({
  label,
  onSubmit,
  onCancel,
}: {
  label: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
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
      <span className="text-emerald-300 shrink-0">{label}</span>
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
        className="flex-1 bg-transparent outline-none text-emerald-100 caret-emerald-300"
      />
    </form>
  );
}
