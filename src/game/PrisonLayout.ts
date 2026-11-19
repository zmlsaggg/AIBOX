import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PrisonDifficulty } from "../ai/contracts";

type PhysicsWorld = InstanceType<typeof RAPIER.World>;
type Collider = ReturnType<PhysicsWorld["createCollider"]>;
type Body = ReturnType<PhysicsWorld["createRigidBody"]>;

interface Door {
  id: string;
  mesh: THREE.Mesh;
  pivot: THREE.Group;
  body: Body;
  collider: Collider;
  open: boolean;
  locked: boolean;
  position: THREE.Vector3;
  hinge: THREE.Vector3;
  offset: THREE.Vector3;
  angle: number;
  targetAngle: number;
}

export class PrisonLayout {
  private readonly doors = new Map<string, Door>();
  private cameraMarkers = 0;
  private readonly materials = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x59666a, roughness: 0.94 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x39464a, roughness: 0.96 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x879294, roughness: 0.72, metalness: 0.12 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x333d3e, roughness: 0.92 }),
    tileA: new THREE.MeshStandardMaterial({ color: 0x3b4645, roughness: 0.88 }),
    tileB: new THREE.MeshStandardMaterial({ color: 0x303b3c, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x78888a, metalness: 0.72, roughness: 0.38 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x202a2c, metalness: 0.6, roughness: 0.5 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xd39b55, emissive: 0x55300c, emissiveIntensity: 0.5 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd8d1b5, emissive: 0x8e8060, emissiveIntensity: 1.3 }),
  };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: PhysicsWorld,
    difficulty: PrisonDifficulty,
  ) {
    this.buildFloor();
    this.buildOuterWalls();
    this.buildCells();
    this.buildDifficultyModifiers(difficulty);
    this.buildFurniture();
    this.buildEnvironmentalDetails();
  }

  private buildFloor(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), this.materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle worn concrete tile seams, replacing the debug-like grid.
    for (let x = -11; x <= 11; x += 2) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 18), this.materials.darkMetal);
      seam.position.set(x, 0.008, 0);
      this.scene.add(seam);
    }
    for (let z = -8; z <= 8; z += 2) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.008, 0.018), this.materials.darkMetal);
      seam.position.set(0, 0.009, z);
      this.scene.add(seam);
    }
    const floorBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.24, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 0.24, 9), floorBody);

    this.floorMarking(-10.4, -7.9, 1.8, 0.12, 0x9d7650);
    this.floorMarking(-10.4, -7.55, 0.12, 0.55, 0x9d7650);
    this.floorMarking(10.4, 7.9, 1.8, 0.12, 0x9d7650);
    this.floorMarking(10.4, 7.55, 0.12, 0.55, 0x9d7650);
    this.floorMarking(0, 8.35, 5.5, 0.045, 0x637270);
  }

  private floorMarking(x: number, z: number, width: number, depth: number, color: number): void {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.012, depth),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42 }),
    );
    mark.position.set(x, 0.018, z);
    this.scene.add(mark);
  }

  private wall(x: number, z: number, width: number, depth: number, color = 0x59666b): void {
    const height = 2.55;
    const wallMaterial = color === 0x59666b ? this.materials.concrete : new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.09, depth + 0.04), this.materials.trim);
    cap.position.set(x, height + 0.035, z);
    cap.castShadow = true;
    this.scene.add(cap);

    const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(width + 0.025, 0.16, depth + 0.025), this.materials.concreteDark);
    lowerBand.position.set(x, 0.18, z);
    this.scene.add(lowerBand);
  }

  private buildOuterWalls(): void {
    this.wall(-12, 0, 0.42, 18.4, 0x46545b);
    this.wall(12, -5.6, 0.42, 6.8, 0x46545b);
    this.wall(12, 5.6, 0.42, 6.8, 0x46545b);
    this.addDoor("outer-exit", 12, 0, 0.42, 4.4);
    this.buildNorthWallWithWindows();
    this.wall(0, 9, 24.4, 0.42, 0x46545b);
  }

  private buildNorthWallWithWindows(): void {
    const wallLeft = -12.2;
    const wallRight = 12.2;
    const windowWidth = 2.25;
    const windowCenters = [-8.7, 7.8];
    let segmentStart = wallLeft;
    for (const center of windowCenters) {
      const segmentEnd = center - windowWidth / 2;
      if (segmentEnd > segmentStart) {
        this.wall((segmentStart + segmentEnd) / 2, -9, segmentEnd - segmentStart, 0.42, 0x46545b);
      }
      segmentStart = center + windowWidth / 2;
    }
    if (segmentStart < wallRight) {
      this.wall((segmentStart + wallRight) / 2, -9, wallRight - segmentStart, 0.42, 0x46545b);
    }

    // Solid sill and lintel leave a real opening for the barred observation windows.
    for (const center of windowCenters) {
      this.wallPiece(center, 0.58, -9, windowWidth, 1.16, 0.42, 0x46545b);
      this.wallPiece(center, 2.4, -9, windowWidth, 0.3, 0.42, 0x46545b);
    }
  }

  private wallPiece(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: number,
  ): void {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);
  }

  private buildCells(): void {
    this.wall(-6.5, -1.1, 11, 0.32);
    this.wall(6.5, -1.1, 11, 0.32);
    this.addDoor("cell-door", 0, -1.1, 2, 0.32);

    this.wall(-7, -7.45, 0.32, 3.1);
    this.wall(-7, -2.8, 0.32, 3.1);
    this.addDoor("west-cell-door", -7, -5.125, 0.32, 1.55);

    this.wall(0.2, -5.5, 0.32, 7);
    this.wall(4.7, -5.5, 0.32, 7);
    this.wall(8.8, -5.5, 0.32, 7);

    this.wall(-7.4, 3.1, 0.32, 5, 0x485a61);
    this.wall(-6.9, 5.5, 1.2, 0.32, 0x485a61);
    this.wall(-3.0, 5.5, 3.0, 0.32, 0x485a61);
    this.addDoor("control-door", -5.4, 5.5, 1.8, 0.32);
  }

  private buildDifficultyModifiers(difficulty: PrisonDifficulty): void {
    if (difficulty === "standard") return;
    this.wall(-6.5, 3.45, 11, 0.34, 0x4d5c62);
    this.wall(6.5, 3.45, 11, 0.34, 0x4d5c62);
    this.addDoor("checkpoint-one", 0, 3.45, 2, 0.34);
    if (difficulty === "strict") return;
    this.wall(-6.5, 1.0, 11, 0.34, 0x46555b);
    this.wall(6.5, 1.0, 11, 0.34, 0x46555b);
    this.addDoor("checkpoint-two", 0, 1.0, 2, 0.34);
    if (difficulty === "special") return;
    this.wall(-6.5, -0.2, 11, 0.34, 0x3e4c52);
    this.wall(6.5, -0.2, 11, 0.34, 0x3e4c52);
    this.addDoor("checkpoint-three", 0, -0.2, 1.2, 0.34);
  }

  private buildFurniture(): void {
    this.prop("BED", -9.2, -5.1, 1.25, 0.48, 0.32, 0x65747a);
    this.prop("SINK", -8.8, -2.5, 0.48, 0.35, 0.45, 0x85969a);
    this.prop("VENT", 2.3, -7.7, 0.9, 0.14, 0.65, 0x87959a);
    this.prop("TERMINAL", -8.9, 5.4, 0.6, 0.8, 0.45, 0x345968);
    this.prop("DESK", -3.2, 6.7, 1.35, 0.65, 0.42, 0x665847);

    // Cot mattress, blanket, pillow and sink bowl add readable room-scale detail.
    this.decorBox(-9.2, 0.38, -5.1, 1.18, 0.12, 0.43, 0x9a9a8b);
    this.decorBox(-9.2, 0.47, -5.32, 0.34, 0.09, 0.28, 0xc4c0ad);
    this.decorBox(-9.2, 0.45, -4.93, 0.72, 0.035, 0.3, 0x526c70);
    this.decorBox(-8.8, 0.48, -2.5, 0.42, 0.06, 0.29, 0xb3c0bc);
    this.decorBox(-3.2, 0.87, 6.7, 1.2, 0.08, 0.55, 0x8c765d);
    this.decorBox(-3.55, 0.94, 6.52, 0.18, 0.06, 0.18, 0x263a3b);
  }

  private buildEnvironmentalDetails(): void {
    // Ceiling fixtures and their warm pools of light remain visible from the tactical camera.
    for (const [x, z] of [[-9, -7.8], [-3.5, -4.5], [3.5, -4.5], [9, -7.8], [-8, 2], [1, 2], [8, 2], [-3, 7.7], [7, 7.7]] as const) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.055, 0.22), this.materials.light);
      fixture.position.set(x, 2.48, z);
      this.scene.add(fixture);
      const glow = new THREE.PointLight(0xd9cba8, 0.42, 5.2, 2);
      glow.position.set(x, 2.25, z);
      this.scene.add(glow);
    }

    // Security stripes, numbered sectors and wall-mounted equipment.
    this.wallSign("CELL 01", -9.2, 2.42, -1.3);
    this.wallSign("CONTROL", -5.1, 2.42, 5.1);
    this.wallSign("CHECKPOINT", 2.4, 2.42, -1.3);
    this.wallSign("EXIT", 10.7, 2.42, 0.8);
    this.addWallPanel(-11.72, 1.35, 1.2, 0.48);
    this.addWallPanel(11.72, 1.35, 1.2, 0.48);
    this.addCameraAt(-10.9, -8.25);
    this.addCameraAt(10.9, -8.25);
    this.addCameraAt(10.9, 8.25);
    this.addCameraAt(-10.9, 8.25);
  }

  private wallSign(text: string, x: number, y: number, z: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#182326";
      context.fillRect(0, 0, 256, 64);
      context.strokeStyle = "#8c9a91";
      context.lineWidth = 3;
      context.strokeRect(3, 3, 250, 58);
      context.fillStyle = "#d5c9a8";
      context.font = "bold 26px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 128, 33);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.31),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    sign.position.set(x, y, z);
    sign.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(sign);
  }

  private addWallPanel(x: number, y: number, z: number, width: number, height = 0.48): void {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, width), this.materials.darkMetal);
    panel.position.set(x, y, z);
    this.scene.add(panel);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, height * 0.55, width * 0.62),
      new THREE.MeshBasicMaterial({ color: 0x4caaa0 }),
    );
    screen.position.set(x + (x > 0 ? -0.045 : 0.045), y, z);
    this.scene.add(screen);
  }

  private decorBox(x: number, y: number, z: number, width: number, height: number, depth: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private prop(name: string, x: number, z: number, width: number, depth: number, height: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
    );
    mesh.name = name;
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);
  }

  private addDoor(id: string, x: number, z: number, width: number, depth: number): void {
    const height = 2.05;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.metal);
    mesh.name = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const horizontal = width >= depth;
    const offset = horizontal
      ? new THREE.Vector3(width / 2, 0, 0)
      : new THREE.Vector3(0, 0, depth / 2);
    const hinge = horizontal
      ? new THREE.Vector3(x - width / 2, height / 2, z)
      : new THREE.Vector3(x, height / 2, z - depth / 2);

    const pivot = new THREE.Group();
    pivot.name = `${id}-hinge`;
    pivot.position.copy(hinge);
    mesh.position.copy(offset);
    pivot.add(mesh);
    this.scene.add(pivot);

    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.12, width - 0.2), 0.12, depth + 0.025),
      this.materials.darkMetal,
    );
    inset.position.set(0, 0.32, 0);
    mesh.add(inset);
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, depth + 0.05), this.materials.amber);
    indicator.position.set(0, 0.82, 0);
    mesh.add(indicator);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.58, width * 0.42), 0.18, depth + 0.04), this.materials.darkMetal);
    slot.position.set(0, 0.35, 0);
    mesh.add(slot);
    if (width > 0.8) {
      const barCount = Math.max(3, Math.floor(width * 3));
      for (let index = 0; index < barCount; index += 1) {
        const barX = -width * 0.38 + (index / (barCount - 1)) * width * 0.76;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, depth + 0.06), this.materials.metal);
        bar.position.set(barX, 0.35, 0);
        mesh.add(bar);
      }
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.075), this.materials.trim);
    handle.position.set(width * 0.34, 0.88, depth > width ? 0.08 : 0);
    mesh.add(handle);
    for (const side of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), this.materials.trim);
      bolt.position.set(side * Math.max(0.08, width * 0.42), 0.72, 0.03);
      mesh.add(bolt);
    }

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, height / 2, z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setFriction(0.72),
      body,
    );
    this.doors.set(id, {
      id,
      mesh,
      pivot,
      body,
      collider,
      open: false,
      locked: id.startsWith("checkpoint-"),
      position: new THREE.Vector3(x, 0, z),
      hinge,
      offset,
      angle: 0,
      targetAngle: 0,
    });
  }

  /** Advance hinged door visuals and their kinematic Rapier colliders on fixed physics ticks. */
  update(delta: number): void {
    for (const door of this.doors.values()) {
      const difference = door.targetAngle - door.angle;
      if (Math.abs(difference) < 0.0015) {
        door.angle = door.targetAngle;
      } else {
        door.angle += difference * (1 - Math.exp(-7.5 * delta));
      }

      door.pivot.rotation.y = door.angle;
      const cosine = Math.cos(door.angle);
      const sine = Math.sin(door.angle);
      const centerX = door.hinge.x + cosine * door.offset.x + sine * door.offset.z;
      const centerZ = door.hinge.z - sine * door.offset.x + cosine * door.offset.z;
      door.body.setNextKinematicTranslation({ x: centerX, y: door.hinge.y, z: centerZ });
      door.body.setNextKinematicRotation(door.pivot.quaternion);
    }
  }

  toggleDoor(id: string): boolean | null {
    const door = this.doors.get(id);
    if (!door || door.locked) return null;
    door.open = !door.open;
    door.targetAngle = door.open ? (["outer-exit", "west-cell-door", "control-door"].includes(id) ? -1.28 : 1.28) : 0;
    return door.open;
  }

  unlockDoorNear(id: string, x: number, z: number, maxDistance = 2.4): boolean {
    const door = this.doors.get(id);
    if (!door || Math.hypot(door.position.x - x, door.position.z - z) > maxDistance) return false;
    if (!door.locked) return false;
    door.locked = false;
    return true;
  }

  getDoorStates(): Array<{ id: string; open: boolean; locked: boolean; x: number; z: number }> {
    return Array.from(this.doors.values()).map((door) => ({
      id: door.id,
      open: door.open,
      locked: door.locked,
      x: door.position.x,
      z: door.position.z,
    }));
  }

  toggleDoorNear(id: string, x: number, z: number, maxDistance = 2.4): boolean | null {
    const door = this.doors.get(id);
    if (!door || Math.hypot(door.position.x - x, door.position.z - z) > maxDistance) return null;
    return this.toggleDoor(id);
  }

  toggleNearestDoor(x: number, z: number, maxDistance = 2.2): { id: string; open: boolean } | null {
    let closest: Door | null = null;
    let closestDistance = maxDistance;
    for (const door of this.doors.values()) {
      const distance = Math.hypot(door.position.x - x, door.position.z - z);
      if (distance < closestDistance) {
        closest = door;
        closestDistance = distance;
      }
    }
    if (!closest) return null;
    const open = this.toggleDoor(closest.id);
    return open === null ? null : { id: closest.id, open };
  }

  addCameraMarker(): void {
    this.cameraMarkers += 1;
    const positions = [[-10.8, -8.1], [10.7, -8.1], [10.7, 7.9], [-10.7, 7.9], [0, -8.1]] as const;
    const [x, z] = positions[(this.cameraMarkers - 1) % positions.length];
    this.addCameraAt(x, z);
  }

  private addCameraAt(x: number, z: number): void {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.22), this.materials.darkMetal);
    mount.position.set(x, 2.34, z);
    this.scene.add(mount);
    const housing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), this.materials.metal);
    housing.position.set(x, 2.2, z + (z < 0 ? 0.1 : -0.1));
    housing.scale.set(1.05, 0.72, 0.82);
    this.scene.add(housing);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x60d3c5, emissive: 0x1d746c, emissiveIntensity: 1.1 }),
    );
    lens.position.set(x, 2.2, z + (z < 0 ? 0.22 : -0.22));
    this.scene.add(lens);
  }
}
