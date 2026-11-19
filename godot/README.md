# AIBOX — Godot native runtime

This folder is the native game project. Open it with **Godot 4.7.2 Stable (standard build, not .NET)** using project.godot.

## Current vertical slice

- 3D prison block with solid walls, partitions, reinforced windows and collidable furniture.
- Orthographic camera and cinematic light setup.
- Player warden and prisoner use CharacterBody3D with custom Ara 3D high-detail humanoid GLB models, each with a 65-bone Mixamo-compatible game rig, facial bones and embedded idle/walk/run clips; movement uses acceleration, braking, sprint, floor snapping and move_and_slide().
- Doors use AnimatableBody3D, so their collision moves with the door animation.
- Keycard, wrench and canteen use RigidBody3D; E picks up a nearby item/door and Q drops and throws a held item.
- CCTV cameras rotate gently; characters have procedural walk and idle motion.
- Fullscreen intro and difficulty selection HUD.
- A native AStarGrid2D planner samples real physics colliders and generates safe waypoint chains around walls, furniture and closed doors.
- The native action validator rejects impossible move targets and sends characters along the validated waypoint path.
- Navigation briefing options can be queried for reachable objects, approach points and blocked targets.

## Controls

- WASD / arrow keys: move.
- Shift: sprint.
- E: interact with a door or pick up a nearby item.
- Q: throw/drop the held item.
- Space: toggle alarm.
- F11: toggle fullscreen.

## Run

1. Install Godot 4.7.2 Stable.
2. Install the repository's Node.js development dependencies from the repository root: `npm install`. (This is only for preparing the source models; players do not need Node.js in the packaged game.)
3. Generate the pinned Ara 3D CC0 high-detail character models:
   - Windows: `powershell -ExecutionPolicy Bypass -File .\\godot\\scripts\\generate_characters.ps1`
   - Linux/macOS: `bash godot/scripts/generate_characters.sh`
   The first run clones the pinned generator, downloads the CC0 MakeHuman source library (about 420 MB), and exports two high-detail GLBs with PBR textures, game rigs and animations.
4. Import this folder in the Godot Project Manager (or open project.godot).
4. Press F6/F5 or run the main scene.

The GitHub CI job runs a headless import and short runtime smoke test using the pinned 4.7.2 version.

## Migration status

This is the next native vertical slice, not yet a full replacement of the older TypeScript prototype. Collision-aware route planning and high-detail, photo-textured guard/prisoner models are now present. AI website sessions, vision cones, full guard patrols, inventory/economy parity, saving, and platform exports are still to be ported and validated. Do not remove the reference build until those systems are complete.
