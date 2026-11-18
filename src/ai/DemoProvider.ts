import type { AIProvider } from "./contracts";

/**
 * Local development provider. It simulates a browser model response so the
 * game loop can be tested before a user connects a real web session.
 */
export class DemoProvider implements AIProvider {
  readonly name = "LOCAL DEMO";

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    void prompt;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1350);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Prompt interrupted", "AbortError"));
      }, { once: true });
    });

    if (signal.aborted) throw new DOMException("Prompt interrupted", "AbortError");

    return JSON.stringify({
      type: "inspect",
      target: "ventilation",
      narration: "Я осматриваю вентиляционную решётку и проверяю, насколько надёжно она закреплена.",
    });
  }
}
