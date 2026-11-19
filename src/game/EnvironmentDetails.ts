import * as THREE from "three";

/** Wall-mounted prison details. These are visual-only so existing Rapier wall colliders stay authoritative. */
export class EnvironmentDetails {
  private readonly steel = new THREE.MeshStandardMaterial({ color: 0x68777a, metalness: 0.78, roughness: 0.42 });
  private readonly darkSteel = new THREE.MeshStandardMaterial({ color: 0x202a2c, metalness: 0.62, roughness: 0.55 });
  private readonly glass = new THREE.MeshStandardMaterial({ color: 0x71878a, roughness: 0.24, metalness: 0.08, transparent: true, opacity: 0.32 });
  private readonly concrete = new THREE.MeshStandardMaterial({ color: 0x455256, roughness: 0.94 });
  private readonly rotatingFans: THREE.Group[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.addNorthWindow(-8.7, 1.72, 2.25);
    this.addNorthWindow(7.8, 1.72, 2.25);
    this.addWestWindow(-11.76, 1.78, -4.25, 1.9);
    this.addVent(2.15, 2.05, -8.76, false);
    this.addVent(11.76, 1.98, 2.1, true);
    this.addPipeX(-3.1, 2.25, -8.62, 5.8);
    this.addPipeX(5.1, 2.25, -8.62, 4.2);
    this.addPipeZ(-11.72, 2.24, -1.1, 6.8);
    this.addCableTray(-11.7, 2.42, -1.2, 7.5);
    this.addRadiator(-11.68, 0.55, 0.9);
    this.addLocker(10.75, 0.92, 6.7);
  }

  update(delta: number): void {
    for (const fan of this.rotatingFans) fan.rotation.z += delta * 2.1;
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (parent ?? this.scene).add(mesh);
    return mesh;
  }

  private addNorthWindow(x: number, y: number, width: number): void {
    const z = -8.755;
    this.box(x, y, z, width + 0.2, 1.05, 0.09, this.darkSteel);
    this.box(x, y, z + 0.052, width, 0.86, 0.018, this.glass);
    for (const side of [-1, 1]) this.box(x + side * (width / 2 + 0.035), y, z + 0.075, 0.075, 1.12, 0.12, this.steel);
    for (const side of [-1, 1]) this.box(x, y + side * 0.51, z + 0.075, width + 0.12, 0.075, 0.12, this.steel);
    const bars = Math.max(5, Math.floor(width * 3));
    for (let i = 0; i < bars; i += 1) {
      const barX = x - width * 0.42 + (i / (bars - 1)) * width * 0.84;
      this.box(barX, y, z + 0.12, 0.035, 0.94, 0.055, this.steel);
    }
    this.box(x, y, z + 0.13, width, 0.035, 0.06, this.steel);
  }

  private addWestWindow(x: number, y: number, z: number, height: number): void {
    this.box(x, y, z, 0.09, height + 0.18, 1.8, this.darkSteel);
    this.box(x - 0.052, y, z, 0.018, height, 1.62, this.glass);
    for (const side of [-1, 1]) this.box(x - 0.075, y, z + side * 0.88, 0.12, height + 0.2, 0.075, this.steel);
    for (const side of [-1, 1]) this.box(x - 0.075, y + side * (height / 2 + 0.04), z, 0.12, 0.075, 1.85, this.steel);
    for (let i = 0; i < 6; i += 1) {
      const barZ = z - 0.68 + i * 0.272;
      this.box(x - 0.12, y, barZ, 0.06, height + 0.04, 0.035, this.steel);
    }
  }

  private addVent(x: number, y: number, z: number, onRightWall: boolean): void {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    if (onRightWall) root.rotation.y = Math.PI / 2;
    this.scene.add(root);
    this.box(0, 0, 0, 0.98, 0.62, 0.08, this.darkSteel, root);
    this.box(0, 0, 0.05, 0.84, 0.48, 0.025, this.concrete, root);
    for (let i = 0; i < 7; i += 1) this.box(0, -0.2 + i * 0.066, 0.085, 0.82, 0.025, 0.035, this.steel, root);
    for (const side of [-1, 1]) this.box(side * 0.43, 0, 0.09, 0.045, 0.58, 0.045, this.steel, root);
    const rotor = new THREE.Group();
    rotor.position.set(0, 0, 0.17);
    root.add(rotor);
    for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.025), this.steel);
      blade.position.y = 0.13;
      blade.rotation.z = (bladeIndex * Math.PI) / 2;
      blade.castShadow = true;
      rotor.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), this.darkSteel);
    hub.castShadow = true;
    rotor.add(hub);
    this.rotatingFans.push(rotor);
  }

  private addPipeX(x: number, y: number, z: number, length: number): void {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, length, 12), this.steel);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(x, y, z);
    pipe.castShadow = true;
    this.scene.add(pipe);
    for (const offset of [-length * 0.38, 0, length * 0.38]) {
      this.box(x + offset, y - 0.13, z, 0.08, 0.28, 0.16, this.darkSteel);
    }
  }

  private addPipeZ(x: number, y: number, z: number, length: number): void {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, length, 12), this.steel);
    pipe.position.set(x, y, z);
    pipe.castShadow = true;
    this.scene.add(pipe);
    for (const offset of [-length * 0.38, 0, length * 0.38]) {
      this.box(x + 0.12, y, z + offset, 0.28, 0.08, 0.08, this.darkSteel);
    }
  }

  private addCableTray(x: number, y: number, z: number, length: number): void {
    this.box(x, y, z, 0.12, 0.12, length, this.darkSteel);
    for (let i = 0; i < 3; i += 1) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, length, 8), new THREE.MeshStandardMaterial({ color: [0x8a6247, 0x3d7774, 0x777d80][i], roughness: 0.8 }));
      cable.rotation.x = Math.PI / 2;
      cable.position.set(x + (i - 1) * 0.035, y - 0.055, z);
      this.scene.add(cable);
    }
  }

  private addRadiator(x: number, y: number, z: number): void {
    this.box(x, y, z, 0.16, 0.76, 1.65, this.darkSteel);
    for (let i = 0; i < 9; i += 1) {
      this.box(x + 0.1, y, z - 0.72 + i * 0.18, 0.12, 0.68, 0.11, this.steel);
    }
    this.box(x + 0.12, y + 0.4, z - 0.72, 0.28, 0.06, 0.08, this.darkSteel);
    this.box(x + 0.12, y - 0.4, z + 0.72, 0.28, 0.06, 0.08, this.darkSteel);
  }

  private addLocker(x: number, y: number, z: number): void {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    this.scene.add(root);
    this.box(0, 0, 0, 0.72, 1.82, 0.5, this.darkSteel, root);
    this.box(0, 0, 0.27, 0.64, 1.72, 0.035, this.steel, root);
    this.box(0, 0.48, 0.295, 0.48, 0.025, 0.025, this.darkSteel, root);
    this.box(0, -0.35, 0.295, 0.48, 0.025, 0.025, this.darkSteel, root);
    this.box(0.22, 0.05, 0.32, 0.035, 0.18, 0.04, this.darkSteel, root);
    for (let i = 0; i < 4; i += 1) this.box(-0.18 + i * 0.12, 0.65, 0.3, 0.035, 0.035, 0.025, this.darkSteel, root);
  }
}
