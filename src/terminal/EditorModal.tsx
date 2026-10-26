import { useEffect, useRef, useState } from "react";

export function EditorModal({
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
    // Keys on the wrapper, so they work from the buttons too. Ctrl+O = nano's save.
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if ((e.key === "s" || e.key === "o") && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSave(value);
        }
      }}
    >
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
