import { parsePrisonerAction } from "./ActionParser";
import { buildPrisonerPrompt } from "./PromptBuilder";
import type { AIProvider, PrisonSnapshot, TurnResult } from "./contracts";

export type TurnState = "idle" | "generating" | "applying" | "interrupted" | "error";

export class TurnController {
  private turn = 0;
  private generation = 0;
  private controller: AbortController | null = null;
  private state: TurnState = "idle";

  constructor(
    private provider: AIProvider,
    private readonly apply: (result: TurnResult) => void,
    private readonly onState: (state: TurnState, detail?: string) => void,
  ) {}

  setProvider(provider: AIProvider): boolean {
    if (this.state === "generating" || this.state === "applying") return false;
    this.provider = provider;
    return true;
  }

  get currentState(): TurnState {
    return this.state;
  }

  async takeTurn(snapshot: Omit<PrisonSnapshot, "turn">): Promise<void> {
    if (this.state === "generating" || this.state === "applying") return;

    const turn = ++this.turn;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.setState("generating", `Ход ${turn}: ${this.provider.name} генерирует действие`);

    try {
      const prompt = buildPrisonerPrompt({ ...snapshot, turn });
      const raw = await this.provider.generate(prompt, controller.signal);

      // A cancelled or superseded browser response must never reach the world.
      if (generation !== this.generation || controller.signal.aborted) return;

      const action = parsePrisonerAction(raw);
      this.setState("applying", `Ход ${turn}: проверка и применение действия`);
      this.apply({ turn, action, narration: action.narration });
      this.setState("idle", `Ход ${turn} завершён`);
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        this.setState("interrupted", "Промпт отменён до применения действия");
        return;
      }
      this.setState("error", error instanceof Error ? error.message : "Unknown AI error");
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  interrupt(): boolean {
    if (!this.controller || this.state !== "generating") return false;
    // Invalidate the generation before aborting: late responses are discarded.
    this.generation += 1;
    this.controller.abort();
    this.controller = null;
    this.setState("interrupted", "Ход удалён охранником");
    return true;
  }

  private setState(state: TurnState, detail?: string): void {
    this.state = state;
    this.onState(state, detail);
  }
}
