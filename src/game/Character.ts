import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

type PhysicsWorld = InstanceType<typeof RAPIER.World>;
type Body = ReturnType<PhysicsWorld["createRigidBody"]>;

export type CharacterRole = "guard" | "prisoner";

export class Character {
  readonly body: Body;
  readonly visual: THREE.Group;
  private target: THREE.Vector3 | null = null;
  private targetLifetime = 0;\n  private gaitPhase = 0;\n  private readonly animatedLimbs: THREE.Mesh[] = [];

  constructor(
    private readonly world: PhysicsWorld,
    scene: THREE.Scene,
    role: CharacterRole,
    x: number,
    z: number,
    label: string,
  ) {
    const color = role === "guard" ? 0x66b7ff : 0xe7b66a;
    const dark = role === "guard" ? 0x193b58 : 0x57371e;

    this.visual = new THREE.Group();
    this.visual.name = label;

    const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.74 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99f80, roughness: 0.92 });\n    const boot = new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.95 });\n    const accent = new THREE.MeshStandardMaterial({ color: role === "guard" ? 0x83a6ae : 0x8b5146, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.45, 5, 10), uniform);
    torso.position.y = 0.72;
    torso.castShadow = true;
    this.visual.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    head.position.set(0, 1.18, -0.015);
    head.castShadow = true;
    this.visual.add(head);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkMaterial);
    cap.position.set(0, 1.22, -0.015);
    cap.scale.set(1.05, 0.56, 1.05);
    this.visual.add(cap);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), uniform);
      arm.position.set(side * 0.27, 0.72, 0.015);
      arm.rotation.z = side * -0.12;
      arm.castShadow = true;
      this.visual.add(arm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.28, 4, 8), darkMaterial);
      leg.position.set(side * 0.105, 0.27, 0);
      leg.castShadow = true;
      this.visual.add(leg);
    }

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

  setPlayerMovement(x: number, z: number): void {
    const direction = new THREE.Vector2(x, z);
    if (direction.lengthSq() > 1) direction.normalize();
    const speed = 4.1;
    this.body.setLinvel({ x: direction.x * speed, y: 0, z: direction.y * speed }, true);
  }

  moveTo(x: number, z: number): void {
    this.target = new THREE.Vector3(x, 0.51, z);
    this.targetLifetime = 0;
  }

  stop(): void {
    this.target = null;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  update(delta: number, autonomous = false): void {
    if (autonomous && this.target) {
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
    if (Math.hypot(velocity.x, velocity.z) > 0.12) {
      this.visual.rotation.y = Math.atan2(velocity.x, velocity.z);
    }
  }

  dispose(): void {
    this.world.removeRigidBody(this.body);
    this.visual.removeFromParent();
  }
}
