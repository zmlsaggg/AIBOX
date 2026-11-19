# Native character assets

AIBOX generates its guard and prisoner models with **Ara 3D Gen** from the
[TuriaArt/3d-gen-TU](https://github.com/TuriaArt/3d-gen-TU) project, pinned to
commit `3d78dcad462feeeb64db7fe667a7c34105a10a45`.

| In-game role | Generated preset |
|---|---|
| Warden / guards | AIBOX Warden — photo-based skin, high-detail geometry, navy security uniform, boots and utility belt |
| Prisoner | AIBOX Prisoner — photo-based skin, high-detail geometry, orange prison uniform and boots |

The export uses Ara's high-detail mode (the generator documents approximately
100,000–120,000 triangles), the 65-bone Mixamo-compatible game rig plus facial
bones, and embedded idle, walk, run, reverse-walk, crouch, jump, punch and hit
animations. GLB exports contain PBR textures and normal maps.

**Licensing:** Ara 3D Gen's source code is MIT-licensed. The character data
(base mesh, morph targets, MakeHuman skeleton, skins, hair and clothing) is
derived from MakeHuman and explicitly released as **CC0 1.0 Universal**.
The generator documents exported characters as usable in commercial and
non-commercial projects without attribution. See the upstream
`scripts/ASSETS_LICENSE.txt` and
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The first asset preparation downloads the pinned generator and its CC0
MakeHuman source data (about 420 MB), builds the runtime asset library, and
exports the two GLBs. These generated files remain ignored build artifacts;
CI regenerates and validates them before importing the Godot project.

Run locally:

- Windows: `powershell -ExecutionPolicy Bypass -File .\godot\scripts\generate_characters.ps1`
- Linux/macOS: `bash godot/scripts/generate_characters.sh`
