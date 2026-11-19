import type { AIProvider } from "./contracts";

export type BrowserProviderId = "chatgpt" | "deepseek" | "qwen" | "gemini" | "claude";

interface BridgeHealth {
  ok: boolean;
  browser: boolean;
  busy: boolean;
  provider: BrowserProviderId | null;
}

export class BrowserProvider implements AIProvider {
  readonly name = "BROWSER SESSION";
  private readonly baseUrl = "http://127.0.0.1:3210";
  private token = "";
  private provider: BrowserProviderId = "chatgpt";

  configure(token: string, provider: BrowserProviderId): void {
    this.token = token.trim();
    this.provider = provider;
  }

  get selectedProvider(): BrowserProviderId {
    return this.provider;
  }

  async connect(): Promise<string> {
    if (!this.token) {
      throw new Error("Pairing token is empty. Start AIBOX Browser Bridge in PowerShell, then paste the token printed in its terminal.");
    }

    // Check the local service separately so users can distinguish a stopped bridge
    // from an invalid token or a provider-site login problem.
    await this.request<BridgeHealth>("/health", undefined, undefined, false);
    const result = await this.request<{ title: string; url: string }>("/connect", { provider: this.provider });
    return `${this.provider.toUpperCase()} connected · ${result.title}`;
  }

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    const abort = () => { void this.request("/interrupt", {}).catch(() => undefined); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      const result = await this.request<{ response: string }>("/generate", { prompt }, signal);
      return result.response;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  private async request<T = { ok: boolean }>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    requiresToken = true,
  ): Promise<T> {
    if (requiresToken && !this.token) {
      throw new Error("Pairing token is empty. Open «Как подключить ИИ» below and follow the PowerShell steps.");
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...(requiresToken ? { authorization: `Bearer ${this.token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new Error("Browser Bridge не запущен. Запусти AIBOX\\bridge\\Start-Bridge.ps1 через PowerShell.");
    }

    const data = await response.json() as T & { error?: string };
    if (response.status === 401) {
      throw new Error("Неверный pairing token. Скопируй актуальный токен из работающего окна Browser Bridge.");
    }
    if (!response.ok) throw new Error(data.error || `Browser bridge error (${response.status})`);
    return data;
  }
}
