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
  const input = page.locator("form input").last();
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

  // Former bypasses must be denied on a fresh game.
  for (const cmd of ["cat ~/documents/egg1.txt", "ls /root", "unzip /root/egg6.zip", "edit ~/secrets/secrets.cfg", "cat /var/backups/egg7.txt", "sudo ls"]) {
    await run(cmd);
    check(/locked|denied|don't know/i.test(await last()), `denied: ${cmd}`);
  }

  // Ghost text + Tab completion.
  await input.fill("cat REA"); await page.waitForTimeout(40);
  check((await page.locator("form .text-stone-600").innerText()) === "DME.txt", "ghost text suggests README.txt");
  await input.press("Tab");
  check((await input.inputValue()) === "cat README.txt", "Tab accepts the suggestion");
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
  await run("cd ~/secrets"); await run("rm report.txt");
  check(/still needed/.test(await last()), "rm report.txt refused");
  await run("rm *.tmp"); await run("mv report.txt ~/documents/");
  await run("cat egg3.txt");
  await run("edit secrets.cfg");
  check(/back/.test(await last()), "edit refused without backup");
  await run("cp secrets.cfg secrets.cfg.bak"); await run("nano secrets.cfg");
  await editReplace("path_to_vault_locked = true", "path_to_vault_locked = false");
  await run("cat ~/vault/egg4.txt");
  await run("base64 -d c2VjcmV0LWVnZw==");
  await run("sudo edit /etc/privilege.cfg"); await password("secret-egg");
  await editReplace(/allow_admin\s*=\s*false/, "allow_admin = true");
  await run("cat ~/admin/egg5.txt");
  await run("cd /root");
  check(/denied/i.test(await last()), "cd /root without sudo denied");
  await run("sudo cd /root"); await password("secret-egg");
  await run("unzip egg6.zip"); await run("cat egg6.txt");
  await run("grep -r egg /var/log"); await run("cat /var/backups/egg7.txt");
  await run("eggs");
  const bar = await page.locator("text=🥚").first().innerText();
  check(bar.includes("7/7"), `egg counter: ${bar.trim()}`);
  check(/hatched/.test(await last()), "eggs shows the win");
  if (failures) console.log("\n--- last output ---\n" + (await out()).split("\n").slice(-25).join("\n"));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failures ? 1 : 0);
