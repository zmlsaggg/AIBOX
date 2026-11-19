const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const PROVIDERS = {
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    composers: ['[data-testid="prompt-textarea"]', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
    sendButtons: ['[data-testid="send-button"]', 'button[aria-label*="Send" i]', 'button[data-testid*="send"]'],
    stopButtons: ['[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', 'button[data-testid*="stop"]'],
    responses: ['[data-message-author-role="assistant"]'],
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://chat.deepseek.com/",
    composers: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
    sendButtons: ['button[aria-label*="Send" i]', 'button[class*="send"]'],
    stopButtons: ['button[aria-label*="Stop" i]', 'button[class*="stop"]'],
    responses: ['.ds-markdown', '[class*="markdown"]'],
  },
  qwen: {
    label: "Qwen Chat",
    url: "https://chat.qwen.ai/",
    composers: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
    sendButtons: ['button[aria-label*="Send" i]', 'button[class*="send"]'],
    stopButtons: ['button[aria-label*="Stop" i]', 'button[class*="stop"]'],
    responses: ['.markdown-body', '.markdown', '[class*="message-content"]'],
  },
  gemini: {
    label: "Gemini",
    url: "https://gemini.google.com/app",
    composers: ['rich-textarea [contenteditable="true"]', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
    sendButtons: ['button[aria-label*="Send" i]', 'button[aria-label*="send" i]'],
    stopButtons: ['button[aria-label*="Stop" i]', 'button[aria-label*="stop" i]'],
    responses: ['.model-response-text', 'message-content', '[class*="response-content"]'],
  },
  claude: {
    label: "Claude",
    url: "https://claude.ai/new",
    composers: ['div[contenteditable="true"]', 'textarea', '[role="textbox"]'],
    sendButtons: ['button[aria-label*="Send" i]', 'button[data-testid*="send"]'],
    stopButtons: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop"]'],
    responses: ['.font-claude-message', '[data-testid="chat-message"]'],
  },
};

let mainWindow;
const aiWindows = new Map();
let selectedProvider = null;
let generationBusy = false;
let generationCancelled = false;
let isQuitting = false;

function isAllowedProvider(id) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, id);
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function configureProviderWindow(window, providerId) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      return new URL(url).protocol === "https:" ? { action: "allow" } : { action: "deny" };
    } catch {
      return { action: "deny" };
    }
  });
  window.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).protocol !== "https:") event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => {
    aiWindows.delete(providerId);
  });
}

async function openAIWindow(providerId) {
  if (!isAllowedProvider(providerId)) throw new Error("Выбран неподдерживаемый AI-сервис.");
  selectedProvider = providerId;
  let window = aiWindows.get(providerId);

  if (!window || window.isDestroyed()) {
    const provider = PROVIDERS[providerId];
    window = new BrowserWindow({
      width: 1180,
      height: 860,
      minWidth: 760,
      minHeight: 600,
      show: false,
      title: `AIBOX · ${provider.label}`,
      autoHideMenuBar: true,
      backgroundColor: "#111719",
      webPreferences: {
        partition: `persist:aibox-ai-${providerId}`,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    configureProviderWindow(window, providerId);
    aiWindows.set(providerId, window);
    await window.loadURL(provider.url);
    window.show();
    window.focus();
  } else {
    window.show();
    window.focus();
  }

  return {
    provider: providerId,
    title: PROVIDERS[providerId].label,
    message: `Окно ${PROVIDERS[providerId].label} открыто. Войди в аккаунт один раз, затем вернись в игру. Сессия сохранится на этом компьютере.`,
  };
}

function getVisibleElement(document, selectors) {
  for (const selector of selectors) {
    const found = Array.from(document.querySelectorAll(selector)).find(isVisible);
    if (found) return found;
  }
  return null;
}

async function sendPrompt(window, providerId, prompt) {
  const provider = PROVIDERS[providerId];
  const payload = JSON.stringify({ prompt, composers: provider.composers, sendButtons: provider.sendButtons });
  return window.webContents.executeJavaScript(`(() => {
    const config = ${payload};
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    let composer = null;
    for (const selector of config.composers) {
      composer = Array.from(document.querySelectorAll(selector)).find((element) => visible(element) && !element.disabled);
      if (composer) break;
    }
    if (!composer) return { error: "Поле ввода не найдено. Проверь, что ты вошёл в аккаунт и открыл новый чат." };

    const before = Array.from(document.querySelectorAll(
      '[data-message-author-role="assistant"], .ds-markdown, .markdown-body, .model-response-text, .font-claude-message, [data-testid="chat-message"]'
    )).map((element) => (element.innerText || "").trim()).filter(Boolean);
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(composer, config.prompt);
      else composer.value = config.prompt;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: config.prompt }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      composer.replaceChildren();
      composer.textContent = config.prompt;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: config.prompt }));
    }

    let send = null;
    for (const selector of config.sendButtons) {
      send = Array.from(document.querySelectorAll(selector)).find(visible);
      if (send) break;
    }
    if (send) send.click();
    else composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    return { beforeCount: before.length, beforeLast: before.at(-1) || "" };
  })()`);
}

async function readAssistantState(window, providerId) {
  const selectors = PROVIDERS[providerId].responses;
  const stops = PROVIDERS[providerId].stopButtons;
  const payload = JSON.stringify({ selectors, stops });
  return window.webContents.executeJavaScript(`(() => {
    const config = ${payload};
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    let messages = [];
    for (const selector of config.selectors) {
      const found = Array.from(document.querySelectorAll(selector)).filter(visible);
      if (found.length) {
        messages = found.map((element) => (element.innerText || element.textContent || "").trim()).filter(Boolean);
        if (messages.length) break;
      }
    }
    let generating = false;
    for (const selector of config.stops) {
      if (Array.from(document.querySelectorAll(selector)).some(visible)) {
        generating = true;
        break;
      }
    }
    return { count: messages.length, lastText: messages.at(-1) || "", generating };
  })()`);
}

async function generateAI(prompt) {
  if (!selectedProvider || !isAllowedProvider(selectedProvider)) {
    throw new Error("Сначала нажми «Подключить ИИ» и выбери сервис.");
  }
  if (generationBusy) throw new Error("ИИ уже генерирует ответ. Дождись завершения текущего хода.");
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 12000) {
    throw new Error("Промпт пустой или превышает 12 000 символов.");
  }

  let window = aiWindows.get(selectedProvider);
  if (!window || window.isDestroyed()) {
    await openAIWindow(selectedProvider);
    window = aiWindows.get(selectedProvider);
  }
  if (!window || window.isDestroyed()) throw new Error("Не удалось открыть окно AI-сервиса.");

  generationBusy = true;
  generationCancelled = false;
  try {
    const sent = await sendPrompt(window, selectedProvider, prompt);
    if (sent?.error) throw new Error(sent.error);

    const deadline = Date.now() + 120000;
    let previousText = "";
    let stablePolls = 0;
    while (Date.now() < deadline) {
      if (generationCancelled) throw new Error("Ход ИИ отменён.");
      if (window.isDestroyed()) throw new Error("Окно AI-сервиса было закрыто.");
      const state = await readAssistantState(window, selectedProvider);
      const hasNewAnswer = state.count > (sent.beforeCount || 0) || (state.lastText && state.lastText !== sent.beforeLast);
      if (state.lastText && hasNewAnswer && state.lastText === previousText && !state.generating) {
        stablePolls += 1;
      } else {
        stablePolls = 0;
      }
      previousText = state.lastText;
      if (stablePolls >= 3) return state.lastText;
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    throw new Error("ИИ не ответил за 120 секунд. Проверь окно сервиса и интернет-соединение.");
  } finally {
    generationBusy = false;
    generationCancelled = false;
  }
}

ipcMain.handle("aibox:ai:connect", async (_event, providerId) => openAIWindow(providerId));
ipcMain.handle("aibox:ai:generate", async (_event, prompt) => generateAI(prompt));
ipcMain.handle("aibox:ai:interrupt", async () => {
  if (!generationBusy) return { interrupted: false };
  generationCancelled = true;
  const window = selectedProvider ? aiWindows.get(selectedProvider) : null;
  if (window && !window.isDestroyed()) {
    try {
      await window.webContents.executeJavaScript(`(() => {
        const selectors = ['[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', 'button[aria-label*="stop" i]'];
        for (const selector of selectors) {
          const button = Array.from(document.querySelectorAll(selector)).find((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (button) { button.click(); return true; }
        }
        return false;
      })()`);
    } catch {}
  }
  return { interrupted: true };
});

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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
