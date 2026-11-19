import type { PrisonerAction } from "./contracts";

const MAX_TEXT = 600;
const MAX_COORDINATE = 15;

function shortText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid or missing "${field}"`);
  }
  return value.trim().slice(0, MAX_TEXT);
}

/**
 * Accepts only the small, explicit game-action schema.
 * Model output is data: it is never evaluated as code or passed to the shell.
 */
export function parsePrisonerAction(raw: string): PrisonerAction {
  let candidate = raw.trim();
  candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a JSON action.");

  const value: unknown = JSON.parse(candidate.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Action must be a JSON object.");
  }

  const data = value as Record<string, unknown>;
  const narration = shortText(data.narration, "narration");

  switch (data.type) {
    case "move": {
      const x = data.x;
      const z = data.z;
      if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) {
        throw new Error("Move coordinates must be finite JSON numbers.");
      }
      return {
        type: "move",
        x: Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, x)),
        z: Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, z)),
        narration,
      };
    }
    case "inspect":
      return { type: "inspect", target: shortText(data.target, "target"), narration };
    case "interact":
      return { type: "interact", target: shortText(data.target, "target"), narration };
    case "speak":
      return { type: "speak", message: shortText(data.message, "message"), narration };
    case "wait":
      return { type: "wait", narration };
    default:
      throw new Error("Unsupported action type.");
  }
}
