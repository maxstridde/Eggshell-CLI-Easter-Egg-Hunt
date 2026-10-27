// Full-solution smoke test: `npm run build && node scripts/playthrough.mjs`
// Serves dist/ via `vite preview`, plays the game with Playwright, asserts
// the win, the former lock bypasses, and the hint reset on sub-progress.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = spawn("npx", ["vite", "preview", "--port", "4179", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };

try {
  await page.goto("http://localhost:4179/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByText("[ enter shell ]").click();
  const input = page.locator("form textarea").last();
  const out = () => page.locator(".select-text").allInnerTexts().then((t) => t.join("\n"));
  const run = async (cmd) => { await input.fill(cmd); await input.press("Enter"); await page.waitForTimeout(40); };
  const password = async (pw) => { const f = page.locator('input[type="password"]'); await f.fill(pw); await f.press("Enter"); await page.waitForTimeout(40); };
  const last = async () => (await out()).split("\n").slice(-3).join("\n");
  const editReplace = async (from, to) => {
    const ta = page.locator("textarea");
    await ta.fill((await ta.inputValue()).replace(from, to));
    await ta.press("Control+s");
    await page.waitForTimeout(40);
  };

  // Nothing runs before start; start asks the name.
  await run("ls");
  check(/type `start` first/.test(await last()), "commands wait for start");
  await run("start");
  await page.locator('input[type="text"]').fill("Tester"); await page.locator('input[type="text"]').press("Enter"); await page.waitForTimeout(40);
  check(/Welcome to Eggshell, Tester/.test(await out()), "start asks the name");

  // Former bypasses must be denied on a fresh game.
  for (const cmd of ["cat ~/documents/egg1.txt", "ls /root", "unzip /root/egg6.zip", "edit ~/secrets/secrets.cfg", "cat /var/backups/egg7.txt", "sudo ls"]) {
    await run(cmd);
    check(/locked|denied|don't know/i.test(await last()), `denied: ${cmd}`);
  }

  // Ghost text + Tab completion.
  await input.fill("cat REA"); await page.waitForTimeout(40);
  check((await page.locator("form .text-stone-500").innerText()) === "DME.txt", "ghost text suggests README.txt");
  await input.press("Tab");
  check((await input.inputValue()) === "cat README.txt", "Tab accepts the suggestion");
  await input.fill("");

  // Easy: nudge, direction, then a confirm before the exact answer.
  await run("hint"); await run("hint"); await run("hint");
  check(/exact answer/.test(await last()), "confirm before the exact hint");
  await run("hint");
  check(/hint 3\/3: `cat \/etc\/wifi.json`/.test(await last()), "exact hint after confirming");

  await input.fill("wifi co"); await input.press("Tab");
  check((await input.inputValue()) === "wifi connect", "Tab completes wifi connect");
  await input.fill("");
  await run("wifi connect EggHunt-5G"); await password("yolk-yolk-123");
  await run("cat ~/documents/egg1.txt");
  await run("difficulty medium"); await run("hint"); await run("hint");
  const tier1 = await last();
  await run("mkdir magic"); await run("hint");
  check((await last()) !== tier1 && /riddle/i.test(await last()), "hint resets to nudge after mkdir");
  await run("difficulty easy");
  await run("touch magic/token.txt");
  check(/secrets just unlocked/.test(await last()), "door announcement after touch");
  await run("cat ~/secrets/egg2.txt");
  check(/new commands/.test(await last()), "new-commands nudge after egg 2");
  await run("help");
  check(/rm <file\.\.\.>.*← new/.test(await out()) && !/ls \[path\].*← new/.test(await out()), "help marks rm as new, ls not");
  await run("clear"); await run("help");
  check(!/← new/.test(await out()), "second help: nothing new");
  await run("cd ~/secrets"); await run("rm report.txt");
  check(/still needed/.test(await last()), "rm report.txt refused");
  await run("rm thumbs.tmp");
  check(/still over quota\.$/.test(await last()), "rm one .tmp: over quota, no hidden-file hint yet");
  await run("rm *.tmp");
  check(/plain listing/.test(await last()), "rm *.tmp warns a hidden one is left");
  await run("mv report.txt ~/documents/");
  await run("cat quota.txt");
  check(/still over quota/.test(await out()) && !/egg3/.test(await (async () => { await run("ls"); return last(); })()), "hidden .cache.tmp survives rm *.tmp");
  await run("ls -a");
  check(/\.cache\.tmp/.test(await out()), "ls -a shows the hidden file");
  await run("rm .cache.tmp");
  await run("cat egg3.txt");
  await run("edit secrets.cfg");
  check(/back/.test(await last()), "edit refused without backup");
  await run("cp secrets.cfg secrets.cfg.bak"); await run("nano secrets.cfg");
  await page.locator("textarea").first().fill(""); await page.keyboard.press("Control+s"); await page.waitForTimeout(40);
  check(/reset secrets\.cfg/.test(await last()), "wiped config points at reset");
  await run("reset secrets.cfg"); await run("cat secrets.cfg");
  check(/path_to_vault_locked = true/.test(await last()), "reset restores Hen's original");
  await run("nano secrets.cfg");
  await editReplace("path_to_vault_locked = true", "path_to_vault_locked = false");
  await run("cat ~/vault/egg4.txt");
  await run("base64 -d c2VjcmV0LWVnZw==");
  await run("sudo edit /etc/privilege.cfg"); await password("secret-egg");
  await editReplace(/allow_admin\s*=\s*false/, "allow_admin = true");
  await run("sudo cd /root"); await password("secret-egg");
  check(/the egg in ~\/admin comes first/.test(await out()), "lock names the egg that comes first");
  await run("cat ~/admin/egg5.txt");
  await run("cd /root");
  check(/denied/i.test(await last()), "cd /root without sudo denied");
  await run("sudo cd /root"); await password("secret-egg");
  await run("unzip egg6.zip"); await run("cat egg6.txt");
  await run("ls /var/backups");
  check(!/attic/.test(await last()), "plain ls hides .attic");
  await run("ls -R /var/backups");
  check(/\/var\/backups\/photos:/.test(await out()) && !/\.attic/.test(await out()), "ls -R lists subfolders, skips hidden");
  await run("grep -r egg /var/backups");
  check(/\.attic\/2019\/misc\/egg7\.txt:/.test(await last()), "grep -r egg finds egg 7 too");
  await run("clear");
  await run("grep -r egg /var/log"); await run("grep -r golden-yolk /var/backups");
  check(/\/var\/backups\/\.attic\/2019\/misc\/egg7\.txt:label: golden-yolk/.test(await out()), "grep finds the hidden egg 7");
  await run("cat /var/backups/egg7_FINAL.txt");
  check(/Not this one/.test(await last()), "decoy is not an egg");
  await run("cat /var/backups/.attic/2019/misc/egg7.txt");
  check(/any key to skip/.test(await page.content()), "win animation plays");
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  check(/made by MaxStridde\.de/.test(await out()) && /source code on GitHub/.test(await out()), "credits under the win table");
  check(/Hen's way: 23/.test(await out()) && /#7 The Investigator\s+\d+:\d\d\s+\d+\s+3/.test(await out()), "stats table on the last egg");
  await run("clear"); await run("eggs");
  const bar = await page.locator("text=🥚").first().innerText();
  check(bar.includes("7/7"), `egg counter: ${bar.trim()}`);
  check(/hatched/.test(await out()) && /#7 The Investigator/.test(await out()) && /made by MaxStridde\.de/.test(await out()), "eggs shows the win, the scorecard and the credits");
  await page.reload();
  check(/Tester · 🥚 7\/7 \(finished\)/.test(await page.content()), "menu lists the finished save");
  await page.getByText("[ enter shell ]").click();
  await page.reload();
  check(/7\/7 \(finished\)/.test(await page.content()), "entering without restore keeps the save");
  if (failures) console.log("\n--- last output ---\n" + (await out()).split("\n").slice(-25).join("\n"));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failures ? 1 : 0);
