import type { AIProvider } from "./contracts";

export type BrowserProviderId = "chatgpt" | "deepseek" | "qwen" | "gemini" | "claude";

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

  private async request<T = { ok: boolean }>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!this.token) throw new Error("Enter the local browser bridge pairing token first.");
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: { authorization: `Bearer ${this.token}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new Error("Cannot reach local browser bridge. Start it with: cd bridge && npm start");
    }
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `Browser bridge error (${response.status})`);
    return data;
  }
}
