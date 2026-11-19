import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const generatorRoot = path.resolve(option("generator", ".aibox-ara3d"));
const paramsPath = path.resolve(option("params", ""));
const outputPath = path.resolve(option("out", ""));
if (!paramsPath || !outputPath) {
  throw new Error("Usage: export-character.ts --generator <ara-root> --params <json> --out <model.glb>");
}

const [paramsModule, humanModule, assetsModule, planModule, exportModule, meshModule] = await Promise.all([
  import(pathToFileURL(path.join(generatorRoot, "src/core/params.ts")).href),
  import(pathToFileURL(path.join(generatorRoot, "src/core/human.ts")).href),
  import(pathToFileURL(path.join(generatorRoot, "scripts/node-assets.ts")).href),
  import(pathToFileURL(path.join(generatorRoot, "src/export/plan.ts")).href),
  import(pathToFileURL(path.join(generatorRoot, "src/export/index.ts")).href),
  import(pathToFileURL(path.join(generatorRoot, "src/core/mesh.ts")).href),
]);

const raw = JSON.parse(await readFile(paramsPath, "utf8"));
const params = {
  ...paramsModule.DEFAULT_PARAMS,
  ...raw,
  detail: "high",
  rig: "game",
  faceBones: true,
  restPose: "T",
  animations: true,
};
const library = await assetsModule.nodeLibrary();
console.log(`Building ${params.name} with Ara 3D Gen high-detail assets...`);
const character = await humanModule.buildHuman(library, params);
const settings = {
  mode: "animated",
  format: "glb",
  clips: ["idle", "walk", "run", "walk_back", "crouch", "jump", "punch", "hit"],
  packaging: "embedded",
  clipMesh: false,
  rootMotion: false,
  loopSuffix: true,
  weaponFile: "held",
};
const plan = planModule.planExport(character, settings);
const file = await exportModule.runExport(library, character, plan);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, file.data);
console.log(
  `${params.name}: height=${character.height.toFixed(2)}m; ` +
  `triangles=${meshModule.triangleCount(character.mesh)}; ` +
  `materials=${character.mesh.materials.length}; bones=${character.rig?.bones.length ?? 0}; ` +
  `animations=${settings.clips.join(", ")}; output=${outputPath}`
);
