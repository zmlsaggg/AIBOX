const { app, BrowserWindow, ipcMain, shell, clipboard } = require("electron");
const { execFile, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const HOST = "127.0.0.1";
const PORT = 3210;
const EXTENSION_ID = "gffladdchbciogclknkmjlklimpdbkhn";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const PROVIDERS = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  deepseek: { label: "DeepSeek", url: "https://chat.deepseek.com/" },
  qwen: { label: "Qwen Chat", url: "https://chat.qwen.ai/" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
  claude: { label: "Claude", url: "https://claude.ai/new" },
};

let mainWindow;
let selectedProvider = null;
let generationBusy = false;
let generationCancelled = false;
let chromeBridgeServer;
let chromeBridgeWss;
let chromeSocket = null;
let chromeBridgeError = null;
const pendingCommands = new Map();

function isAllowedProvider(id) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, id);
}

function sendChromeCommand(type, payload = {}, timeoutMs = 120000) {
  if (!chromeSocket || chromeSocket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Chrome connector is not connected."));
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error("Chrome did not answer the AIBOX request in time. Check the provider tab."));
    }, timeoutMs);
    pendingCommands.set(id, { resolve, reject, timer });
    try {
      chromeSocket.send(JSON.stringify({ id, type, provider: selectedProvider, ...payload }));
    } catch (error) {
      clearTimeout(timer);
      pendingCommands.delete(id);
      reject(error);
    }
  });
}

function settleChromeCommand(message) {
  if (message.type !== "result" || typeof message.id !== "string") return;
  const pending = pendingCommands.get(message.id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingCommands.delete(message.id);
  if (message.ok) pending.resolve(message);
  else pending.reject(new Error(message.error || "Chrome provider request failed."));
}

function rejectAllChromeCommands(error) {
  for (const [id, pending] of pendingCommands) {
    clearTimeout(pending.timer);
    pending.reject(error);
    pendingCommands.delete(id);
  }
}

function startChromeBridge() {
  chromeBridgeServer = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(JSON.stringify({
        ok: true,
        connector: Boolean(chromeSocket && chromeSocket.readyState === WebSocket.OPEN),
        provider: selectedProvider,
        busy: generationBusy,
      }));
    }
    res.writeHead(404);
    res.end();
  });

  chromeBridgeWss = new WebSocketServer({ noServer: true, maxPayload: 18000 });
  chromeBridgeServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    if (request.headers.origin !== EXTENSION_ORIGIN || url.pathname !== "/extension") {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    chromeBridgeWss.handleUpgrade(request, socket, head, (webSocket) => {
      chromeBridgeWss.emit("connection", webSocket, request);
    });
  });

  chromeBridgeWss.on("connection", (webSocket) => {
    if (chromeSocket && chromeSocket !== webSocket && chromeSocket.readyState === WebSocket.OPEN) {
      chromeSocket.close(1000, "A newer AIBOX Chrome session connected.");
    }
    chromeSocket = webSocket;
    webSocket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type === "hello") {
        if (message.extensionId !== EXTENSION_ID) {
          webSocket.close(1008, "Unrecognized AIBOX extension.");
          return;
        }
        webSocket.send(JSON.stringify({ type: "bridge-ready", app: "AIBOX" }));
        return;
      }
      if (message.type === "result") settleChromeCommand(message);
    });
    webSocket.on("close", () => {
      if (chromeSocket === webSocket) chromeSocket = null;
      rejectAllChromeCommands(new Error("Chrome connector disconnected. Reopen Chrome or reload the AIBOX extension."));
    });
    webSocket.on("error", () => {
      if (chromeSocket === webSocket) chromeSocket = null;
    });
  });

  chromeBridgeServer.on("error", (error) => {
    chromeBridgeError = error;
    console.error("AIBOX Chrome connector server failed:", error);
  });
  chromeBridgeServer.listen(PORT, HOST, () => {
    chromeBridgeError = null;
    console.log(`AIBOX Chrome connector listening on http://${HOST}:${PORT}`);
  });
}

async function openAIWindow(providerId) {
  if (!isAllowedProvider(providerId)) throw new Error("Выбран неподдерживаемый AI-сервис.");
  if (generationBusy) throw new Error("Дождись завершения текущего хода, чтобы сменить ИИ-сервис.");
  selectedProvider = providerId;
  const provider = PROVIDERS[providerId];

  if (chromeBridgeError) {
    throw new Error("Не запустился локальный Chrome-коннектор AIBOX (порт 3210). Закрой старый AIBOX Bridge и перезапусти игру.");
  }

  if (chromeSocket && chromeSocket.readyState === WebSocket.OPEN) {
    try {
      await sendChromeCommand("open-provider", {}, 12000);
    } catch {
      await shell.openExternal(provider.url);
    }
  } else {
    // Opens the OS default browser. When Chrome is the default, this is the
    // user's regular Chrome profile with all its existing sign-in sessions.
    await shell.openExternal(provider.url);
  }

  return {
    provider: providerId,
    title: provider.label,
    message: `Открыл ${provider.label} в обычном браузере. AIBOX использует твою текущую Chrome-сессию; входить во второй профиль не нужно.`,
  };
}

async function generateAI(prompt) {
  if (!selectedProvider || !isAllowedProvider(selectedProvider)) {
    throw new Error("Сначала нажми «Подключить ИИ» и выбери сервис.");
  }
  if (generationBusy) throw new Error("ИИ уже генерирует ответ. Дождись завершения текущего хода.");
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 12000) {
    throw new Error("Промпт пустой или превышает 12 000 символов.");
  }
  if (chromeBridgeError) {
    throw new Error("Локальный Chrome-коннектор не запустился. Перезапусти AIBOX; порт 3210 должен быть свободен.");
  }
  if (!chromeSocket || chromeSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Chrome Connector не подключён. Нажми «УСТАНОВИТЬ CHROME CONNECTOR», загрузи расширение в chrome://extensions и обнови вкладку ИИ.");
  }

  generationBusy = true;
  generationCancelled = false;
  try {
    const result = await sendChromeCommand("generate", { prompt }, 130000);
    if (generationCancelled) throw new Error("Ход ИИ отменён.");
    if (typeof result.response !== "string" || !result.response.trim()) {
      throw new Error("Chrome вернул пустой ответ. Проверь вкладку выбранного ИИ.");
    }
    return result.response;
  } finally {
    generationBusy = false;
    generationCancelled = false;
  }
}

async function interruptAI() {
  if (!generationBusy) return { interrupted: false };
  generationCancelled = true;
  if (!chromeSocket || chromeSocket.readyState !== WebSocket.OPEN) return { interrupted: true };
  try {
    await sendChromeCommand("interrupt", {}, 5000);
  } catch {}
  return { interrupted: true };
}

async function openChromeExtensionSettings() {
  const launch = (executable, args) => {
    const child = execFile(executable, args, { detached: true, stdio: "ignore" }, (error) => {
      if (error) console.warn("Could not open Chrome extension settings:", error.message);
    });
    child.unref();
  };

  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    for (const root of roots) {
      const executable = path.join(root, "Google", "Chrome", "Application", "chrome.exe");
      try {
        await fs.access(executable);
        launch(executable, ["chrome://extensions/"]);
        return true;
      } catch {}
    }
  } else if (process.platform === "darwin") {
    launch("open", ["-a", "Google Chrome", "chrome://extensions/"]);
    return true;
  } else {
    for (const executable of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const located = spawnSync("which", [executable], { encoding: "utf8" });
      if (located.status === 0 && located.stdout.trim()) {
        launch(located.stdout.trim(), ["chrome://extensions/"]);
        return true;
      }
    }
  }

  try {
    await shell.openExternal("chrome://extensions/");
    return true;
  } catch {
    return false;
  }
}

async function installChromeConnector() {
  const source = app.isPackaged
    ? path.join(process.resourcesPath, "chrome-extension")
    : path.join(__dirname, "..", "chrome-extension");
  const destination = path.join(app.getPath("userData"), "chrome-extension");
  await fs.access(path.join(source, "manifest.json"));
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
  clipboard.writeText(destination);
  const chromeOpened = await openChromeExtensionSettings();
  return {
    path: destination,
    chromeOpened,
    message: `Папка расширения скопирована в буфер обмена: ${destination}

${chromeOpened ? "Chrome открыл chrome://extensions." : "Открой chrome://extensions вручную."}
1. Включи «Режим разработчика».
2. Нажми «Загрузить распакованное расширение».
3. Вставь путь из буфера обмена и выбери эту папку.
4. Оставь Chrome открытым, обнови вкладку выбранного ИИ и вернись в AIBOX.

Это одноразовое подтверждение Chrome. Cookies и пароли остаются в твоём обычном профиле Chrome.`,
  };
}

ipcMain.handle("aibox:ai:connect", async (_event, providerId) => openAIWindow(providerId));
ipcMain.handle("aibox:ai:generate", async (_event, prompt) => generateAI(prompt));
ipcMain.handle("aibox:ai:interrupt", async () => interruptAI());
ipcMain.handle("aibox:ai:install-chrome", async () => installChromeConnector());

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 680,
    fullscreen: true,
    frame: false,
    show: false,
    backgroundColor: "#090d12",
    title: "AIBOX — Prison Control",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === "Escape" && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  startChromeBridge();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  rejectAllChromeCommands(new Error("AIBOX is closing."));
  try { chromeSocket?.close(); } catch {}
  try { chromeBridgeWss?.close(); } catch {}
  try { chromeBridgeServer?.close(); } catch {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
