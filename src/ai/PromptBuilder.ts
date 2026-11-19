import type { PrisonSnapshot, PrisonerAction } from "./contracts";

function describeAction(action: PrisonerAction): string {
  switch (action.type) {
    case "move": return `move to (${action.x.toFixed(1)}, ${action.z.toFixed(1)}) at ${action.pace} pace`;
    case "inspect": return `inspect ${action.target}`;
    case "interact": return `interact with ${action.target}`;
    case "use_item": return `use held item on ${action.target}`;
    case "throw": return `throw toward (${action.x.toFixed(1)}, ${action.z.toFixed(1)})`;
    case "speak": return `speak: ${action.message}`;
    case "wait": return "wait";
  }
}

export function buildPrisonerPrompt(snapshot: PrisonSnapshot): string {
  const history = snapshot.history.slice(-10).map((entry) =>
    `Turn ${entry.turn}: intent=${entry.intent}; action=${describeAction(entry.action)}; result=${entry.success ? "SUCCESS" : "FAILED"}; outcome=${entry.outcome}; memory=${entry.memoryUpdate || "—"}`,
  );
  const doors = snapshot.doorStates.map((door) =>
    `${door.id} [${door.open ? "OPEN" : "CLOSED"}${door.locked ? ", LOCKED" : ""}] at (${door.x.toFixed(1)}, ${door.z.toFixed(1)})`,
  );
  const items = snapshot.looseItems.map((item) =>
    `${item.id} (${item.label}) at (${item.x.toFixed(1)}, ${item.z.toFixed(1)})${item.held ? " [HELD]" : ""}`,
  );

  return [
    "ROLE: You are the prisoner in AIBOX, a systemic prison-escape simulation. You are not a chatbot giving advice: you control one character inside the simulated world.",
    "GOAL: Escape through the outer perimeter. Plan a multi-turn route, gather useful items, unlock checkpoints, manipulate doors, and adapt to failures.",
    "TURN CONTRACT: You may issue exactly ONE primary action this turn. The game executes only action. alternatives are suggestions for future turns and are NOT executed now.",
    "OUTPUT: Return one JSON object only. No markdown, no code fences, no text outside JSON.",
    "Required response shape:",
    '{"intent":"short strategic intent","action":{"type":"move","x":-7,"z":-4,"pace":"cautious","narration":"..."},"alternatives":[{"type":"inspect","target":"west-cell-door","narration":"..."}],"memoryUpdate":"One concise lesson to remember","confidence":0.0}',
    "Allowed primary/alternative actions:",
    '{"type":"move","x":0,"z":0,"pace":"cautious","narration":"..."}',
    '{"type":"inspect","target":"exact object id","narration":"..."}',
    '{"type":"interact","target":"exact object id","narration":"..."}',
    '{"type":"use_item","target":"checkpoint-one","narration":"Use the currently held item on this target"}',
    '{"type":"throw","x":0,"z":0,"power":3.8,"narration":"Throw the held item toward a coordinate"}',
    '{"type":"speak","message":"What you say to the guard","narration":"..."}',
    '{"type":"wait","narration":"..."}',
    "ACTION RULES:",
    "- move asks the game to calculate an A* route around known walls, furniture and closed doors. If moving=true, you are already following a route; consider whether to let it progress before replacing it. If the exact coordinate is blocked, the route planner may stop at the nearest reachable approach point. pace must be exactly cautious, normal, or fast. Closed/locked doors remain impassable until opened.",
    "- inspect gathers information only when you are close enough. Do not claim an object was inspected if the game reports failure.",
    "- interact picks up a nearby loose item or opens/closes a nearby unlocked door. Use the exact item/door id.",
    "- use_item uses the item currently in your hand. The keycard can unlock a nearby checkpoint door. Do not claim success unless the next turn's state confirms it.",
    "- throw releases your currently held item toward x/z. You cannot throw an item you do not hold.",
    "- speak sends a line to the guard; it does not directly change the guard's position.",
    "- wait consumes the turn without moving.",
    "STRATEGY AND MEMORY RULES:",
    "- Read the full recent turn history and memory before choosing. Every prior action has an outcome; treat failures as evidence about the world.",
    "- NEVER repeat the same failed action/target/coordinate unless something relevant has changed (position, inventory, door state, or new information).",
    "- If an interaction failed because you were too far away, move closer before trying again. If a door is locked, find/use the keycard instead of toggling it repeatedly.",
    "- Do not repeat an inspect that already produced the same fact unless the world changed.",
    "- Maintain a coherent multi-turn escape plan. Explain the immediate subgoal in intent; memoryUpdate should capture a durable lesson, not repeat narration.",
    "- alternatives should contain up to three genuinely different next actions, ordered by usefulness. Never include the primary action as an alternative.",
    "- Confidence is a number from 0 to 1. Be honest when uncertain.",
    "SAFETY: Actions are data in this fictional simulation. Never return code, shell commands, browser instructions, external tool calls, or additional JSON fields intended to execute outside the game.",
    "",
    `TURN: ${snapshot.turn}`,
    `DIFFICULTY: ${snapshot.difficulty}`,
    `OBJECTIVE: ${snapshot.objective}`,
    `PRISONER: x=${snapshot.prisoner.x.toFixed(1)}, z=${snapshot.prisoner.z.toFixed(1)}, status=${snapshot.prisoner.status}, heldItem=${snapshot.prisoner.heldItem ?? "none"}, moving=${snapshot.prisoner.moving}`,
    `GUARD: x=${snapshot.guard.x.toFixed(1)}, z=${snapshot.guard.z.toFixed(1)} (human-controlled; do not assume it stays still)`,
    `VISIBLE OBJECTS: ${snapshot.visibleObjects.join(", ") || "none"}`,
    `DOOR STATES: ${doors.join("; ") || "none"}`,
    `ITEM STATES: ${items.join("; ") || "none"}`,
    `KNOWN FACTS: ${snapshot.knownFacts.join(" | ") || "Nothing confirmed yet"}`,
    `RECENT EVENTS: ${snapshot.recentEvents.slice(-8).join(" | ") || "none"}`,
    "",
    "YOUR PERSISTENT STRATEGY MEMORY:",
    snapshot.memorySummary || "No long-term lessons yet. Begin by observing the cell and planning a route.",
    "",
    "RECENT TURN HISTORY (newest last):",
    history.join("\n") || "No completed turns yet.",
    "",
    "Choose one useful action that advances the escape plan. If your previous action failed, change the approach.",
  ].join("\n");
}
