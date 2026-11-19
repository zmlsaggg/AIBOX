import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { MovementPace } from "../ai/contracts";

type PhysicsWorld = InstanceType<typeof RAPIER.World>;
type Body = ReturnType<PhysicsWorld["createRigidBody"]>;

export type CharacterRole = "guard" | "prisoner";

interface PickupAnimation {
  elapsed: number;
  onGrab: () => void;
  grabbed: boolean;
}

export class Character {
  readonly body: Body;
  readonly visual: THREE.Group;
  private target: THREE.Vector3 | null = null;
  private readonly waypoints: THREE.Vector3[] = [];
  private targetLifetime = 0;
  private gaitPhase = 0;
  private readonly animatedLimbs: THREE.Mesh[] = [];
  private readonly torso: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly movementInput = new THREE.Vector2();
  private readonly targetDirection = new THREE.Vector2();
  private pickupAnimation: PickupAnimation | null = null;
  private readonly moveSpeed: number;
  private readonly acceleration: number;
  private readonly turnSpeed: number;
  private targetSpeedFactor = 0.82;
  private idleTime = 0;

  constructor(
    private readonly world: PhysicsWorld,
    scene: THREE.Scene,
    role: CharacterRole,
    x: number,
    z: number,
    label: string,
  ) {
    const color = role === "guard" ? 0x405860 : 0x9a7957;
    const dark = role === "guard" ? 0x202c31 : 0x493a2e;
    this.moveSpeed = role === "guard" ? 4.1 : 1.8;
    this.acceleration = role === "guard" ? 13.5 : 8.5;
    this.turnSpeed = role === "guard" ? 9.5 : 7.2;

    this.visual = new THREE.Group();
    this.visual.name = label;

    const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.74 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99f80, roughness: 0.92 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.95 });
    const accent = new THREE.MeshStandardMaterial({ color: role === "guard" ? 0x83a6ae : 0x8b5146, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.45, 6, 12), uniform);
    torso.position.y = 0.72;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.torso = torso;
    this.visual.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), skin);
    head.position.set(0, 1.18, -0.015);
    head.castShadow = true;
    head.receiveShadow = true;
    this.head = head;
    this.visual.add(head);

    if (role === "guard") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), darkMaterial);
      cap.position.set(0, 1.22, -0.015);
      cap.scale.set(1.05, 0.56, 1.05);
      cap.castShadow = true;
      this.visual.add(cap);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.176, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), darkMaterial);
      hair.position.set(0, 1.205, -0.025);
      hair.castShadow = true;
      this.visual.add(hair);
    }

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 5, 10), uniform);
      arm.position.set(side * 0.27, 0.72, 0.015);
      arm.rotation.z = side * -0.12;
      arm.castShadow = true;
      arm.receiveShadow = true;
      this.visual.add(arm);
      this.animatedLimbs.push(arm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.28, 5, 10), darkMaterial);
      leg.position.set(side * 0.105, 0.27, 0);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.visual.add(leg);
      this.animatedLimbs.push(leg);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.24), boot);
      shoe.position.set(side * 0.105, 0.13, 0.055);
      shoe.castShadow = true;
      shoe.receiveShadow = true;
      this.visual.add(shoe);
    }

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.075, 18), darkMaterial);
    belt.position.y = 0.53;
    this.visual.add(belt);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.025), accent);
    patch.position.set(0.12, 0.78, 0.21);
    this.visual.add(patch);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.39, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.visual.add(shadow);

    scene.add(this.visual);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 0.51, z)
        .setLinearDamping(0.4)
        .setAngularDamping(8)
        .setCanSleep(false)
        .enabledRotations(false, false, false),
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(0.27, 0.22).setFriction(0.86).setRestitution(0),
      this.body,
    );
  }

  get position(): THREE.Vector3 {
    const p = this.body.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  get isPickingUp(): boolean {
    return this.pickupAnimation !== null;
  }

  getPickupHandPosition(): THREE.Vector3 {
    this.visual.updateMatrixWorld(true);
    return this.visual.localToWorld(new THREE.Vector3(0.34, 0.55, 0.28));
  }

  startPickup(onGrab: () => void): boolean {
    if (this.pickupAnimation) return false;
    this.target = null;
    this.waypoints.length = 0;
    this.movementInput.set(0, 0);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.pickupAnimation = { elapsed: 0, onGrab, grabbed: false };
    return true;
  }

  setPlayerMovement(x: number, z: number): void {
    if (this.pickupAnimation) {
      this.movementInput.set(0, 0);
      return;
    }
    this.movementInput.set(x, z);
    if (this.movementInput.lengthSq() > 1) this.movementInput.normalize();
  }

  moveTo(x: number, z: number, pace: MovementPace = "normal"): void {
    if (this.pickupAnimation) return;
    this.targetSpeedFactor = pace === "cautious" ? 0.46 : pace === "fast" ? 1 : 0.78;
    this.waypoints.length = 0;
    this.target = new THREE.Vector3(x, 0.51, z);
    this.targetLifetime = 0;
    this.movementInput.set(0, 0);
  }

  moveAlong(points: Array<{ x: number; z: number }>, pace: MovementPace = "normal"): boolean {
    if (this.pickupAnimation || points.length === 0) return false;
    this.targetSpeedFactor = pace === "cautious" ? 0.46 : pace === "fast" ? 1 : 0.78;
    this.waypoints.length = 0;
    this.waypoints.push(...points.slice(1).map((point) => new THREE.Vector3(point.x, 0.51, point.z)));
    this.target = new THREE.Vector3(points[0].x, 0.51, points[0].z);
    this.targetLifetime = 0;
    this.movementInput.set(0, 0);
    return true;
  }

  stop(): void {
    this.target = null;
    this.waypoints.length = 0;
    this.movementInput.set(0, 0);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  update(delta: number, autonomous = false): void {
    const p = this.body.translation();
    const velocity = this.body.linvel();

    if (autonomous && this.target && !this.pickupAnimation) {
      this.targetLifetime += delta;
      const dx = this.target.x - p.x;
      const dz = this.target.z - p.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.24) {
        const next = this.waypoints.shift();
        this.target = next ?? null;
        this.targetLifetime = 0;
        this.targetDirection.set(0, 0);
      } else if (this.targetLifetime > 8) {
        this.target = null;
        this.waypoints.length = 0;
        this.targetDirection.set(0, 0);
      } else {
        this.targetDirection.set(dx / distance, dz / distance);
        const targetSpeed = this.moveSpeed * this.targetSpeedFactor;
        const stoppingSpeed = Math.min(targetSpeed, Math.sqrt(Math.max(0, distance) * 2 * this.acceleration));
        this.targetDirection.multiplyScalar(stoppingSpeed / targetSpeed);
      }
    } else if (autonomous) {
      this.targetDirection.set(0, 0);
    } else {
      this.targetDirection.copy(this.movementInput);
    }

    const desiredX = this.pickupAnimation ? 0 : this.targetDirection.x * (autonomous ? this.moveSpeed * this.targetSpeedFactor : this.moveSpeed);
    const desiredZ = this.pickupAnimation ? 0 : this.targetDirection.y * (autonomous ? this.moveSpeed * this.targetSpeedFactor : this.moveSpeed);
    const currentX = velocity.x;
    const currentZ = velocity.z;
    const differenceX = desiredX - currentX;
    const differenceZ = desiredZ - currentZ;
    const difference = Math.hypot(differenceX, differenceZ);
    const braking = Math.hypot(desiredX, desiredZ) < 0.05;
    const response = (braking ? this.acceleration * 1.55 : this.acceleration) * delta;
    const blend = difference > 0.0001 ? Math.min(1, response / difference) : 1;
    const nextX = currentX + differenceX * blend;
    const nextZ = currentZ + differenceZ * blend;
    this.body.setLinvel({ x: nextX, y: 0, z: nextZ }, true);

    const speed = Math.hypot(nextX, nextZ);
    this.visual.position.set(p.x, 0, p.z);
    if (speed > 0.16 && !this.pickupAnimation) {
      const desiredYaw = Math.atan2(nextX, nextZ);
      const yawDelta = Math.atan2(
        Math.sin(desiredYaw - this.visual.rotation.y),
        Math.cos(desiredYaw - this.visual.rotation.y),
      );
      this.visual.rotation.y += yawDelta * (1 - Math.exp(-this.turnSpeed * delta));
      this.gaitPhase += delta * (5.2 + speed * 1.55);
      const stride = Math.min(0.62, speed / this.moveSpeed);
      const swing = Math.sin(this.gaitPhase) * stride;
      const opposite = Math.sin(this.gaitPhase + Math.PI) * stride;
      this.animatedLimbs[0].rotation.x = -swing * 0.52;
      this.animatedLimbs[1].rotation.x = opposite * 0.78;
      this.animatedLimbs[2].rotation.x = -opposite * 0.52;
      this.animatedLimbs[3].rotation.x = swing * 0.78;
      this.visual.position.y = Math.abs(Math.sin(this.gaitPhase * 2)) * 0.018 * stride;
      this.torso.rotation.z = THREE.MathUtils.damp(this.torso.rotation.z, -swing * 0.035, delta, 7);
      this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, -0.025, delta, 5);
      this.idleTime = 0;
    } else if (!this.pickupAnimation) {
      this.idleTime += delta;
      for (const limb of this.animatedLimbs) limb.rotation.x = THREE.MathUtils.damp(limb.rotation.x, 0, delta, 9);
      this.visual.position.y = THREE.MathUtils.damp(this.visual.position.y, 0, delta, 9);
      this.torso.rotation.z = THREE.MathUtils.damp(this.torso.rotation.z, 0, delta, 7);
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, Math.sin(this.idleTime * 1.35) * 0.008, delta, 3);
      this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, Math.sin(this.idleTime * 0.8) * 0.012, delta, 3);
    }

    this.updatePickupAnimation(delta);
  }

  private updatePickupAnimation(delta: number): void {
    const animation = this.pickupAnimation;
    if (!animation) {
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, 0, delta, 10);
      return;
    }

    animation.elapsed += delta;
    const duration = 1.05;
    const t = Math.min(1, animation.elapsed / duration);
    const smooth = (value: number): number => {
      const clamped = THREE.MathUtils.clamp(value, 0, 1);
      return clamped * clamped * (3 - 2 * clamped);
    };
    const reach = t < 0.38
      ? smooth(t / 0.38)
      : t < 0.58
        ? 1
        : 1 - smooth((t - 0.58) / 0.42);

    this.torso.rotation.x = 0.24 * reach;
    this.animatedLimbs[2].rotation.x = -1.18 * reach;
    this.animatedLimbs[2].rotation.z = THREE.MathUtils.damp(this.animatedLimbs[2].rotation.z, -0.2, delta, 8);
    this.visual.position.y = -0.045 * reach;

    if (!animation.grabbed && t >= 0.43) {
      animation.grabbed = true;
      animation.onGrab();
    }
    if (t >= 1) {
      this.pickupAnimation = null;
      this.torso.rotation.x = 0;
      this.animatedLimbs[2].rotation.x = -0.04;
      this.animatedLimbs[2].rotation.z = -0.12;
      this.visual.position.y = 0;
    }
  }

  dispose(): void {
    this.world.removeRigidBody(this.body);
    this.visual.removeFromParent();
  }
}
