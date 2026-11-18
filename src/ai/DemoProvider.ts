import type { AIProvider } from "./contracts";

/**
 * Local development provider. It simulates browser-model responses so the
 * game loop can be tested before a user connects a real web session.
 */
export class DemoProvider implements AIProvider {
  readonly name = "LOCAL DEMO";

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    const turn = Number(/TURN:\s*(\d+)/.exec(prompt)?.[1] ?? 1);
    const samples = [
      { type: "inspect", target: "ventilation", narration: "Я осматриваю вентиляционную решётку и проверяю, насколько надёжно она закреплена." },
      { type: "move", x: -7.0, z: -5.05, narration: "Я осторожно приближаюсь к двери камеры." },
      { type: "interact", target: "west-cell-door", narration: "Пробую открыть дверь камеры." },
      { type: "move", x: -4.2, z: -5.1, narration: "Я прохожу в коридор и осматриваюсь." },
      { type: "inspect", target: "checkpoint", narration: "Я изучаю следующий контур защиты." },
    ];
    const action = samples[(turn - 1) % samples.length];

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1350);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Prompt interrupted", "AbortError"));
      }, { once: true });
    });

    if (signal.aborted) throw new DOMException("Prompt interrupted", "AbortError");
    return JSON.stringify(action);
  }
}
