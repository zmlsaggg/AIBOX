import type { AIProvider } from "./contracts";

/** Local deterministic provider used to exercise the same decision/memory contract as browser models. */
export class DemoProvider implements AIProvider {
  readonly name = "LOCAL DEMO";

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    const turn = Number(/TURN:\s*(\d+)/.exec(prompt)?.[1] ?? 1);
    const samples = [
      {
        intent: "Проверить слабые места камеры и понять, какие инструменты могут пригодиться.",
        action: { type: "inspect", target: "bed", narration: "Я изучаю койку и проверяю, есть ли под ней полезные предметы." },
        alternatives: [
          { type: "inspect", target: "sink", narration: "Осмотреть раковину на предмет полезных деталей." },
          { type: "move", x: -8.2, z: -5.1, pace: "cautious", narration: "Подойти к двери, не привлекая внимания." },
        ],
        memoryUpdate: "Койка закреплена на полу; не трать ходы на попытки её переместить.",
      },
      {
        intent: "Добраться до выхода из камеры и проверить возможность пройти в коридор.",
        action: { type: "move", x: -8.2, z: -5.1, pace: "normal", narration: "Я осторожно приближаюсь к двери камеры." },
        alternatives: [
          { type: "inspect", target: "west-cell-door", narration: "Осмотреть дверь перед взаимодействием." },
          { type: "move", x: -8.1, z: -4.8, pace: "cautious", narration: "Сменить угол подхода." },
        ],
        memoryUpdate: "Дверь камеры находится западнее стартовой позиции; для взаимодействия нужно подойти близко.",
      },
      {
        intent: "Открыть дверь камеры и перейти к следующему участку маршрута.",
        action: { type: "interact", target: "west-cell-door", narration: "Пробую открыть дверь камеры." },
        alternatives: [
          { type: "inspect", target: "west-cell-door", narration: "Проверить состояние двери и замка." },
          { type: "move", x: -6.4, z: -5.1, pace: "cautious", narration: "Подойти к створке с другой стороны." },
        ],
        memoryUpdate: "Не повторяй взаимодействие с дверью, если она недоступна или закрыта на замок.",
      },
      {
        intent: "Продвинуться через коридор к контрольной зоне.",
        action: { type: "move", x: -4.2, z: -5.1, pace: "fast", narration: "Я прохожу в коридор и осматриваюсь." },
        alternatives: [
          { type: "inspect", target: "cell-door", narration: "Проверить следующую дверь." },
          { type: "inspect", target: "keycard", narration: "Проверить, где находится ключ-карта." },
        ],
        memoryUpdate: "Ключ-карта может открыть контрольно-пропускные двери; сначала нужно найти её и поднять.",
      },
      {
        intent: "Проверить положение ключ-карты и спланировать её получение.",
        action: { type: "inspect", target: "keycard", narration: "Я ищу ключ-карту в контрольной зоне." },
        alternatives: [
          { type: "move", x: -3.2, z: 6.15, pace: "cautious", narration: "Подойти к ключ-карте." },
          { type: "inspect", target: "control-door", narration: "Проверить дверь в контрольную зону." },
        ],
        memoryUpdate: "Осмотр предмета срабатывает только на близкой дистанции; после подтверждения местоположения нужно подойти и подобрать его.",
      },
    ];
    const decision = samples[(turn - 1) % samples.length];

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 850);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Prompt interrupted", "AbortError"));
      }, { once: true });
    });
    if (signal.aborted) throw new DOMException("Prompt interrupted", "AbortError");

    return JSON.stringify({ ...decision, confidence: 0.78 });
  }
}
