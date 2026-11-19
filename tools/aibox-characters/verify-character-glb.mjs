import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) throw new Error("Usage: verify-character-glb.mjs <model.glb>");
const buffer = await readFile(file);
if (buffer.toString("ascii", 0, 4) !== "glTF" || buffer.readUInt32LE(4) !== 2) {
  throw new Error(`${file}: not a GLB 2.0 file.`);
}
let offset = 12;
let json = null;
while (offset + 8 <= buffer.length) {
  const length = buffer.readUInt32LE(offset);
  const type = buffer.readUInt32LE(offset + 4);
  const chunk = buffer.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8").replace(/\\0+$/g, "").trim());
  offset += 8 + length;
}
if (!json) throw new Error(`${file}: missing JSON chunk.`);
if (!Array.isArray(json.skins) || json.skins.length < 1) throw new Error(`${file}: no humanoid skin/rig found.`);
if (!Array.isArray(json.animations)) throw new Error(`${file}: no animations found.`);
const animations = json.animations.map((animation) => String(animation.name || "").toLowerCase());
for (const required of ["idle", "walk", "run"]) {
  if (!animations.some((name) => name.includes(required))) {
    throw new Error(`${file}: missing ${required} animation. Found: ${animations.join(", ")}`);
  }
}
let triangles = 0;
for (const mesh of json.meshes || []) {
  for (const primitive of mesh.primitives || []) {
    const indices = primitive.indices === undefined ? null : json.accessors?.[primitive.indices];
    const positions = json.accessors?.[primitive.attributes?.POSITION];
    triangles += indices ? Math.floor(indices.count / 3) : positions ? Math.floor(positions.count / 3) : 0;
  }
}
if (triangles < 50000) throw new Error(`${file}: expected high-detail geometry, got only ${triangles} triangles.`);
if (!Array.isArray(json.images) || json.images.length < 2) {
  throw new Error(`${file}: expected embedded photo/PBR textures; found ${json.images?.length ?? 0} image(s).`);
}
console.log(`${file}: GLB 2.0 OK · ${triangles.toLocaleString()} triangles · ${json.skins.length} skin(s) · ${animations.length} animations · ${json.images.length} embedded images.`);
