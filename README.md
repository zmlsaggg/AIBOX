# AIBOX — Prison Control

An asymmetrical prison sandbox: the human player is the warden, while an AI-controlled prisoner gets one prompt per turn to attempt an escape.

> Early prototype. The current browser build uses a local demo AI provider; it does not yet connect to ChatGPT, DeepSeek, Qwen or Arena.

## Current foundation

- Top-down 3D prison scene with an orthographic camera.
- Smooth placeholder 3D guard/prisoner characters.
- Rapier physics for character movement and collision against walls and doors.
- Warden controls: WASD / arrow keys, E to operate a nearby door, Space for the alarm.
- Difficulty selection screen and starter budgets.
- Starter purchases: surveillance camera markers, additional guard NPCs and prompt-interrupt charges.
- One-prompt/one-turn AI contract, strict JSON action parser and interruptible turn controller.
- AI output is treated as untrusted data. The game only accepts explicit action types and never evaluates model text as code.

## Run locally

Requirements: Node.js 22.12 or newer (matches the `engines` field in `package.json`).

```bash
npm install
npm run dev
```

Production build:

```bash
npm run typecheck
npm run build
npm run preview
```

## Controls

| Input | Action |
|---|---|
| W / A / S / D or arrow keys | Move the warden |
| E | Open/close a nearby door |
| Space | Trigger the alarm |
| Overview / Cell Cam | Change the top-down camera preset |
| Run AI Turn | Run one local demo prompt |
| Delete | Cancel an in-flight prompt (if a charge is available) |

## Architecture

```text
src/
  ai/
    contracts.ts       Provider/action contracts
    PromptBuilder.ts   One-turn prisoner prompt
    ActionParser.ts    Strict allow-listed action parser
    TurnController.ts  Generation lifecycle + interrupt invalidation
    DemoProvider.ts    Local test provider
  game/
    Character.ts       Physics-backed character controller
    PrisonLayout.ts    Walls, doors and props
    Game.ts            Simulation, guard controls, economy and events
  main.ts              Control-room UI
  style.css            Visual system
```

### Planned browser provider layer

Real no-API-key website adapters should live behind the `AIProvider` interface. A separate local Playwright bridge can attach to a user-authorized browser session and return the final assistant message to the game over a localhost-only channel. Keep that bridge separate from the simulation.

The turn controller already has the important cancellation rule: interrupting a prompt invalidates its generation ID. Even if a browser page returns a late response after cancellation, that response is discarded and cannot mutate the game world.

### Planned next milestones

1. Replace placeholder humanoids with licensed/open-source rigged GLB characters and add walk cycles.
2. Add real patrol navigation, guard AI, vision cones, cameras, sensors and alarm validation.
3. Implement distinct prison layouts and difficulty modifiers (not just different labels/budgets).
4. Add the local Playwright bridge and provider adapters, with explicit user login and per-site selectors.
5. Add a finite item catalogue for in-world object creation; never execute arbitrary code emitted by an AI.
6. Persist runs, events, budgets and escape summaries.

## License

Not yet selected. Check asset licenses before adding external models, textures or sounds.
