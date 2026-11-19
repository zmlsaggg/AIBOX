const BRIDGE_URL = "ws://127.0.0.1:3210/extension";
const PROVIDERS = {
  chatgpt: { pattern: "https://chatgpt.com/*", url: "https://chatgpt.com/" },
  deepseek: { pattern: "https://chat.deepseek.com/*", url: "https://chat.deepseek.com/" },
  qwen: { pattern: "https://chat.qwen.ai/*", url: "https://chat.qwen.ai/" },
  gemini: { pattern: "https://gemini.google.com/*", url: "https://gemini.google.com/app" },
  claude: { pattern: "https://claude.ai/*", url: "https://claude.ai/new" }
};

let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let opening = false;

function post(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectBridge, 1800);
}

function connectBridge() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  try {
    socket = new WebSocket(BRIDGE_URL);
  } catch {
    scheduleReconnect();
    return;
  }
  socket.addEventListener("open", () => {
    post({ type: "hello", extensionId: chrome.runtime.id, version: chrome.runtime.getManifest().version });
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => post({ type: "ping", at: Date.now() }), 18000);
  });
  socket.addEventListener("message", (event) => {
    let command;
    try { command = JSON.parse(event.data); } catch { return; }
    void handleCommand(command);
  });
  socket.addEventListener("close", () => {
    clearInterval(heartbeatTimer);
    socket = null;
    scheduleReconnect();
  });
  socket.addEventListener("error", () => {
    try { socket?.close(); } catch {}
  });
}

async function chooseProviderTab(providerId, create = false) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error("Unsupported AI provider.");
  const tabs = await chrome.tabs.query({ url: provider.pattern });
  const lastFocused = tabs.filter((tab) => tab.id !== undefined);
  lastFocused.sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const chosen = lastFocused[0];
  if (chosen?.id !== undefined) return chosen;
  if (!create) throw new Error("No Chrome tab found for this AI service. Press Connect to open it.");
  return chrome.tabs.create({ url: provider.url, active: true });
}

async function sendToContentScript(tabId, message) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw new Error("The AIBOX connector could not reach the provider page. Reload the Chrome tab and try again. " + String(lastError || ""));
}

async function handleCommand(command) {
  if (!command || typeof command.id !== "string" || typeof command.type !== "string") return;
  try {
    if (command.type === "open-provider") {
      const tab = await chooseProviderTab(command.provider, true);
      if (tab.id !== undefined) await chrome.tabs.update(tab.id, { active: true });
      post({ type: "result", id: command.id, ok: true, message: "Chrome tab activated." });
      return;
    }
    if (command.type === "generate") {
      const tab = await chooseProviderTab(command.provider, false);
      const response = await sendToContentScript(tab.id, {
        type: "aibox:generate",
        prompt: command.prompt,
        requestId: command.id
      });
      if (!response?.ok || typeof response.text !== "string") {
        throw new Error(response?.error || "The provider did not return a readable answer.");
      }
      post({ type: "result", id: command.id, ok: true, response: response.text });
      return;
    }
    if (command.type === "interrupt") {
      const tab = await chooseProviderTab(command.provider, false);
      await sendToContentScript(tab.id, { type: "aibox:interrupt" });
      post({ type: "result", id: command.id, ok: true, interrupted: true });
      return;
    }
  } catch (error) {
    post({
      type: "result",
      id: command.id,
      ok: false,
      error: error instanceof Error ? error.message : "Chrome connector error."
    });
  }
}

chrome.runtime.onInstalled.addListener(connectBridge);
chrome.runtime.onStartup.addListener(connectBridge);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "aibox:wake") connectBridge();
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && Object.values(PROVIDERS).some((provider) => tab.url?.startsWith(provider.url))) {
    connectBridge();
  }
});
chrome.alarms?.create?.("aibox-bridge-keepalive", { periodInMinutes: 0.4 });
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === "aibox-bridge-keepalive") connectBridge();
});
connectBridge();
