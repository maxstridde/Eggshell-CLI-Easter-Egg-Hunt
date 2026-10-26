import { useState } from "react";
import { Difficulty, GameState } from "../types";
import { importSave } from "../game/save";
import { retireDate } from "../game/fs";

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
    { value: "easy", label: "Easy", desc: "hints go all the way" },
    { value: "medium", label: "Medium", desc: "hints stop before the answer" },
    { value: "hard", label: "Hard", desc: "one nudge per egg" },
    { value: "impossible", label: "Impossible", desc: "no hints, no map" },
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
            Hen, the admin of <span className="text-emerald-300">eggshell.local</span>, retires on
            {retireDate()}. Before leaving, Hen hid <span className="text-yellow-300">7 eggs</span> on
            the machine and handed the account to you. Each egg is behind a door only the
            command line can open — no mouse, no icons.
          </p>
          <p>
            Along the way you'll get online, build and tidy folders, edit config files,
            become an administrator and search the system logs — real skills, learned by doing.
          </p>
          <p className="text-stone-400">
            Type <code className="text-emerald-300">start</code> to begin.{" "}
            <kbd className="text-emerald-300">Tab</kbd> completes commands and file names.
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
            autoFocus
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
