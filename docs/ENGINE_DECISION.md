# AIBOX engine decision

**Decision:** Godot 4.7.2 Stable, using GDScript for the native game client.

**Status:** target architecture selected; the current TypeScript/Three.js prototype is not being deleted or replaced in this change.

## Why Godot

AIBOX is a small-team, top-down 3D prison simulation. Its requirements are an editor with scenes and reusable nodes, a built-in 3D renderer, physics, animation, UI, desktop export and Android export. Godot provides those tools in one editor and supports Windows and Android export. Godot is open source under the MIT license; the engine does not impose a revenue royalty. Use the stable 4.7.2 release for the migration baseline, not a 4.8 development snapshot.

## Why not the other candidates

- **Unity:** capable and has a large asset ecosystem, but it adds more platform and licensing surface than this prototype needs. Unity Personal eligibility in 2026 is capped at US$200,000 in revenue and funding over the prior 12 months; above that, the Pro tier applies.
- **Unreal Engine 5:** excellent for high-end 3D and visual scripting, but its editor and rendering pipeline are heavier than required for a compact isometric prison game. Game royalty terms apply above the stated US$1 million gross-product-revenue threshold.
- **GameMaker:** strong for 2D, but AIBOX is a 3D simulation with physics-driven characters, doors, props and cameras.
- **Godot:** the best fit for a focused indie-scale 3D project that needs desktop and mobile deployment without an engine royalty.

## Target architecture

- **Engine/editor:** Godot 4.7.2 Stable.
- **Gameplay language:** GDScript. Keep gameplay, scene orchestration, interactions, animation and UI inside the Godot project.
- **Rendering:** Godot 3D renderer with an angled orthographic camera and baked/real-time lighting chosen for the target hardware.
- **Physics:** Godot physics bodies, collision shapes, raycasts and areas. Do not keep Rapier as a second physics authority after the port.
- **AI integration:** retain the local Browser Bridge as a separate localhost service initially. Port the AI action contracts, validation and turn controller to GDScript; communicate with the bridge through Godot's HTTPRequest API.
- **Builds:** Godot export templates for Windows and Android. Keep the current GitHub Actions releases until the Godot exports have feature parity.

## Migration policy

1. Preserve the current TypeScript build as a runnable reference while Godot project scaffolding is added separately.
2. Port the prison layout, door states and collision first; validate movement and camera scale before porting AI.
3. Port the guard/prisoner controllers, pickup/drop interactions and animations.
4. Port budgets, cameras, alarms, difficulty modifiers and the control-room UI.
5. Port the AI contracts and strict action parser; connect to the existing local Browser Bridge.
6. Run gameplay parity tests and compare screenshots/performance on the same Windows and Android devices.
7. Only switch the default release workflow to Godot after the native project builds and passes those checks.

No source files from the current prototype should be deleted as part of the initial Godot migration.

## References

- [Godot 4.7.2 stable release and platform downloads](https://godotengine.org/download/archive/4.7.2-stable/)
- [Godot license](https://godotengine.org/license/)
- [Godot feature list](https://docs.godotengine.org/en/stable/about/list_of_features.html)
- [Unity Personal eligibility and pricing](https://unity.com/products/pricing-updates)
- [Unreal Engine licensing](https://www.unrealengine.com/license)
