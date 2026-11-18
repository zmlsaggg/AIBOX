export type PrisonDifficulty = "standard" | "strict" | "special" | "black-dolphin";

export interface PrisonSnapshot {
  turn: number;
  difficulty: PrisonDifficulty;
  prisoner: { x: number; z: number; status: string };
  visibleObjects: string[];
  recentEvents: string[];
}

export type PrisonerAction =
  | { type: "move"; x: number; z: number; narration: string }
  | { type: "inspect"; target: string; narration: string }
  | { type: "interact"; target: string; narration: string }
  | { type: "speak"; message: string; narration: string }
  | { type: "wait"; narration: string };

export interface AIProvider {
  readonly name: string;
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}

export interface TurnResult {
  turn: number;
  action: PrisonerAction;
  narration: string;
}
