const PROVIDERS = {
  chatgpt: {
    composer: ['[data-testid="prompt-textarea"]', '#prompt-textarea', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
    send: ['[data-testid="send-button"]', 'button[aria-label*="Send" i]', 'button[data-testid*="send"]'],
    stop: ['[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', 'button[data-testid*="stop"]'],
    responses: ['[data-message-author-role="assistant"]']
  },
  deepseek: {
    composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
    send: ['button[aria-label*="Send" i]', 'button[class*="send"]'],
    stop: ['button[aria-label*="Stop" i]', 'button[class*="stop"]'],
    responses: ['.ds-markdown', '[class*="ds-markdown"]']
  },
  qwen: {
    composer: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
    send: ['button[aria-label*="Send" i]', 'button[class*="send"]'],
    stop: ['button[aria-label*="Stop" i]', 'button[class*="stop"]'],
    responses: ['.markdown-body', '.markdown', '[class*="message-content"]']
  },
  gemini: {
    composer: ['rich-textarea [contenteditable="true"]', 'textarea', '[contenteditable="true"]', '[role="textbox"]'],
    send: ['button[aria-label*="Send" i]', 'button[aria-label*="send" i]'],
    stop: ['button[aria-label*="Stop" i]', 'button[aria-label*="stop" i]'],
    responses: ['.model-response-text', 'message-content', '[class*="response-content"]']
  },
  claude: {
    composer: ['div[contenteditable="true"]', 'textarea', '[role="textbox"]'],
    send: ['button[aria-label*="Send" i]', 'button[data-testid*="send"]'],
    stop: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop"]'],
    responses: ['.font-claude-message']
  }
};

let activeRequest = null;

function providerId() {
  const host = location.hostname;
  if (host === "chatgpt.com") return "chatgpt";
  if (host === "chat.deepseek.com") return "deepseek";
  if (host === "chat.qwen.ai") return "qwen";
  if (host === "gemini.google.com") return "gemini";
  if (host === "claude.ai") return "claude";
  return null;
}

function visible(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function findVisible(selectors) {
  for (const selector of selectors) {
    const element = Array.from(document.querySelectorAll(selector)).find((item) => visible(item) && !item.disabled);
    if (element) return element;
  }
  return null;
}

function collectMessages(config) {
  const unique = new Set();
  const found = [];
  for (const selector of config.responses) {
    for (const element of document.querySelectorAll(selector)) {
      if (visible(element) && !unique.has(element)) {
        unique.add(element);
        const text = (element.innerText || element.textContent || "").trim();
        if (text) found.push({ element, text });
      }
    }
    if (found.length) break;
  }
  return found;
}

function isGenerating(config) {
  return config.stop.some((selector) => Array.from(document.querySelectorAll(selector)).some(visible));
}

function fillComposer(composer, prompt) {
  composer.focus();
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(composer, prompt);
    else composer.value = prompt;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    composer.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, prompt);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
  }
}

function clickStop(config) {
  const button = findVisible(config.stop);
  if (button) button.click();
}

async function generate(prompt) {
  const id = providerId();
  const config = PROVIDERS[id];
  if (!config) throw new Error("Unsupported AI provider page.");
  if (activeRequest) throw new Error("This provider already has an active AIBOX request.");

  const composer = findVisible(config.composer);
  if (!composer) {
    throw new Error("The prompt box was not found. Sign in to this provider in Chrome and open a new chat.");
  }
  const before = collectMessages(config);
  const beforeCount = before.length;
  const beforeLast = before.at(-1)?.text || "";
  const request = { cancelled: false };
  activeRequest = request;

  try {
    fillComposer(composer, prompt);
    await new Promise((resolve) => setTimeout(resolve, 160));
    const send = findVisible(config.send);
    if (send) send.click();
    else composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));

    const deadline = Date.now() + 120000;
    let previousText = "";
    let stablePolls = 0;
    while (Date.now() < deadline) {
      if (request.cancelled) throw new Error("AI turn interrupted.");
      const messages = collectMessages(config);
      const latest = messages.at(-1)?.text || "";
      const isNewAnswer = messages.length > beforeCount || (latest && latest !== beforeLast);
      if (latest && isNewAnswer && latest === previousText && !isGenerating(config)) stablePolls++;
      else stablePolls = 0;
      previousText = latest;
      if (stablePolls >= 4) return latest;
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
    throw new Error("The provider did not finish the response within 120 seconds. Check its Chrome tab.");
  } finally {
    activeRequest = null;
  }
}

chrome.runtime.sendMessage({ type: "aibox:wake" }).catch(() => undefined);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "aibox:generate") {
    if (typeof message.prompt !== "string" || !message.prompt.trim() || message.prompt.length > 12000) {
      sendResponse({ ok: false, error: "Prompt is empty or too long." });
      return false;
    }
    generate(message.prompt).then(
      (text) => sendResponse({ ok: true, text }),
      (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Provider page error." })
    );
    return true;
  }
  if (message?.type === "aibox:interrupt") {
    if (activeRequest) activeRequest.cancelled = true;
    const config = PROVIDERS[providerId()];
    if (config) clickStop(config);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
