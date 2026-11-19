import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";

const assetDirectory = path.resolve(process.argv[2] ?? "godot/assets/characters");
const assets = [
  "guard_dog_walker.glb",
  "prisoner_casual_walker.glb",
];

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

await mkdir(assetDirectory, { recursive: true });

for (const name of assets) {
  const outputPath = path.join(assetDirectory, name);
  const sourcePath = path.join(assetDirectory, name.replace(/\.glb$/i, ".source.glb"));

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Missing downloaded source model: ${sourcePath}`);
  }

  const document = await io.read(sourcePath);
  const usedBefore = document.getRoot().listExtensionsUsed().map((extension) => extension.extensionName);
  const meshoptExtension = document.getRoot().listExtensionsUsed()
    .find((extension) => extension instanceof EXTMeshoptCompression || extension.extensionName === "EXT_meshopt_compression");

  // NodeIO + MeshoptDecoder have already expanded the compressed buffer views.
  // Remove the extension metadata and convert quantized accessors back to core glTF
  // component formats so Godot's built-in importer can read the resulting GLB.
  if (meshoptExtension) meshoptExtension.dispose();
  await document.transform(dequantize());

  const remaining = document.getRoot().listExtensionsUsed().map((extension) => extension.extensionName);
  const unsupported = remaining.filter((extensionName) =>
    extensionName === "EXT_meshopt_compression" || extensionName === "KHR_mesh_quantization"
  );
  if (unsupported.length) {
    throw new Error(`${name}: unsupported compression extensions remain: ${unsupported.join(", ")}`);
  }

  await io.write(outputPath, document);

  // Read the written output again without relying on MeshoptDecoder to prove it is
  // a regular GLB with the humanoid scene/animations preserved.
  const validation = await io.read(outputPath);
  const animationCount = validation.getRoot().listAnimations().length;
  const skinCount = validation.getRoot().listSkins().length;
  if (skinCount < 1) throw new Error(`${name}: dequantized GLB lost its humanoid skin.`);
  if (animationCount < 2) throw new Error(`${name}: expected idle/walk animations; got ${animationCount}.`);

  console.log(
    `${name}: converted to standard GLB; skins=${skinCount}, animations=${animationCount}, ` +
    `sourceExtensions=[${usedBefore.join(", ")}].`
  );
}
