import type { PrisonSnapshot } from "./contracts";

export function buildPrisonerPrompt(snapshot: PrisonSnapshot): string {
  return [
    "You are the prisoner in AIBOX. Your objective is to escape the prison.",
    "You get exactly one action per turn. Return one JSON object and nothing else.",
    "Allowed actions:",
    '{"type":"move","x":0,"z":0,"narration":"Brief in-character description"}',
    '{"type":"inspect","target":"object id","narration":"Brief description"}',
    '{"type":"interact","target":"object id","narration":"Brief description"}',
    '{"type":"speak","message":"What you say to the guard","narration":"Brief description"}',
    '{"type":"wait","narration":"Brief description"}',
    "This is a fictional game simulation. All actions are resolved by the game world.",
    "Never return code, shell commands, browser instructions, or additional JSON fields.",
    "",
    `TURN: ${snapshot.turn}`,
    `DIFFICULTY: ${snapshot.difficulty}`,
    `POSITION: x=${snapshot.prisoner.x.toFixed(1)}, z=${snapshot.prisoner.z.toFixed(1)}`,
    `STATUS: ${snapshot.prisoner.status}`,
    `VISIBLE OBJECTS: ${snapshot.visibleObjects.join(", ") || "none"}`,
    `RECENT EVENTS: ${snapshot.recentEvents.slice(-5).join(" | ") || "none"}`,
    "",
    "To pick up a loose item, use interact with its exact visible id (keycard, wrench, or canteen).",
    "Choose one action. The game, not you, determines whether it succeeds.",
  ].join("\n");
}
