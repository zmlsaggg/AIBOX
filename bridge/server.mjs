import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = Number(process.env.AIBOX_BRIDGE_PORT || 3210);
const TOKEN = process.env.AIBOX_BRIDGE_TOKEN || randomBytes(18).toString("hex");
const PROFILE = path.resolve(process.env.AIBOX_BROWSER_PROFILE || path.join(os.homedir(), ".aibox", "browser-profile"));
// Electron opens the game from file://, which sends the opaque Origin "null".
// Requests still require the random Bearer pairing token below.
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173", "null"]);
const PROVIDERS = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  deepseek: { label: "DeepSeek", url: "https://chat.deepseek.com/" },
  qwen: { label: "Qwen Chat", url: "https://chat.qwen.ai/" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
  claude: { label: "Claude", url: "https://claude.ai/new" }
};
let context;
let page;
const providerPages = new Map();
let activeProvider = null;
let busy = false;
let activeAbort = null;

function json(res, status, data, origin) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "vary": "Origin" } : {})
  });
  res.end(JSON.stringify(data));
}
function authorized(req) {
  const value = req.headers.authorization || "";
  const candidate = Buffer.from(value.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(TOKEN);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
async function ensureBrowser() {
  if (context) return;
  await mkdir(PROFILE, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1440, height: 960 } });
  page = context.pages()[0] || await context.newPage();
}
async function selectProvider(id) {
  if (busy) throw new Error("Cannot switch AI providers while a prompt is running.");
  const provider = PROVIDERS[id];
  if (!provider) throw new Error("Unknown provider");
  await ensureBrowser();
  page = providerPages.get(id);
  if (!page || page.isClosed()) {
    page = await context.newPage();
    providerPages.set(id, page);
    await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } else if (!page.url().startsWith(provider.url)) {
    await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  activeProvider = id;
  return { provider: id, url: page.url(), title: await page.title() };
}
async function generate(prompt, signal) {
  if (!activeProvider || !page || page.isClosed()) throw new Error("Connect a provider first");
  if (busy) throw new Error("Browser session is busy");
  busy = true;
  activeAbort = { cancelled: false };
  const abort = () => { activeAbort.cancelled = true; };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const composerCandidates = [
      page.locator('[data-testid="prompt-textarea"]'),
      page.locator('textarea'),
      page.locator('[contenteditable="true"]')
    ];
    let composer;
    for (const candidate of composerCandidates) {
      for (let i = 0; i < await candidate.count(); i++) {
        const item = candidate.nth(i);
        if (await item.isVisible().catch(() => false)) { composer = item; break; }
      }
      if (composer) break;
    }
    if (!composer) throw new Error("Composer not found. The provider UI may have changed or login is required.");
    const beforeCount = await page.locator('[data-message-author-role="assistant"]').count();
    const beforeText = beforeCount ? (await page.locator('[data-message-author-role="assistant"]').last().innerText().catch(() => "")) : "";
    await composer.fill(prompt);
    const sendCandidates = [
      page.locator('[data-testid="send-button"]'),
      page.locator('button[aria-label*="Send" i]'),
      page.locator('button[aria-label*="发送"]'),
      page.locator('button:has-text("Send")')
    ];
    let send;
    for (const candidate of sendCandidates) {
      if (await candidate.first().isVisible().catch(() => false)) { send = candidate.first(); break; }
    }
    if (send) await send.click();
    else await composer.press("Enter");

    const stop = page.locator('[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="停止"]');
    await page.waitForTimeout(350);
    const deadline = Date.now() + 120000;
    let lastText = "";
    let stable = 0;
    while (Date.now() < deadline) {
      if (activeAbort.cancelled) throw new Error("Prompt interrupted");
      const messages = page.locator('[data-message-author-role="assistant"], [data-testid*="conversation-turn"]');
      const count = await messages.count();
      if (count) {
        const text = (await messages.last().innerText().catch(() => "")).trim();
        if (text && text === lastText) stable++; else stable = 0;
        lastText = text;
      }
      const generating = await stop.first().isVisible().catch(() => false);
      const isNewResponse = count > beforeCount || lastText !== beforeText;
      if (lastText && isNewResponse && !generating && stable >= 3) return lastText;
      await page.waitForTimeout(500);
    }
    throw new Error("Timed out waiting for the model response");
  } finally {
    signal?.removeEventListener("abort", abort);
    activeAbort = null;
    busy = false;
  }
}
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: "Origin not allowed" });
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-max-age": "600",
      vary: "Origin"
    };
    // Chromium may send a Private Network Access preflight for file:// -> localhost.
    if (req.headers["access-control-request-private-network"] === "true") {
      headers["access-control-allow-private-network"] = "true";
    }
    res.writeHead(204, headers);
    return res.end();
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: "Origin not allowed" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, browser: Boolean(context), busy, provider: activeProvider, providers: Object.keys(PROVIDERS) }, origin);
  if (!authorized(req)) return json(res, 401, { error: "Pairing token required" }, origin);
  try {
    if (url.pathname === "/providers" && req.method === "GET") return json(res, 200, PROVIDERS, origin);
    if (url.pathname === "/connect" && req.method === "POST") {
      let body = ""; for await (const chunk of req) body += chunk;
      const { provider } = JSON.parse(body || "{}");
      return json(res, 200, await selectProvider(provider), origin);
    }
    if (url.pathname === "/generate" && req.method === "POST") {
      let body = ""; for await (const chunk of req) body += chunk;
      const { prompt } = JSON.parse(body || "{}");
      if (typeof prompt !== "string" || prompt.length > 12000) return json(res, 400, { error: "Prompt must be a string up to 12,000 characters" }, origin);
      const controller = new AbortController();
      res.on("close", () => { if (!res.writableEnded) controller.abort(); });
      const response = await generate(prompt, controller.signal);
      return json(res, 200, { response, provider: activeProvider }, origin);
    }
    if (url.pathname === "/interrupt" && req.method === "POST") {
      if (activeAbort) activeAbort.cancelled = true;
      return json(res, 200, { interrupted: Boolean(activeAbort) }, origin);
    }
    return json(res, 404, { error: "Not found" }, origin);
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : "Bridge error" }, origin);
  }
});
server.listen(PORT, HOST, () => {
  console.log(`AIBOX browser bridge: http://${HOST}:${PORT}`);
  console.log(`Pairing token (paste into AIBOX settings): ${TOKEN}`);
  console.log(`Browser profile: ${PROFILE}`);
  console.log("The browser opens visibly. Sign in manually; do not share this token.");
});
