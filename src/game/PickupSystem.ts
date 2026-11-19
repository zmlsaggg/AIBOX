import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Character } from "./Character";
import type { PrisonItemState } from "../ai/contracts";

type PhysicsWorld = InstanceType<typeof RAPIER.World>;
type Body = ReturnType<PhysicsWorld["createRigidBody"]>;
type Collider = ReturnType<PhysicsWorld["createCollider"]>;

interface PickupItem {
  id: string;
  label: string;
  mesh: THREE.Group;
  body: Body;
  collider: Collider;
  halfHeight: number;
  heldBy: Character | null;
  reservedBy: Character | null;
}

export class PickupSystem {
  private readonly items: PickupItem[] = [];
  private readonly heldItems = new Map<Character, PickupItem>();

  constructor(private readonly world: PhysicsWorld, private readonly scene: THREE.Scene) {
    this.addKeycard(-3.2, 0.035, -3.8);
    this.addWrench(-4.8, 0.07, -5.8);
    this.addCanteen(-9.8, 0.14, -4.7);
  }

  private addKeycard(x: number, y: number, z: number): void {
    const root = new THREE.Group();
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.035, 0.27),
      new THREE.MeshStandardMaterial({ color: 0x426d70, metalness: 0.28, roughness: 0.48 }),
    );
    card.castShadow = true;
    root.add(card);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.008, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xd7bd83, metalness: 0.42, roughness: 0.38 }),
    );
    stripe.position.set(-0.035, 0.022, 0);
    root.add(stripe);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.009, 0.07), new THREE.MeshStandardMaterial({ color: 0xc0a66e, metalness: 0.55, roughness: 0.34 }));
    chip.position.set(0.14, 0.023, 0);
    root.add(chip);
    this.addItem("keycard", "ключ-карта", root, x, y, z, 0.018, new THREE.Vector3(0.21, 0.018, 0.135));
  }

  private addWrench(x: number, y: number, z: number): void {
    const root = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4a2, metalness: 0.86, roughness: 0.3 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.031, 0.43, 10), steel);
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    root.add(shaft);
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 7, 14, Math.PI * 1.55), steel);
    jaw.position.x = 0.22;
    jaw.rotation.z = -Math.PI / 2;
    jaw.castShadow = true;
    root.add(jaw);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.13, 10), new THREE.MeshStandardMaterial({ color: 0x343b3c, roughness: 0.78 }));
    grip.rotation.z = Math.PI / 2;
    grip.position.x = -0.13;
    root.add(grip);
    this.addItem("wrench", "гаечный ключ", root, x, y, z, 0.035, new THREE.Vector3(0.27, 0.035, 0.055));
  }

  private addCanteen(x: number, y: number, z: number): void {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.25, 14),
      new THREE.MeshStandardMaterial({ color: 0x6e806c, metalness: 0.18, roughness: 0.58 }),
    );
    body.castShadow = true;
    root.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.045, 12), new THREE.MeshStandardMaterial({ color: 0x242c2a, metalness: 0.42, roughness: 0.42 }));
    cap.position.y = 0.145;
    root.add(cap);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: 0x9c895e, metalness: 0.45, roughness: 0.48 }));
    band.position.y = 0.045;
    root.add(band);
    this.addItem("canteen", "фляга", root, x, y, z, 0.125, new THREE.Vector3(0.085, 0.125, 0.085));
  }

  private addItem(
    id: string,
    label: string,
    mesh: THREE.Group,
    x: number,
    y: number,
    z: number,
    halfHeight: number,
    halfExtents: THREE.Vector3,
  ): void {
    mesh.position.set(x, y, z);
    mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(mesh);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.18)
        .setAngularDamping(1.4)
        .setCanSleep(false),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(0.82)
        .setRestitution(0.12),
      body,
    );
    this.items.push({ id, label, mesh, body, collider, halfHeight, heldBy: null, reservedBy: null });
  }

  /** Apply gravity only to loose items; the game world keeps zero gravity for character control. */
  applyGravity(delta: number): void {
    for (const item of this.items) {
      if (item.heldBy || item.reservedBy) continue;
      const position = item.body.translation();
      const velocity = item.body.linvel();
      const resting = position.y <= item.halfHeight + 0.025 && velocity.y <= 0.02;
      if (resting) {
        if (velocity.y < 0) item.body.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
      } else {
        item.body.setLinvel({ x: velocity.x, y: Math.max(-8, velocity.y - 9.81 * delta), z: velocity.z }, true);
      }
    }
  }

  /** Called after the physics step to keep render meshes aligned with their Rapier bodies. */
  update(): void {
    for (const item of this.items) {
      if (item.heldBy) {
        const hand = item.heldBy.getPickupHandPosition();
        item.body.setTranslation({ x: hand.x, y: hand.y, z: hand.z }, true);
        item.mesh.position.copy(hand);
        item.mesh.rotation.set(0, item.heldBy.visual.rotation.y, 0);
        continue;
      }
      const p = item.body.translation();
      const q = item.body.rotation();
      item.mesh.position.set(p.x, p.y, p.z);
      item.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  getHeldItemId(character: Character): string | null {
    return this.heldItems.get(character)?.id ?? null;
  }

  getItemStates(): PrisonItemState[] {
    return this.items.map((item) => {
      const p = item.body.translation();
      return {
        id: item.id,
        label: item.label,
        x: p.x,
        z: p.z,
        held: Boolean(item.heldBy || item.reservedBy),
      };
    });
  }

  pickupNearest(character: Character, maxDistance = 1.55, requestedName?: string): string | null {
    if (this.heldItems.has(character) || character.isPickingUp) return null;
    const position = character.position;
    let nearest: PickupItem | null = null;
    let nearestDistance = maxDistance;
    for (const item of this.items) {
      if (item.heldBy) continue;
      if (requestedName) {
        const target = requestedName.toLowerCase();
        if (!item.id.includes(target) && !item.label.toLowerCase().includes(target)) continue;
      }
      const p = item.body.translation();
      const distance = Math.hypot(p.x - position.x, p.z - position.z);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;

    const item = nearest;
    const started = character.startPickup(() => {
      item.reservedBy = null;
      item.heldBy = character;
      item.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      item.collider.setEnabled(false);
      item.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.heldItems.set(character, item);
    });
    if (!started) return null;
    item.reservedBy = character;
    return item.label;
  }

  consumeHeld(character: Character): string | null {
    const item = this.heldItems.get(character);
    if (!item) return null;
    this.heldItems.delete(character);
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
    this.world.removeRigidBody(item.body);
    item.mesh.removeFromParent();
    return item.label;
  }

  /** Release the held object in the character's facing direction. */
  dropHeld(character: Character, throwStrength = 4.2): string | null {
    const yaw = character.visual.rotation.y;
    return this.throwHeld(
      character,
      character.position.x + Math.sin(yaw) * 3,
      character.position.z + Math.cos(yaw) * 3,
      throwStrength,
    );
  }

  /** Throw a held item toward a world-space point, restoring its dynamic collider. */
  throwHeld(character: Character, targetX: number, targetZ: number, power = 3.8): string | null {
    const item = this.heldItems.get(character);
    if (!item) return null;

    const hand = character.getPickupHandPosition();
    const position = character.position;
    const direction = new THREE.Vector3(targetX - position.x, 0, targetZ - position.z);
    if (direction.lengthSq() < 0.01) {
      const yaw = character.visual.rotation.y;
      direction.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    direction.normalize();
    const yaw = Math.atan2(direction.x, direction.z);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    item.collider.setEnabled(true);
    item.body.setTranslation({ x: hand.x, y: hand.y, z: hand.z }, true);
    item.body.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, true);
    item.body.setLinvel({
      x: direction.x * Math.max(1.2, Math.min(6, power)),
      y: 1.8 + Math.min(1.2, power * 0.16),
      z: direction.z * Math.max(1.2, Math.min(6, power)),
    }, true);
    item.body.setAngvel({
      x: -direction.z * 2.2,
      y: 1.4,
      z: direction.x * 2.2,
    }, true);

    item.heldBy = null;
    this.heldItems.delete(character);
    return item.label;
  }


  dispose(): void {
    for (const item of this.items) {
      this.world.removeRigidBody(item.body);
      item.mesh.removeFromParent();
    }
    this.items.length = 0;
    this.heldItems.clear();
  }
}
