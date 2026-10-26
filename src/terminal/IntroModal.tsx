import { useState } from "react";
import { Difficulty, GameState } from "../types";
import { importSave } from "../game/save";

export function IntroModal({
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
    const result = importSave(loadInput);
    if (typeof result === "string") {
      setLoadError(result);
    } else {
      onLoadSave(result);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="max-w-2xl w-full border border-stone-700 bg-stone-950 text-emerald-200 p-3 sm:p-6 shadow-2xl my-auto">
        <div className="text-emerald-300 text-lg mb-2"># Eggshell</div>
        <div className="text-stone-400 mb-4">
          A minimal terminal game for learning the command line.
        </div>
        <div className="space-y-3 text-sm leading-6">
          <p>
            You are a new user on <span className="text-emerald-300">eggshell.local</span>.
            The system hides <span className="text-yellow-300">7 easter eggs</span>. Your job
            is to find them all by typing commands — no mouse, no buttons, no icons.
          </p>
          <p>
            Along the way you'll learn how real systems get unlocked: connecting Wi-Fi,
            creating, moving &amp; copying files, editing config files with a CLI text editor,
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
