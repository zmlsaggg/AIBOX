# Native character assets

AIBOX uses two rigged humanoid models from the **Tevy CC0 People** collection:

| In-game role | Model | Local file | Geometry |
|---|---|---|---|
| Warden / guards | [Dog Walker](https://tevy.dev/models/dog-walker) — older male character in a dark waxed-look jacket, trousers, leather shoes and cap | `assets/characters/guard_dog_walker.glb` | 27,997 triangles; 56-bone rig |
| Prisoner | [Casual Walker](https://tevy.dev/models/casual-walker) — young man in a grey hoodie, jeans and white trainers | `assets/characters/prisoner_casual_walker.glb` | 27,997 triangles; 56-bone rig |

Both models include four looping animation clips: `idle`, `walk`, `wave` and `look_around`.
The models are approximately 1.75–1.79 m tall, face +Z, and have their origins between the feet.

**License:** CC0 1.0 Universal. The publisher's model pages and manifest identify both files as CC0 1.0; no attribution is required, including in commercial games.

Pinned immutable v1 download URLs:

- Guard: `https://tevy.dev/models/dog-walker/v1/lod0.glb`
- Prisoner: `https://tevy.dev/models/casual-walker/v1/lod0.glb`

The bootstrap scripts validate both exact byte sizes and SHA-256 hashes before making the files available to Godot. This avoids silently accepting an HTML error page or changed upstream model.

Run the asset bootstrap once before opening the project locally:

- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\download_assets.ps1`
- Linux/macOS: `bash scripts/download_assets.sh`

GitHub Actions performs this bootstrap automatically before Godot import and animation smoke tests. Model files are downloaded assets, not committed binary files.
