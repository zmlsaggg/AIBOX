import type { AIProvider } from "./contracts";

export type BrowserProviderId = "chatgpt" | "deepseek" | "qwen" | "gemini" | "claude";

export class BrowserProvider implements AIProvider {
  readonly name = "BROWSER SESSION";
  private provider: BrowserProviderId = "chatgpt";

  configure(provider: BrowserProviderId): void {
    this.provider = provider;
  }

  get selectedProvider(): BrowserProviderId {
    return this.provider;
  }

  async connect(): Promise<string> {
    if (!window.aiboxAI) {
      throw new Error("Подключение к сайтам ИИ доступно в установленной Windows-версии AIBOX. Запусти игру через AIBOX.exe.");
    }
    const result = await window.aiboxAI.connect(this.provider);
    return result.message;
  }

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    if (!window.aiboxAI) {
      throw new Error("Подключение к авторизованным вкладкам Chrome доступно в установленной Windows-версии AIBOX.");
    }

    const abort = () => {
      void window.aiboxAI?.interrupt().catch(() => undefined);
    };
    if (signal.aborted) throw new DOMException("Prompt interrupted", "AbortError");
    signal.addEventListener("abort", abort, { once: true });
    try {
      const result = await window.aiboxAI.generate(prompt);
      if (signal.aborted) throw new DOMException("Prompt interrupted", "AbortError");
      return result;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
}
