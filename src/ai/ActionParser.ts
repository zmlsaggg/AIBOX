import type { MovementPace, PrisonerAction, PrisonerDecision } from "./contracts";

const MAX_TEXT = 600;
const MAX_COORDINATE = 15;

function shortText(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid or missing "${field}"`);
  }
  return value.trim().slice(0, max);
}

function coordinate(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`"${field}" must be a finite JSON number.`);
  }
  return Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value));
}

function parseActionValue(value: unknown): PrisonerAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Action must be a JSON object.");
  }
  const data = value as Record<string, unknown>;
  const narration = shortText(data.narration, "narration");
  switch (data.type) {
    case "move": {
      const pace = data.pace === undefined ? "normal" : data.pace;
      if (pace !== "cautious" && pace !== "normal" && pace !== "fast") {
        throw new Error("Move pace must be cautious, normal, or fast.");
      }
      return { type: "move", x: coordinate(data.x, "x"), z: coordinate(data.z, "z"), pace: pace as MovementPace, narration };
    }
    case "inspect":
      return { type: "inspect", target: shortText(data.target, "target"), narration };
    case "interact":
      return { type: "interact", target: shortText(data.target, "target"), narration };
    case "use_item":
      return { type: "use_item", target: shortText(data.target, "target"), narration };
    case "throw": {
      const power = data.power === undefined ? 3.8 : data.power;
      if (typeof power !== "number" || !Number.isFinite(power)) throw new Error('"power" must be a finite JSON number.');
      return {
        type: "throw",
        x: coordinate(data.x, "x"),
        z: coordinate(data.z, "z"),
        power: Math.max(1.2, Math.min(6, power)),
        narration,
      };
    }
    case "speak":
      return { type: "speak", message: shortText(data.message, "message"), narration };
    case "wait":
      return { type: "wait", narration };
    default:
      throw new Error("Unsupported action type.");
  }
}

function parseObject(raw: string): Record<string, unknown> {
  let candidate = raw.trim();
  candidate = candidate.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a JSON decision.");
  const value: unknown = JSON.parse(candidate.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Decision must be a JSON object.");
  return value as Record<string, unknown>;
}

/** Parses one primary action plus optional alternatives. Only the primary action is ever executed. */
export function parsePrisonerDecision(raw: string): PrisonerDecision {
  const data = parseObject(raw);
  const wrapped = data.action !== undefined;
  const action = parseActionValue(wrapped ? data.action : data);
  const alternatives: PrisonerAction[] = [];
  if (Array.isArray(data.alternatives)) {
    for (const candidate of data.alternatives.slice(0, 3)) {
      try {
        alternatives.push(parseActionValue(candidate));
      } catch {
        // An invalid optional suggestion must not invalidate the primary action.
      }
    }
  }
  const confidence = typeof data.confidence === "number" && Number.isFinite(data.confidence)
    ? Math.max(0, Math.min(1, data.confidence))
    : 0.65;
  return {
    intent: typeof data.intent === "string" ? data.intent.trim().slice(0, 240) : "Продолжает план побега",
    action,
    alternatives,
    memoryUpdate: typeof data.memoryUpdate === "string" ? data.memoryUpdate.trim().slice(0, 500) : "",
    confidence,
  };
}

/** Backwards-compatible action-only parser for existing integrations and tests. */
export function parsePrisonerAction(raw: string): PrisonerAction {
  return parsePrisonerDecision(raw).action;
}
