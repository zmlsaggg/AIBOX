import * as THREE from "three";

/**
 * Small, deterministic cinematic dressing pass.
 * All meshes are visual-only; collision geometry remains owned by PrisonLayout/Rapier.
 */
export class CinematicAtmosphere {
  private readonly stainMaterial: THREE.MeshBasicMaterial;
  private readonly scuffMaterial: THREE.MeshBasicMaterial;
  private readonly dustGeometry = new THREE.BufferGeometry();
  private readonly dustPositions = new Float32Array(36 * 3);
  private readonly dustSpeeds = new Float32Array(36);
  private readonly dustPoints: THREE.Points;
  private dustTime = 0;

  constructor(private readonly scene: THREE.Scene) {
    const stainTexture = this.radialTexture("#182123", "#18212300");
    const scuffTexture = this.radialTexture("#303b3b", "#303b3b00");
    this.stainMaterial = new THREE.MeshBasicMaterial({
      map: stainTexture,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.scuffMaterial = new THREE.MeshBasicMaterial({
      map: scuffTexture,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    this.addFloorWear();
    this.addLightPools();
    this.addWallWear();
    this.addDust();
  }

  update(delta: number): void {
    this.dustTime += delta;
    for (let index = 0; index < this.dustSpeeds.length; index += 1) {
      const offset = index * 3;
      this.dustPositions[offset] += Math.sin(this.dustTime * 0.35 + index) * delta * 0.018;
      this.dustPositions[offset + 1] += this.dustSpeeds[index] * delta;
      this.dustPositions[offset + 2] += Math.cos(this.dustTime * 0.28 + index * 0.7) * delta * 0.012;
      if (this.dustPositions[offset + 1] > 2.6) {
        this.dustPositions[offset + 1] = 0.32;
        this.dustPositions[offset] = ((index * 7.13) % 22) - 11;
        this.dustPositions[offset + 2] = ((index * 4.97) % 16) - 8;
      }
    }
    const positions = this.dustGeometry.getAttribute("position") as THREE.BufferAttribute;
    positions.needsUpdate = true;
  }

  private addDust(): void {
    for (let index = 0; index < this.dustSpeeds.length; index += 1) {
      const offset = index * 3;
      this.dustPositions[offset] = ((index * 7.13) % 22) - 11;
      this.dustPositions[offset + 1] = 0.32 + (index % 8) * 0.28;
      this.dustPositions[offset + 2] = ((index * 4.97) % 16) - 8;
      this.dustSpeeds[index] = 0.045 + (index % 5) * 0.012;
    }
    this.dustGeometry.setAttribute("position", new THREE.BufferAttribute(this.dustPositions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xd5c6a5,
      size: 0.045,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.dustPoints = new THREE.Points(this.dustGeometry, material);
    this.dustPoints.renderOrder = 2;
    this.scene.add(this.dustPoints);
  }

  private radialTexture(inner: string, outer: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.48, inner);
      gradient.addColorStop(1, outer);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private addFloorWear(): void {
    // Fixed coordinates keep the environment identical between sessions.
    const stains: Array<[number, number, number, number]> = [
      [-10.1, -6.8, 1.9, 0.8], [-7.2, -3.8, 1.4, 0.55], [-3.6, -6.8, 2.2, 0.7],
      [1.1, -7.9, 1.5, 0.6], [5.4, -4.2, 2.1, 0.75], [9.7, -5.8, 1.8, 0.65],
      [-4.8, 1.9, 2.5, 0.8], [2.8, 2.2, 2.1, 0.7], [8.7, 3.6, 1.8, 0.65],
      [-8.9, 7.6, 1.8, 0.55], [-1.2, 7.8, 2.2, 0.6], [5.7, 7.4, 2.0, 0.65],
    ];
    for (const [x, z, width, depth] of stains) {
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.stainMaterial);
      stain.rotation.x = -Math.PI / 2;
      stain.position.set(x, 0.014, z);
      this.scene.add(stain);
    }

    const scuffs: Array<[number, number, number, number, number]> = [
      [-9.8, -2.0, 0.8, 0.13, -0.18], [-6.2, -6.2, 0.65, 0.1, 0.3],
      [-2.1, -3.3, 0.9, 0.12, -0.4], [3.4, -5.7, 0.75, 0.1, 0.22],
      [7.9, -1.9, 0.8, 0.11, -0.28], [9.1, 6.3, 0.9, 0.12, 0.35],
      [-5.2, 7.2, 0.7, 0.1, -0.12], [1.8, 6.1, 0.9, 0.12, 0.42],
    ];
    for (const [x, z, width, depth, rotation] of scuffs) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.scuffMaterial);
      mark.rotation.set(-Math.PI / 2, 0, rotation);
      mark.position.set(x, 0.019, z);
      this.scene.add(mark);
    }
  }

  private addLightPools(): void {
    const poolTexture = this.radialTexture("#d5c5a0a8", "#d5c5a000");
    const material = new THREE.MeshBasicMaterial({
      map: poolTexture,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const positions: Array<[number, number]> = [
      [-9, -7.8], [-3.5, -4.5], [3.5, -4.5], [9, -7.8],
      [-8, 2], [1, 2], [8, 2], [-3, 7.7], [7, 7.7],
    ];
    for (const [x, z] of positions) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.4), material);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.022, z);
      this.scene.add(pool);
    }
  }

  private addWallWear(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0x202a2c,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    const placements: Array<[number, number, number, number, number, number]> = [
      [-11.76, 1.1, -6.8, 0.025, 0.9, 0], [-11.76, 1.45, 0.1, 0.025, 1.2, 0],
      [11.76, 1.3, -3.5, 0.025, 1.0, 0], [11.76, 1.0, 5.4, 0.025, 0.8, 0],
    ];
    for (const [x, y, z, width, height, rotation] of placements) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      mark.position.set(x, y, z);
      mark.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      mark.rotation.z = rotation;
      this.scene.add(mark);
    }
  }
}
