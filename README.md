# AIBOX — Prison Control

An asymmetrical prison sandbox: the human player is the warden, while an AI-controlled prisoner gets one prompt per turn to attempt an escape.

> Early prototype. The game includes a local demo provider and an optional local Browser Bridge for ChatGPT, DeepSeek, Qwen, Gemini and Claude. Browser providers require a user-authorized Chromium session.

## Current foundation

The current playable prototype is written in TypeScript and uses Three.js for rendering, Rapier for physics, Vite for the renderer, Electron for Windows desktop packaging and Capacitor for the Android wrapper. This is a custom web-based runtime, not a full visual game-engine editor. The target engine decision is documented in [docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md): Godot 4.7.2 Stable with GDScript. The existing prototype remains intact while the native Godot version is ported system by system.

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
| E | Pick up a nearby item or open/close a nearby unlocked door |
| Q | Throw the item currently held by the guard |
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


## Real browser AI sessions (no API keys)

The game can use a local Playwright companion instead of the demo provider.

1. Install Node.js 22.12 or newer.
2. Clone the repository if you do not already have its source locally:

   ```powershell
   git clone https://github.com/zmlsaggg/AIBOX.git
   ```

3. In PowerShell run the one-command launcher:

   ```powershell
   cd AIBOX
   powershell -ExecutionPolicy Bypass -File .\bridge\Start-Bridge.ps1
   ```

   The script installs the bridge packages and Playwright Chromium if needed, then starts the local service.
4. Copy the value printed after **Pairing token:** into **LOCAL PAIRING TOKEN** in AIBOX. Keep the PowerShell window open while you play.
5. Select a provider and click **CONNECT BROWSER SESSION**. Chromium opens; sign in to that provider manually. Return to AIBOX and click **RUN AI TURN**.
6. To change provider, select another website and click **CONNECT BROWSER SESSION** again.

The bridge uses a dedicated persistent browser profile under `~/.aibox/browser-profile`, not your everyday browser profile. The bridge accepts the Electron app's opaque `file://` origin only when requests include the random pairing token. The first version supports ChatGPT, DeepSeek, Qwen Chat, Gemini and Claude. Website UI selectors can change and may need updates.

**Important:** browser automation does not remove provider quotas, subscription limits, safety rules or CAPTCHAs. A refusal is not treated as a technical failure and is not automatically routed to another model. The player chooses providers manually. Do not use this bridge to automate account creation or evade provider restrictions.


## Desktop and Android builds

AIBOX can be packaged as a Windows desktop app with Electron and as an Android app with Capacitor.

### Windows

```bash
npm install
npm run desktop:build
```

The `release/` directory contains:
- `AIBOX-<version>-Setup-x64.exe` — Windows installer.
- `AIBOX-<version>-Portable-x64.exe` — portable executable.

### Android

The Android wrapper is generated by Capacitor during CI. To build locally, install Android Studio and the Android SDK, then run:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The installable test APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. Debug APKs are for testing and are not Play Store release packages. A production Android release needs a protected signing keystore and signing secrets configured in GitHub.

The Android layout includes an on-screen movement joystick and an interaction button. Desktop keeps keyboard controls.

### Automated GitHub Releases

The workflow `.github/workflows/build-release.yml` builds the Windows installer, portable EXE and Android APK on pull requests and manual runs. Those runs upload downloadable Actions Artifacts.

To publish a versioned GitHub Release with all three binaries attached, push a version tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

The release workflow waits for both platform builds to pass before publishing the release. Tags containing `alpha`, `beta` or `rc` are marked as prereleases.


## Tactical AI decisions and memory

Each browser-provider response now returns a structured decision envelope:
- one **primary action** (the only action executed this turn);
- up to three **alternative actions** shown in the AI cognition panel but not executed;
- a short strategic intent, confidence estimate and memory update.

The turn controller stores up to 30 completed actions and sends the latest 10, their real game outcomes, known facts, item positions, inventory, guard/prisoner positions and door lock/open states into every next prompt. If a provider omits alternatives, the game derives up to three safe, state-aware fallback suggestions without making another model call. A new shift starts with a clean memory because the simulation itself is not yet saved across reloads.

Repeated failed actions are discouraged in the prompt and guarded in code: if the model repeats a recent failed action, the controller selects a distinct valid alternative or falls back to a safe reassessment wait. The next prompt also compares the previous movement target with the actual prisoner position and marks stalled movement as a failure.

Additional AI action capabilities:
- cautious / normal / fast movement orders with A* route planning around known walls, furniture and closed doors;
- inspect nearby props, doors and loose items to collect confirmed facts;
- interact with nearby loose items and unlocked doors;
- use the held keycard on nearby locked checkpoint doors;
- throw a held item toward a selected world coordinate;
- speak to the guard or spend a turn waiting.

Only actions supported by the simulation are advertised. Ventilation and the control terminal are currently inspectable environmental props, not working escape routes or hackable systems. Alternative actions are suggestions for planning; the game still enforces exactly one executed action per prompt.

The AI cognition panel displays the current intent, confidence, alternatives, strategy memory and recent action outcomes. The same browser provider tab is reused; no second provider tab or second model call is required to generate alternatives.
