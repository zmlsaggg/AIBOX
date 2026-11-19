export {};

declare global {
  interface Window {
    aiboxAI?: {
      connect(provider: "chatgpt" | "deepseek" | "qwen" | "gemini" | "claude"): Promise<{
        provider: string;
        title: string;
        message: string;
      }>;
      generate(prompt: string): Promise<string>;
      interrupt(): Promise<{ interrupted: boolean }>;
    };
  }
}
