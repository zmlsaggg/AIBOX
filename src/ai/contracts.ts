export type PrisonDifficulty = "standard" | "strict" | "special" | "black-dolphin";
export type MovementPace = "cautious" | "normal" | "fast";

export interface PrisonDoorState {
  id: string;
  open: boolean;
  locked: boolean;
  x: number;
  z: number;
}

export interface PrisonItemState {
  id: string;
  label: string;
  x: number;
  z: number;
  held: boolean;
}

export interface NavigationOption {
  id: string;
  kind: "item" | "door" | "area";
  label: string;
  targetX: number;
  targetZ: number;
  approachX: number;
  approachZ: number;
  distance: number;
  reachesTarget: boolean;
  locked: boolean;
  route: Array<{ x: number; z: number }>;
}

export interface NavigationSnapshot {
  reachable: NavigationOption[];
  blocked: Array<{ id: string; kind: "item" | "door"; label: string; reason: string; locked: boolean }>;
  freeAreas: NavigationOption[];
}

export interface TurnMemoryEntry {
  turn: number;
  intent: string;
  action: PrisonerAction;
  outcome: string;
  success: boolean;
  memoryUpdate: string;
}

export interface PrisonSnapshot {
  turn: number;
  difficulty: PrisonDifficulty;
  prisoner: { x: number; z: number; status: string; heldItem: string | null; moving: boolean };
  guard: { x: number; z: number };
  visibleObjects: string[];
  doorStates: PrisonDoorState[];
  looseItems: PrisonItemState[];
  /** Server-computed routes using the current collision and door state. */
  navigation?: NavigationSnapshot;
  knownFacts: string[];
  objective: string;
  recentEvents: string[];
  history: TurnMemoryEntry[];
  memorySummary: string;
}

export type PrisonerAction =
  | { type: "move"; x: number; z: number; pace: MovementPace; narration: string }
  | { type: "inspect"; target: string; narration: string }
  | { type: "interact"; target: string; narration: string }
  | { type: "use_item"; target: string; narration: string }
  | { type: "throw"; x: number; z: number; power: number; narration: string }
  | { type: "speak"; message: string; narration: string }
  | { type: "wait"; narration: string };

export interface PrisonerDecision {
  intent: string;
  action: PrisonerAction;
  alternatives: PrisonerAction[];
  memoryUpdate: string;
  confidence: number;
}

export interface ActionOutcome {
  success: boolean;
  summary: string;
  /** Actual reachable endpoint when a blocked requested move was resolved to a safe approach point. */
  resolvedMoveTarget?: { x: number; z: number };
}

export interface AIProvider {
  readonly name: string;
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}

export interface TurnResult {
  turn: number;
  decision: PrisonerDecision;
  action: PrisonerAction;
  narration: string;
}
