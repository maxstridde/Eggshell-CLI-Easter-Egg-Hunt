import { TerminalUser } from "../types";

export type Theme = {
  bg: string;
  text: string;
  prompt: string;
  caret: string;
  input: string;
  filter: string;
  // Line colours swapped under this theme, so accents never blend into the text.
  remap: Record<string, string>;
};

export function getTheme(terminalUser: TerminalUser): Theme {
  switch (terminalUser) {
    case "admin":
      return {
        bg: "bg-black",
        text: "text-amber-200",
        prompt: "text-amber-300",
        caret: "caret-amber-300",
        input: "text-amber-100",
        filter: "",
        // headings/success go white, announcements sky: three distinct colours on amber
        remap: { "text-emerald-300": "text-white", "text-yellow-300": "text-sky-300" },
      };
    case "other":
      return {
        bg: "bg-zinc-950",
        text: "text-zinc-300",
        prompt: "text-zinc-400",
        caret: "caret-zinc-300",
        input: "text-zinc-200",
        filter: "grayscale",
        remap: {},
      };
    default:
      return {
        bg: "bg-black",
        text: "text-emerald-200",
        prompt: "text-emerald-300",
        caret: "caret-emerald-300",
        input: "text-emerald-100",
        filter: "",
        remap: {},
      };
  }
}
