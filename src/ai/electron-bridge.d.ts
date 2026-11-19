export {};

declare global {
  interface Window {
    aiboxAI?: {
      connect(provider: "chatgpt" | "deepseek" | "qwen" | "gemini" | "claude"): Promise<{
        provider: string;
        title: string;
        connected: boolean;
        message: string;
      }>;
      generate(prompt: string): Promise<string>;
      interrupt(): Promise<{ interrupted: boolean }>;
      installChromeConnector(): Promise<{ path: string; message: string }>;
    };
  }
}
