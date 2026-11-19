import { parsePrisonerDecision } from "./ActionParser";
import { buildPrisonerPrompt } from "./PromptBuilder";
import type { AIProvider, ActionOutcome, PrisonSnapshot, PrisonerAction, PrisonerDecision, TurnMemoryEntry, TurnResult } from "./contracts";

export type TurnState = "idle" | "generating" | "applying" | "interrupted" | "error";
export type DecisionUpdate = (decision: PrisonerDecision, history: TurnMemoryEntry[], memorySummary: string) => void;

function signature(action: PrisonerAction): string {
  switch (action.type) {
    case "move": return `move:${(Math.round(action.x * 2) / 2).toFixed(1)}:${(Math.round(action.z * 2) / 2).toFixed(1)}`;
    case "inspect": return `inspect:${action.target.toLowerCase()}`;
    case "interact": return `interact:${action.target.toLowerCase()}`;
    case "use_item": return `use_item:${action.target.toLowerCase()}`;
    case "throw": return `throw:${action.x.toFixed(1)}:${action.z.toFixed(1)}`;
    case "speak": return `speak:${action.message.toLowerCase()}`;
    case "wait": return "wait";
  }
}

function fallbackAlternatives(snapshot: Omit<PrisonSnapshot, "turn" | "history" | "memorySummary">, primary: PrisonerAction): PrisonerAction[] {
  const candidates: PrisonerAction[] = [];
  const px = snapshot.prisoner.x;
  const pz = snapshot.prisoner.z;
  const distance = (x: number, z: number) => Math.hypot(x - px, z - pz);

  if (snapshot.prisoner.heldItem === "keycard") {
    const locked = snapshot.doorStates
      .filter((door) => door.locked)
      .sort((a, b) => distance(a.x, a.z) - distance(b.x, b.z))[0];
    if (locked) candidates.push({
      type: "use_item",
      target: locked.id,
      narration: `Try the held keycard on ${locked.id}.`,
    });
  }

  const nearbyItem = snapshot.looseItems
    .filter((item) => !item.held)
    .sort((a, b) => distance(a.x, a.z) - distance(b.x, b.z))[0];
  if (nearbyItem) {
    if (distance(nearbyItem.x, nearbyItem.z) <= 2.4) {
      candidates.push({ type: "interact", target: nearbyItem.id, narration: `Pick up nearby ${nearbyItem.id}.` });
    } else {
      candidates.push({ type: "move", x: nearbyItem.x, z: nearbyItem.z, pace: "cautious", narration: `Approach ${nearbyItem.id}.` });
    }
  }

  const nearbyDoor = snapshot.doorStates
    .filter((door) => !door.locked && !door.open)
    .sort((a, b) => distance(a.x, a.z) - distance(b.x, b.z))[0];
  if (nearbyDoor) {
    candidates.push(distance(nearbyDoor.x, nearbyDoor.z) <= 2.4
      ? { type: "interact", target: nearbyDoor.id, narration: `Open nearby ${nearbyDoor.id}.` }
      : { type: "move", x: nearbyDoor.x, z: nearbyDoor.z, pace: "normal", narration: `Approach ${nearbyDoor.id}.` });
  }

  candidates.push({ type: "wait", narration: "Pause and reassess the prison state." });
  const seen = new Set([signature(primary)]);
  return candidates.filter((candidate) => {
    const key = signature(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export class TurnController {
  private turn = 0;
  private generation = 0;
  private controller: AbortController | null = null;
  private state: TurnState = "idle";
  private readonly history: TurnMemoryEntry[] = [];
  private memorySummary = "No confirmed lessons yet.";

  constructor(
    private provider: AIProvider,
    private readonly apply: (result: TurnResult) => ActionOutcome,
    private readonly onState: (state: TurnState, detail?: string) => void,
    private readonly onDecision: DecisionUpdate,
  ) {}

  setProvider(provider: AIProvider): boolean {
    if (this.state === "generating" || this.state === "applying") return false;
    this.provider = provider;
    return true;
  }

  get currentState(): TurnState { return this.state; }
  get turnCount(): number { return this.turn; }

  async takeTurn(snapshot: Omit<PrisonSnapshot, "turn" | "history" | "memorySummary">): Promise<void> {
    if (this.state === "generating" || this.state === "applying") return;
    const previous = this.history[this.history.length - 1];
    if (previous?.action.type === "move" && previous.success && !snapshot.prisoner.moving) {
      const remaining = Math.hypot(previous.action.x - snapshot.prisoner.x, previous.action.z - snapshot.prisoner.z);
      if (remaining > 1.5) {
        previous.success = false;
        previous.outcome = `Movement stalled: target was (${previous.action.x.toFixed(1)}, ${previous.action.z.toFixed(1)}), current position is (${snapshot.prisoner.x.toFixed(1)}, ${snapshot.prisoner.z.toFixed(1)}). Re-plan around walls or closed doors.`;
      } else {
        previous.success = true;
        previous.outcome = `Movement reached the target area; current position is (${snapshot.prisoner.x.toFixed(1)}, ${snapshot.prisoner.z.toFixed(1)}).`;
      }
    }
    const turn = this.turn + 1;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.setState("generating", `Ход ${turn}: ${this.provider.name} анализирует память и выбирает действие`);

    try {
      const prompt = buildPrisonerPrompt({
        ...snapshot,
        turn,
        history: this.history.slice(-10),
        memorySummary: this.memorySummary,
      });
      const raw = await this.provider.generate(prompt, controller.signal);
      if (generation !== this.generation || controller.signal.aborted) return;

      const parsedDecision = parsePrisonerDecision(raw);
      const decision = {
        ...parsedDecision,
        alternatives: parsedDecision.alternatives.length
          ? parsedDecision.alternatives
          : fallbackAlternatives(snapshot, parsedDecision.action),
      };
      const failedSignatures = new Set(this.history.filter((entry) => !entry.success).slice(-5).map((entry) => signature(entry.action)));
      let selected = decision.action;
      let repetitionNote = "";
      if (failedSignatures.has(signature(selected))) {
        const alternative = decision.alternatives.find((candidate) => signature(candidate) !== signature(selected) && !failedSignatures.has(signature(candidate)));
        if (alternative) {
          selected = alternative;
          repetitionNote = "Повтор неудачного действия автоматически заменён альтернативой модели.";
        } else {
          selected = { type: "wait", narration: "Я меняю подход и заново оцениваю ситуацию вместо повторения неудачной попытки." };
          repetitionNote = "Повтор неудачного действия заблокирован; выполнено безопасное переосмысление.";
        }
      }

      this.setState("applying", `Ход ${turn}: применение ${selected.type}`);
      const outcome = this.apply({
        turn,
        decision: { ...decision, action: selected },
        action: selected,
        narration: selected.narration,
      });
      const finalOutcome = repetitionNote
        ? { success: outcome.success, summary: `${outcome.summary} ${repetitionNote}` }
        : outcome;

      this.turn = turn;
      this.history.push({
        turn,
        intent: decision.intent,
        action: selected,
        outcome: finalOutcome.summary,
        success: finalOutcome.success,
        memoryUpdate: decision.memoryUpdate,
      });
      while (this.history.length > 30) this.history.shift();
      if (decision.memoryUpdate) {
        this.memorySummary = `${this.memorySummary} ${decision.memoryUpdate}`.trim().slice(-1800);
      }
      this.onDecision({ ...decision, action: selected }, this.history.slice(), this.memorySummary);
      this.setState("idle", `Ход ${turn} завершён · ${finalOutcome.success ? "успех" : "неудача"}`);
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
