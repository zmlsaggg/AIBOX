import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PrisonDifficulty } from "../ai/contracts";

type PhysicsWorld = InstanceType<typeof RAPIER.World>;
type Collider = ReturnType<PhysicsWorld["createCollider"]>;

interface Door {
  id: string;
  mesh: THREE.Mesh;
  collider: Collider;
  open: boolean;
  position: THREE.Vector3;
}

export class PrisonLayout {
  private readonly doors = new Map<string, Door>();
  private cameraMarkers = 0;

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
  }

  private buildFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({ color: 0x202a30, roughness: 0.94 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(24, 24, 0x35464d, 0x2a383e);
    grid.position.y = 0.006;
    this.scene.add(grid);

    const floorBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.24, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 0.24, 9), floorBody);
  }

  private wall(x: number, z: number, width: number, depth: number, color = 0x59666b): void {
    const height = 2.25;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
    );
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, depth + 0.025),
      new THREE.MeshStandardMaterial({ color: 0x91a0a3, roughness: 0.65 }),
    );
    trim.position.set(x, height + 0.015, z);
    this.scene.add(trim);
  }

  private buildOuterWalls(): void {
    this.wall(-12, 0, 0.42, 18.4, 0x46545b);
    this.wall(12, 0, 0.42, 18.4, 0x46545b);
    this.wall(0, -9, 24.4, 0.42, 0x46545b);
    this.wall(0, 9, 24.4, 0.42, 0x46545b);
  }

  private buildCells(): void {
    // Cell block: a controlled central corridor with two doors.
    this.wall(-7.0, -1.1, 9.6, 0.32);
    this.wall(4.7, -1.1, 10.5, 0.32);
    this.wall(-7.0, -5.2, 0.32, 7.9);
    this.wall(-3.7, -7.1, 6.4, 0.32);
    this.wall(0.2, -5.1, 0.32, 7.8);
    this.wall(4.7, -5.1, 0.32, 7.8);
    this.wall(8.8, -5.1, 0.32, 7.8);

    this.addDoor("cell-door", -1.5, -1.1, 1.65, 0.16);
    this.addDoor("inner-door", 2.45, -1.1, 1.65, 0.16);

    // A small guard/control room on the south-west side.
    this.wall(-7.4, 3.1, 0.32, 5.0, 0x485a61);
    this.wall(-4.8, 5.5, 5.4, 0.32, 0x485a61);
    this.addDoor("control-door", -4.8, 3.0, 1.5, 0.16);
  }

  private buildDifficultyModifiers(difficulty: PrisonDifficulty): void {
    if (difficulty === "standard") return;

    // Every higher tier adds real colliders and additional choke points.
    this.wall(-6.5, 3.45, 11, 0.34, 0x4d5c62);
    this.wall(6.5, 3.45, 11, 0.34, 0x4d5c62);
    this.addDoor("checkpoint-one", 0, 3.45, 1.25, 0.18);

    if (difficulty === "strict") return;

    this.wall(6.1, 6.0, 11.8, 0.32, 0x46555b);
    this.wall(1.8, 7.3, 0.32, 3.1, 0x46555b);
    this.addDoor("checkpoint-two", 0.7, 6.0, 1.35, 0.18);

    if (difficulty === "special") return;

    // Black Dolphin adds a final staggered internal perimeter.
    this.wall(-1.9, 5.0, 0.32, 4.8, 0x3e4c52);
    this.wall(4.1, 1.6, 0.32, 3.8, 0x3e4c52);
    this.wall(6.7, -3.0, 4.1, 0.32, 0x3e4c52);
    this.addDoor("checkpoint-three", 4.1, -0.35, 0.18, 1.35);
  }

  private buildFurniture(): void {
    this.prop("BED", -9.2, -5.1, 1.25, 0.48, 0.32, 0x65747a);
    this.prop("SINK", -8.8, -2.5, 0.48, 0.35, 0.45, 0x85969a);
    this.prop("VENT", 0.2, -7.7, 0.9, 0.14, 0.65, 0x87959a);
    this.prop("TERMINAL", -8.9, 5.4, 0.6, 0.8, 0.45, 0x345968);
    this.prop("DESK", -6.4, 5.6, 1.35, 0.65, 0.42, 0x665847);
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
  }

  private addDoor(id: string, x: number, z: number, width: number, depth: number): void {
    const height = 1.95;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0x82949a, metalness: 0.45, roughness: 0.52 }),
    );
    mesh.name = id;
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2),
      body,
    );
    this.doors.set(id, { id, mesh, collider, open: false, position: new THREE.Vector3(x, 0, z) });
  }

  toggleDoor(id: string): boolean | null {
    const door = this.doors.get(id);
    if (!door) return null;
    door.open = !door.open;
    door.collider.setEnabled(!door.open);
    door.mesh.visible = !door.open;
    return door.open;
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
    const positions = [
      [-10.8, -8.1], [10.7, -8.1], [10.7, 7.9], [-10.7, 7.9], [0, -8.1],
    ] as const;
    const [x, z] = positions[(this.cameraMarkers - 1) % positions.length];

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0x7b8d92, metalness: 0.7, roughness: 0.35 }),
    );
    base.position.set(x, 2.28, z);
    this.scene.add(base);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x59d2c5, emissive: 0x154d48, roughness: 0.28 }),
    );
    lens.position.set(x, 2.18, z + 0.12);
    lens.scale.set(1, 0.68, 0.7);
    this.scene.add(lens);
  }
}
