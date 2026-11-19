# Native character assets

AIBOX uses two character models from the **Ultimate Modular Men Pack** by
[Quaternius](https://quaternius.com/packs/ultimatemodularcharacters.html):

| In-game role | Upstream model | Local file |
|---|---|---|
| Guard | SWAT | `assets/characters/guard_swat.glb` |
| Prisoner | Punk | `assets/characters/prisoner_punk.glb` |

**License:** CC0 1.0 Universal (public-domain dedication). The pack's
license is listed as CC0 in the upstream pack index maintained by
[Quaternius Showcase](https://github.com/trebeljahr/quaternius-showcase/blob/main/LICENSES.md)
under `modular_men_pack`. The showcase's code license does not cover model
assets; the model pack's own CC0 license is the applicable license.

The download scripts pin the upstream repository revision
`0128ca510d653bb04d6d1e4885bd8890b5050b4f` so that CI and local imports fetch the same source files.

Run the asset bootstrap once before opening the project locally:

- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\download_assets.ps1`
- Linux/macOS: `bash scripts/download_assets.sh`

GitHub Actions performs this bootstrap automatically before the Godot import
and smoke test. The model files are generated/downloaded assets and are not
committed as binary files in the source repository.
