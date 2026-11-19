# AIBOX — Prison Control

An asymmetrical prison sandbox: the human player is the warden, while an AI-controlled prisoner gets one prompt per turn to attempt an escape.

> Early prototype. The game includes a local demo provider and an optional local Browser Bridge for ChatGPT, DeepSeek, Qwen, Gemini and Claude. Browser providers require a user-authorized Chromium session.

## Current foundation

The original prototype is written in TypeScript and uses Three.js, Rapier, Vite, Electron and Capacitor. It remains available as a reference build, but it is no longer the long-term game architecture. A native Godot 4.7.2 project now lives in [godot/](godot/), using GDScript, CharacterBody3D, AnimatableBody3D and RigidBody3D. The port is underway; release builds will switch to Godot only after gameplay parity is reached. See [docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md).

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

The Windows EXE opens provider websites in dedicated Electron windows. No pairing token, separately installed Node.js, Git clone, PowerShell or Playwright browser installation is required for the player. Electron already contains its own Node runtime; provider cookies and login sessions are saved in app-specific persistent partitions on that PC. The renderer communicates with the main process through a narrow context-isolated preload API. Website UI selectors can change and provider quotas/terms still apply.

The turn controller already has the important cancellation rule: interrupting a prompt invalidates its generation ID. Even if a browser page returns a late response after cancellation, that response is discarded and cannot mutate the game world.

### Native Godot migration

The first native vertical slice is in `godot/`:
- a real 3D prison block with collidable concrete partitions and furniture;
- a CharacterBody3D guard with acceleration, braking, sprinting, collision and procedural gait/idle motion;
- a second physical prisoner body;
- AnimatableBody3D cell and perimeter doors with collision that follows the door animation;
- RigidBody3D keycard, wrench and canteen pickups that can be carried and thrown;
- sweeping CCTV cameras, lighting, a full-screen intro and a readable HUD;
- an allow-listed native AI action validator for movement and waiting.

This is an initial port, not feature parity yet. The next work is navigation/pathfinding, patrols and vision, all door and item interactions, inventory, difficulty rules, camera placement, saved runs, then the native AI provider window/session integration. The TypeScript prototype remains the reference until these systems are ported and tested.

## License

Not yet selected. Check asset licenses before adding external models, textures or sounds.


## Browser AI connections in the Windows game

1. In AIBOX, select ChatGPT, DeepSeek, Qwen, Gemini or Claude.
2. Click **CONNECT AI**. The selected provider opens in an app-owned window.
3. Sign in normally. Close or hide that window when you are done; the login stays saved on this PC.
4. Return to the game and click **RUN AI TURN**.

There is no pairing token. Players do not install Node.js, clone GitHub repositories, run PowerShell or install a second Chromium browser. The packaged Electron runtime contains what the desktop client needs. The separate legacy `bridge/` scripts are developer experiments and are not used by the Windows installer.

The first connection still requires the player to sign in to the chosen website. This does not bypass subscriptions, usage limits, CAPTCHAs, site safety rules or provider terms. Browser website automation is subject to UI changes and may need selector maintenance. The browser AI connection currently belongs to the Windows Electron prototype; it is not yet ported into the native Godot runtime.

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

The workflow `.github/workflows/build-release.yml` builds the Windows installer, portable EXE and Android APK on pull requests and manual runs. Pull requests upload temporary Actions Artifacts. Successful builds on `main` create a normal GitHub Release (not a prerelease) and mark it as **Latest Release** automatically. Stable `v*` tags also create latest releases; tags containing `alpha`, `beta` or `rc` remain prereleases.

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
