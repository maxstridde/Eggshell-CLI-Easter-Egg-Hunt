import React from "react";
import { GameState, FsNode } from "../types";
import { EGGS, findNode } from "../game/fs";

export function MapPanel({ state, root, cwd, mobile }: { state: GameState; root: FsNode; cwd: string; mobile?: boolean }) {
  const homeNode = findNode(root, "/home/player");
  const homeBuiltinDirs = homeNode?.kind === "dir"
    ? homeNode.children.filter((c) => c.kind === "dir")
    : [];

  const rootDirNode = findNode(root, "/root");
  const rootLocked = rootDirNode?.kind === "dir" && rootDirNode.locked
    ? rootDirNode.locked(state)
    : false;

  const varDirNode = findNode(root, "/var");
  const varLocked = varDirNode?.kind === "dir" && varDirNode.locked
    ? varDirNode.locked(state)
    : false;

  // Exact match only — highlights the precise cwd, not parent directories.
  const isCurrent = (path: string) => cwd === path;
  // Marker for colour-blind players: the current folder isn't only a colour.
  const here = (path: string) => (isCurrent(path) ? " ◂" : "");
  const isVisited = (path: string) => state.visited.includes(path);

  // Files and subdirs of a directory from the static FS.
  const getFsChildren = (dirPath: string): { files: string[]; dirs: string[] } => {
    const node = findNode(root, dirPath);
    if (node?.kind !== "dir") return { files: [], dirs: [] };
    return {
      files: node.children.filter((c) => c.kind === "file").map((c) => c.name),
      dirs: node.children.filter((c) => c.kind === "dir").map((c) => c.name),
    };
  };

  // User-created items directly inside a path.
  // Eggs created by an action (tidy, unzip) are Hen's, so they don't count as the player's.
  const getUserChildren = (parentPath: string) =>
    state.userCreated.filter((u) => {
      const parent = u.path.split("/").slice(0, -1).join("/") || "/";
      return parent === parentPath;
    }).map((u) => ({ ...u, mine: !EGGS.includes(u.path) }));

  // User-created dirs directly inside /home/player.
  const userHomeDirs = state.userCreated.filter((u) => {
    const parent = u.path.split("/").slice(0, -1).join("/") || "/";
    return u.type === "dir" && parent === "/home/player";
  });

  // All /home/player subdirectories in display order.
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

  // Renders files + subdirs for a visited directory.
  // baseIndent is the vertical-bar prefix carried from the parent (e.g. "│  " or "").
  // Subdirs that have been visited are expanded one level deeper (no further recursion).
  const renderDirContents = (dirPath: string, baseIndent: string) => {
    if (!isVisited(dirPath)) return null;

    const { files: fsFiles, dirs: fsDirs } = getFsChildren(dirPath);
    const userChildren = getUserChildren(dirPath);

    const allItems = [
      ...fsFiles.map((f) => ({ name: f, isUser: false, isDir: false, path: `${dirPath}/${f}` })),
      ...fsDirs.map((d) => ({ name: d, isUser: false, isDir: true, path: `${dirPath}/${d}` })),
      ...userChildren.map((u) => ({
        name: u.path.split("/").pop()!,
        isUser: u.mine,
        isDir: u.type === "dir",
        path: u.path,
      })),
    ].slice(0, 6);

    if (allItems.length === 0) return null;

    const rows: React.ReactNode[] = [];

    allItems.forEach((item, idx) => {
      const isLast = idx === allItems.length - 1;
      const conn = isLast ? "└─" : "├─";
      const cls = isCurrent(item.path) ? "text-emerald-300" : item.isUser ? "text-sky-400" : "text-stone-400";

      rows.push(
        <div key={item.path} className={`pl-1 ${cls}`}>
          {baseIndent}{conn} {item.name}{item.isDir ? "/" : ""}{here(item.path)}
        </div>
      );

      // Expand visited subdirs one level deeper.
      if (item.isDir && isVisited(item.path)) {
        const childIndent = baseIndent + (isLast ? "   " : "│  ");
        const { files: childFiles } = getFsChildren(item.path);
        const childUserItems = getUserChildren(item.path);
        const childItems = [
          ...childFiles.map((f) => ({ name: f, isUser: false })),
          ...childUserItems.map((u) => ({ name: u.path.split("/").pop()!, isUser: u.mine })),
        ].slice(0, 4);

        childItems.forEach((child, ci) => {
          const childConn = ci === childItems.length - 1 ? "└─" : "├─";
          const childCls = child.isUser ? "text-sky-400" : "text-stone-400";
          rows.push(
            <div key={`${item.path}/${child.name}`} className={`pl-1 ${childCls}`}>
              {childIndent}{childConn} {child.name}
            </div>
          );
        });
      }
    });

    return rows;
  };

  return (
    <div className={mobile
      ? "w-full bg-stone-950 px-3 py-3 text-xs font-mono whitespace-pre overflow-y-auto relative"
      : `w-56 shrink-0 border-l border-stone-800 bg-stone-950 px-3 py-3 text-xs font-mono whitespace-pre overflow-y-auto relative ${state.difficulty === "easy" ? "group" : ""}`
    }>
      {/* Hover tooltip — easy mode only, desktop only */}
      {!mobile && state.difficulty === "easy" && (
        <div className="hidden group-hover:flex absolute inset-0 bg-stone-950/95 items-center justify-center z-10 p-3">
          <div className="text-stone-400 text-center leading-5">
            navigate with<br />
            <span className="text-emerald-300">ls</span> and{" "}
            <span className="text-emerald-300">cd</span>
          </div>
        </div>
      )}

      {!mobile && <div className="text-stone-500 mb-2">[ MAP ]</div>}

      {/* /home, then player/ (~) as its one subfolder — highlighted only when cwd is exactly there */}
      <div className={isCurrent("/home") ? "text-emerald-300" : "text-stone-300"}>/home{here("/home")}</div>
      <div className={`pl-1 ${isCurrent("/home/player") ? "text-emerald-300" : "text-stone-300"}`}>
        └─ player/ (~){here("/home/player")}
      </div>

      {/* Subdirs of /home/player */}
      {allHomeDirs.map((d, idx) => {
        const isLast = idx === allHomeDirs.length - 1;
        const active = isCurrent(d.path);
        const cls = active
          ? "text-emerald-300"
          : d.locked
          ? "text-stone-500"
          : d.isUser
          ? "text-sky-400"
          : "text-stone-300";
        const conn = isLast ? "└─" : "├─";
        return (
          <div key={d.path}>
            <div className={`pl-1 ${cls}`}>
              {"   "}{conn} {d.name}/{d.locked ? " [locked]" : ""}{here(d.path)}
            </div>
            {!d.locked && renderDirContents(d.path, isLast ? "      " : "   │  ")}
          </div>
        );
      })}

      {/* /etc — show if visited; no leading indent (top-level section) */}
      {state.visited.includes("/etc") && (
        <>
          <div className={`mt-2 ${isCurrent("/etc") ? "text-emerald-300" : "text-stone-300"}`}>
            /etc{here("/etc")}
          </div>
          {renderDirContents("/etc", "")}
        </>
      )}

      {/* /root */}
      <div className={`mt-2 ${isCurrent("/root") ? "text-emerald-300" : rootLocked ? "text-stone-500" : "text-stone-400"}`}>
        /root{rootLocked ? " [locked]" : ""}{here("/root")}
      </div>
      {!rootLocked && renderDirContents("/root", "")}

      {/* /var */}
      <div className={`mt-2 ${isCurrent("/var") ? "text-emerald-300" : varLocked ? "text-stone-500" : "text-stone-400"}`}>
        /var{varLocked ? " [locked]" : ""}{here("/var")}
      </div>
      {!varLocked && renderDirContents("/var", "")}
    </div>
  );
}
