import { useEffect, useRef, useState } from "react";
import { Theme } from "./theme";

export function InlinePasswordForm({
  label,
  onSubmit,
  onCancel,
  theme,
  visible,
}: {
  visible?: boolean; // plain text (a name) instead of a hidden password
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
        type={visible ? "text" : "password"}
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
