import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("chrome-extension/manifest.json", "utf8"));
const electronMain = await readFile("electron/main.cjs", "utf8");
const expected = "gffladdchbciogclknkmjlklimpdbkhn";
if (!manifest.key) throw new Error("Chrome extension must pin its public key.");
const digest = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest().subarray(0, 16);
const actual = [...digest].map((byte) =>
  String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))
).join("");
if (actual !== expected) throw new Error(`Chrome extension public key resolves to ${actual}, expected ${expected}.`);
if (!electronMain.includes(`EXTENSION_ID = "${expected}"`)) {
  throw new Error("Electron bridge extension ID does not match the manifest key.");
}
for (const permission of ["tabs", "alarms"]) {
  if (!manifest.permissions.includes(permission)) throw new Error(`Missing Chrome permission: ${permission}`);
}
for (const host of [
  "https://chatgpt.com/*",
  "https://chat.deepseek.com/*",
  "https://chat.qwen.ai/*",
  "https://gemini.google.com/*",
  "https://claude.ai/*",
  "http://127.0.0.1:3210/*",
]) {
  if (!manifest.host_permissions.includes(host)) throw new Error(`Missing Chrome host permission: ${host}`);
}
if (manifest.background?.service_worker !== "background.js") throw new Error("MV3 background service worker is not configured.");
console.log(`Chrome connector manifest OK · MV3 · extension ID ${actual} · ${manifest.content_scripts?.[0]?.matches?.length ?? 0} provider sites.`);
