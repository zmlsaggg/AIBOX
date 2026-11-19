# AIBOX — Godot native runtime

This folder is the native game project. Open it with **Godot 4.7.2 Stable (standard build, not .NET)** using project.godot.

## Current vertical slice

- 3D prison block with solid walls, partitions, reinforced windows and collidable furniture.
- Orthographic camera and cinematic light setup.
- Player warden and prisoner use CharacterBody3D; movement uses acceleration, braking, sprint, floor snapping and move_and_slide().
- Doors use AnimatableBody3D, so their collision moves with the door animation.
- Keycard, wrench and canteen use RigidBody3D; E picks up a nearby item/door and Q drops and throws a held item.
- CCTV cameras rotate gently; characters have procedural walk and idle motion.
- Fullscreen intro and difficulty selection HUD.
- A strict native action validator accepts safe move/wait JSON actions.

## Controls

- WASD / arrow keys: move.
- Shift: sprint.
- E: interact with a door or pick up a nearby item.
- Q: throw/drop the held item.
- Space: toggle alarm.
- F11: toggle fullscreen.

## Run

1. Install Godot 4.7.2 Stable.
2. Import this folder in the Godot Project Manager (or open project.godot).
3. Press F6/F5 or run the main scene.

The GitHub CI job runs a headless import and short runtime smoke test using the pinned 4.7.2 version.

## Migration status

This is the first native vertical slice, not yet a full replacement of the older TypeScript prototype. AI website sessions, A* navigation, vision cones, full guard patrols, inventory/economy parity, saving, and platform exports are still to be ported and validated. Do not remove the reference build until those systems are complete.
