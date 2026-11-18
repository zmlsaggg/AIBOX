import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Character } from "./Character";
import { PrisonLayout } from "./PrisonLayout";
import { DemoProvider } from "../ai/DemoProvider";
import { TurnController, type TurnState } from "../ai/TurnController";
import type { PrisonerAction, PrisonDifficulty, TurnResult } from "../ai/contracts";

export interface GameCallbacks {
  onEvent: (message: string, tone?: "normal" | "warning" | "success") => void;
  onTurnState: (state: TurnState, detail?: string) => void;
  onStats: (stats: GameStats) => void;
}

export interface GameStats {
  money: number;
  guards: number;
  cameras: number;
  interruptCharges: number;
  turn: number;
  difficulty: PrisonDifficulty;
  alarmCooldown: number;
}

const STARTING_MONEY: Record<PrisonDifficulty, number> = {
  standard: 1400,
  strict: 1800,
  special: 2400,
  "black-dolphin": 3200,
};

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.OrthographicCamera;
  private readonly physics: InstanceType<typeof RAPIER.World>;
  private readonly layout: PrisonLayout;
  private readonly guard: Character;
  private readonly prisoner: Character;
  private readonly hiredGuards: Character[] = [];
  private readonly turnController: TurnController;
  private readonly keys = new Set<string>();
  private readonly callbacks: GameCallbacks;
  private readonly difficulty: PrisonDifficulty;

  private animationFrame = 0;
  private previousTime = 0;
  private money: number;
  private cameras = 2;
  private interruptCharges = 1;
  private alarmReadyAt = 0;
  private turn = 0;
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraPreset: "overview" | "cell" = "overview";
  private lastAction = "Заключённый ожидает первого хода";
  private prisonerAlert = false;

  private constructor(
    canvas: HTMLCanvasElement,
    difficulty: PrisonDifficulty,
    callbacks: GameCallbacks,
  ) {
    this.difficulty = difficulty;
    this.callbacks = callbacks;
    this.money = STARTING_MONEY[difficulty];

    this.scene.background = new THREE.Color(0x0a1116);
    this.scene.fog = new THREE.Fog(0x0a1116, 28, 55);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.camera = new THREE.OrthographicCamera(-15, 15, 11.25, -11.25, 0.1, 100);
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(0, 32, 0.001);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xc9e0e5, 0x253139, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffe4c2, 2.5);
    keyLight.position.set(-7, 16, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    this.scene.add(keyLight);

    this.physics = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.layout = new PrisonLayout(this.scene, this.physics);
    this.guard = new Character(this.physics, this.scene, "guard", -5.7, 6.8, "PLAYER GUARD");
    this.prisoner = new Character(this.physics, this.scene, "prisoner", -9.2, -3.6, "AI PRISONER");

    this.turnController = new TurnController(
      new DemoProvider(),
      (result) => this.applyPrisonerAction(result),
      (state, detail) => this.callbacks.onTurnState(state, detail),
    );

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.callbacks.onEvent("Смена началась. Охранник на посту.", "success");
    this.emitStats();
    this.loop(0);
  }

  static async create(
    canvas: HTMLCanvasElement,
    difficulty: PrisonDifficulty,
    callbacks: GameCallbacks,
  ): Promise<Game> {
    await RAPIER.init();
    return new Game(canvas, difficulty, callbacks);
  }

  private resize = (): void => {
    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);
    const aspect = width / height;
    const mapAspect = 24 / 18;
    let viewWidth: number;
    let viewHeight: number;
    if (aspect > mapAspect) {
      viewHeight = 20.5;
      viewWidth = viewHeight * aspect;
    } else {
      viewWidth = 24.5;
      viewHeight = viewWidth / aspect;
    }
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e", " "].includes(key)) {
      event.preventDefault();
    }
    this.keys.add(key);
    if (key === "e" && !event.repeat) this.interactAsGuard();
    if (key === " " && !event.repeat) this.triggerAlarm();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private loop = (time: number): void => {
    const delta = this.previousTime === 0 ? 0 : Math.min((time - this.previousTime) / 1000, 0.05);
    this.previousTime = time;

    let x = 0;
    let z = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) z -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) z += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;

    this.guard.setPlayerMovement(x, z);
    this.physics.step();
    this.guard.update(delta);
    this.prisoner.update(delta, true);
    for (const npc of this.hiredGuards) npc.update(delta);

    this.cameraTarget.lerp(
      this.cameraPreset === "overview" ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(-7.2, 0, -4.5),
      Math.min(delta * 2.8, 1),
    );
    this.camera.position.x = this.cameraTarget.x;
    this.camera.position.z = this.cameraTarget.z + 0.001;
    this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);

    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private applyPrisonerAction(result: TurnResult): void {
    this.turn = result.turn;
    const action = result.action;
    this.lastAction = result.narration;

    switch (action.type) {
      case "move":
        this.prisoner.moveTo(action.x, action.z);
        this.callbacks.onEvent(`ИИ перемещается: ${action.narration}`);
        break;
      case "inspect":
        this.callbacks.onEvent(`ИИ осматривает «${action.target}»: ${action.narration}`);
        break;
      case "interact": {
        const position = this.prisoner.position;
        const door = this.layout.toggleNearestDoor(position.x, position.z, 2.4);
        this.callbacks.onEvent(
          door ? `ИИ взаимодействует с дверью ${door.id}: ${door.open ? "открыта" : "закрыта"}` : `ИИ пытается взаимодействовать с «${action.target}»: ${action.narration}`,
          door?.open ? "warning" : "normal",
        );
        break;
      }
      case "speak":
        this.callbacks.onEvent(`ЗАКЛЮЧЁННЫЙ: «${action.message}»`, "warning");
        break;
      case "wait":
        this.callbacks.onEvent(`ИИ выжидает: ${action.narration}`);
        break;
    }
    this.emitStats();
  }

  private interactAsGuard(): void {
    const position = this.guard.position;
    const door = this.layout.toggleNearestDoor(position.x, position.z, 2.1);
    if (door) {
      this.callbacks.onEvent(`Охранник ${door.open ? "открыл" : "закрыл"} дверь ${door.id}.`, "success");
    } else {
      this.callbacks.onEvent("Рядом нет двери для взаимодействия.");
    }
  }

  triggerAlarm(): void {
    const now = performance.now();
    if (now < this.alarmReadyAt) {
      this.callbacks.onEvent("Тревога ещё перезаряжается.", "warning");
      return;
    }
    this.alarmReadyAt = now + 30_000;
    if (!this.prisonerAlert) {
      this.money = Math.max(0, this.money - 180);
      this.callbacks.onEvent("Ложная тревога: штраф −$180.", "warning");
    } else {
      this.callbacks.onEvent("Тревога подтверждена. Периметр заблокирован.", "success");
    }
    this.emitStats();
  }

  buyCamera(): boolean {
    if (this.money < 350) return false;
    this.money -= 350;
    this.cameras += 1;
    this.layout.addCameraMarker();
    this.callbacks.onEvent("Установлена новая камера наблюдения.", "success");
    this.emitStats();
    return true;
  }

  hireGuard(): boolean {
    if (this.money < 850) return false;
    this.money -= 850;
    const patrolPositions = [[7.2, 6.6], [9.5, 1.8], [-2.5, 6.7], [7.2, -7.2]] as const;
    const [x, z] = patrolPositions[this.hiredGuards.length % patrolPositions.length];
    const npc = new Character(this.physics, this.scene, "guard", x, z, `HIRED GUARD ${this.hiredGuards.length + 1}`);
    this.hiredGuards.push(npc);
    this.callbacks.onEvent("Новый охранник заступил на пост.", "success");
    this.emitStats();
    return true;
  }

  async takeDemoTurn(): Promise<void> {
    const position = this.prisoner.position;
    await this.turnController.takeTurn({
      difficulty: this.difficulty,
      prisoner: { x: position.x, z: position.z, status: "в камере" },
      visibleObjects: ["cell-door", "ventilation", "bed", "sink"],
      recentEvents: [this.lastAction],
    });
  }

  useInterruptCharge(): boolean {
    if (this.interruptCharges <= 0) return false;
    if (!this.turnController.interrupt()) return false;
    this.interruptCharges -= 1;
    this.callbacks.onEvent("Текущий промпт удалён. Действие не применено.", "success");
    this.emitStats();
    return true;
  }

  setCameraPreset(preset: "overview" | "cell"): void {
    this.cameraPreset = preset;
  }

  private emitStats(): void {
    this.callbacks.onStats({
      money: this.money,
      guards: this.hiredGuards.length + 1,
      cameras: this.cameras,
      interruptCharges: this.interruptCharges,
      turn: this.turn,
      difficulty: this.difficulty,
      alarmCooldown: Math.max(0, Math.ceil((this.alarmReadyAt - performance.now()) / 1000)),
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.guard.dispose();
    this.prisoner.dispose();
    this.hiredGuards.forEach((guard) => guard.dispose());
    this.physics.free();
    this.renderer.dispose();
  }
}
