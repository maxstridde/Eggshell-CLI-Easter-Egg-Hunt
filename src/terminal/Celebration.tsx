import { useEffect, useRef, useState } from "react";

// The one animation in the game (win only): a donut.c-style spinning egg,
// then the chick. Monospace, monochrome; any key skips.
const W = 48;
const H = 22;
const SHADES = ".,-~:;=!*#$@";
const SPIN_MS = 3200;
const CHICK_MS = 1600;

const CHICK = [
  "",
  "",
  "",
  "         \\\\",
  "         (o>",
  "      \\\\_//)",
  "       \\_/_)",
  "        _|_",
  "",
  "    7 of 7. You've hatched.",
];

// One frame: an egg (ellipsoid, narrower on top) rotated by a around the
// vertical axis and tilted by b, lit from the upper left, z-buffered.
function eggFrame(a: number, b: number): string {
  const out = Array<string>(W * H).fill(" ");
  const zbuf = Array<number>(W * H).fill(-Infinity);
  const [ca, sa, cb, sb] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];
  for (let phi = 0; phi < Math.PI; phi += 0.04) {
    const r = Math.sin(phi) * (1 - 0.18 * Math.cos(phi)); // egg: top narrower
    const y0 = 1.3 * Math.cos(phi);
    for (let th = 0; th < 2 * Math.PI; th += 0.03) {
      const x0 = r * Math.cos(th);
      const z0 = r * Math.sin(th);
      // ponytail: sphere-like normal; exact egg normals wouldn't show at this resolution
      const nx0 = Math.sin(phi) * Math.cos(th), ny0 = Math.cos(phi), nz0 = Math.sin(phi) * Math.sin(th);
      // rotate around y (spin), then around x (tilt)
      const x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca;
      const y = y0 * cb - z1 * sb, z = y0 * sb + z1 * cb;
      const nx1 = nx0 * ca + nz0 * sa, nz1 = -nx0 * sa + nz0 * ca;
      const ny = ny0 * cb - nz1 * sb, nz = ny0 * sb + nz1 * cb;
      const lum = (-nx1 + ny - nz) / Math.sqrt(3); // light from upper left, front
      const ooz = 1 / (z + 4);
      const col = Math.round(W / 2 + 40 * ooz * x1);
      const row = Math.round(H / 2 - 20 * ooz * y);
      if (col < 0 || col >= W || row < 0 || row >= H) continue;
      const i = row * W + col;
      if (ooz > zbuf[i]) {
        zbuf[i] = ooz;
        out[i] = SHADES[Math.max(0, Math.min(SHADES.length - 1, Math.floor(lum * (SHADES.length - 1))))];
      }
    }
  }
  const lines: string[] = [];
  for (let r = 0; r < H; r++) lines.push(out.slice(r * W, r * W + W).join("").trimEnd());
  return lines.join("\n");
}

export function Celebration({ onDone, cls }: { onDone: () => void; cls: string }) {
  const [t, setT] = useState(0);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const el = performance.now() - start;
      if (el > SPIN_MS + CHICK_MS) finish();
      else setT(el);
    }, 40);
    const skip = (e: KeyboardEvent) => {
      e.preventDefault();
      finish();
    };
    window.addEventListener("keydown", skip);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  const frame = t < SPIN_MS ? eggFrame(t / 300, 0.35 * Math.sin(t / 700)) : CHICK.join("\n");
  return (
    <div className={`whitespace-pre leading-tight ${cls}`}>
      {frame}
      {"\n"}
      <span className="text-stone-400">(any key to skip)</span>
    </div>
  );
}
