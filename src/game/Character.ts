import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

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
  private targetLifetime = 0;
  private gaitPhase = 0;
  private readonly animatedLimbs: THREE.Mesh[] = [];
  private readonly torso: THREE.Mesh;
  private pickupAnimation: PickupAnimation | null = null;

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

    this.visual = new THREE.Group();
    this.visual.name = label;

    const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.74 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99f80, roughness: 0.92 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.95 });
    const accent = new THREE.MeshStandardMaterial({ color: role === "guard" ? 0x83a6ae : 0x8b5146, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.45, 5, 10), uniform);
    torso.position.y = 0.72;
    torso.castShadow = true;
    this.torso = torso;
    this.visual.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    head.position.set(0, 1.18, -0.015);
    head.castShadow = true;
    this.visual.add(head);

    if (role === "guard") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkMaterial);
      cap.position.set(0, 1.22, -0.015);
      cap.scale.set(1.05, 0.56, 1.05);
      this.visual.add(cap);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.176, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), darkMaterial);
      hair.position.set(0, 1.205, -0.025);
      this.visual.add(hair);
    }

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), uniform);
      arm.position.set(side * 0.27, 0.72, 0.015);
      arm.rotation.z = side * -0.12;
      arm.castShadow = true;
      this.visual.add(arm);
      this.animatedLimbs.push(arm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.28, 4, 8), darkMaterial);
      leg.position.set(side * 0.105, 0.27, 0);
      leg.castShadow = true;
      this.visual.add(leg);
      this.animatedLimbs.push(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.24), boot);
      shoe.position.set(side * 0.105, 0.13, 0.055);
      shoe.castShadow = true;
      this.visual.add(shoe);
    }

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.075, 16), darkMaterial);
    belt.position.y = 0.53;
    this.visual.add(belt);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.025), accent);
    patch.position.set(0.12, 0.78, 0.21);
    this.visual.add(patch);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.39, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.visual.add(shadow);

    scene.add(this.visual);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 0.51, z)
        .setLinearDamping(5)
        .setAngularDamping(8)
        .setCanSleep(false)
        .enabledRotations(false, false, false),
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(0.27, 0.22).setFriction(0.8).setRestitution(0),
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
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.pickupAnimation = { elapsed: 0, onGrab, grabbed: false };
    return true;
  }

  setPlayerMovement(x: number, z: number): void {
    if (this.pickupAnimation) {
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }
    const direction = new THREE.Vector2(x, z);
    if (direction.lengthSq() > 1) direction.normalize();
    const speed = 4.1;
    this.body.setLinvel({ x: direction.x * speed, y: 0, z: direction.y * speed }, true);
  }

  moveTo(x: number, z: number): void {
    if (this.pickupAnimation) return;
    this.target = new THREE.Vector3(x, 0.51, z);
    this.targetLifetime = 0;
  }

  stop(): void {
    this.target = null;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  update(delta: number, autonomous = false): void {
    if (autonomous && this.target && !this.pickupAnimation) {
      this.targetLifetime += delta;
      const current = this.position;
      const dx = this.target.x - current.x;
      const dz = this.target.z - current.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.2 || this.targetLifetime > 6) {
        this.stop();
      } else {
        const speed = 1.8;
        this.body.setLinvel({ x: (dx / distance) * speed, y: 0, z: (dz / distance) * speed }, true);
      }
    }

    const p = this.body.translation();
    this.visual.position.set(p.x, 0, p.z);
    const velocity = this.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0.12 && !this.pickupAnimation) {
      this.visual.rotation.y = Math.atan2(velocity.x, velocity.z);
      this.gaitPhase += delta * Math.min(11, 5 + speed * 1.35);
      const swing = Math.sin(this.gaitPhase) * Math.min(0.58, speed * 0.14);
      this.animatedLimbs[0].rotation.x = -swing * 0.72;
      this.animatedLimbs[1].rotation.x = swing;
      this.animatedLimbs[2].rotation.x = swing * 0.72;
      this.animatedLimbs[3].rotation.x = -swing;
      this.visual.position.y = Math.abs(Math.sin(this.gaitPhase * 2)) * 0.022;
    } else if (!this.pickupAnimation) {
      for (const limb of this.animatedLimbs) limb.rotation.x = THREE.MathUtils.damp(limb.rotation.x, 0, delta, 12);
      this.visual.position.y = THREE.MathUtils.damp(this.visual.position.y, 0, delta, 10);
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

    // The character bends at the waist, extends the right arm, closes the grip,
    // then raises the object and returns to a relaxed standing pose.
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
