import { Game, type GameStats } from "./game/Game";
import type { PrisonDifficulty, PrisonerAction, PrisonerDecision, TurnMemoryEntry } from "./ai/contracts";
import { BrowserProvider, type BrowserProviderId } from "./ai/BrowserProvider";
import { DemoProvider } from "./ai/DemoProvider";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app mount element");

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="AIBOX home">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span class="brand-name">AI<span>BOX</span></span>
        <span class="brand-divider"></span>
        <span class="brand-subtitle">PRISON CONTROL</span>
      </a>
      <div class="topbar-center"><span class="live-dot"></span><span>FACILITY STATUS</span><strong id="facility-status">STANDBY</strong></div>
      <div class="topbar-right"><span class="build-tag">PRE-ALPHA</span><span class="operator">OPERATOR <b>01</b></span></div>
    </header>
    <main class="main-layout">
      <section class="world-panel">
        <div class="world-toolbar">
          <div><span class="eyebrow">LIVE FACILITY FEED</span><h1>Block <span>A</span> <small>/ North wing</small></h1></div>
          <div class="view-switch">
            <button class="view-button active" data-action="cam-overview">OVERVIEW</button>
            <button class="view-button" data-action="cam-cell">CELL CAM</button>
          </div>
        </div>
        <div class="world-stage">
          <canvas id="world-canvas" aria-label="Angled top-down 3D prison simulation"></canvas>
          <div class="mobile-controls" aria-label="Touch controls">
            <div class="mobile-joystick" id="mobile-joystick" aria-label="Move guard">
              <span class="joystick-ring"></span>
              <span class="joystick-handle" id="joystick-handle"></span>
            </div>
            <button class="mobile-interact" id="mobile-interact" type="button" aria-label="Pick up item or use door"><b> E </b><small>USE</small></button>
          </div>\n          <div class="map-compass" aria-hidden="true"><span>N</span><i></i><small>SECTOR MAP</small></div>\n          <div class="map-landmarks" aria-hidden="true"><span><i class="landmark-cell"></i> CELL BLOCK</span><span><i class="landmark-control"></i> CONTROL ROOM</span><span><i class="landmark-exit"></i> PERIMETER EXIT</span></div>
          <div class="scene-coordinates">SECTOR 04 · 59°N / 24°E</div>
          <div class="scene-status"><span class="live-dot"></span> SIMULATION LIVE</div>
          <div class="scene-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE <i></i> <kbd>E</kbd> DOOR <i></i> <kbd>SPACE</kbd> ALARM</div>
          <div class="scene-bottom">
            <div class="scene-chip"><span class="chip-icon">⌖</span><span><b>GUARD CONTROL</b><small>Manual movement</small></span></div>
            <div class="scene-chip ai-chip"><span class="ai-pulse"></span><span><b>AI PRISONER</b><small id="ai-substatus">Awaiting first prompt</small></span></div>
          </div>
        </div>
        <div class="world-footer">
          <div class="footer-metric"><span>ACTIVE BLOCK</span><b>A-04</b></div>
          <div class="footer-metric"><span>SECURITY LEVEL</span><b id="footer-difficulty">—</b></div>
          <div class="footer-metric"><span>AI TURN</span><b id="turn-count">00</b></div>
          <div class="footer-metric"><span>AI PROVIDER</span><b class="demo-label">LOCAL DEMO</b></div>
        </div>
      </section>
      <aside class="control-panel">
        <section class="panel-section shift-section">
          <div class="section-heading"><span class="eyebrow">YOUR SHIFT</span><span class="shift-state"><i></i> ON DUTY</span></div>
          <div class="money-line"><span>FACILITY BUDGET</span><strong id="money-value">$1,400</strong></div>
          <div class="stats-grid">
            <div class="mini-stat"><span>GUARDS</span><b id="guard-count">1</b></div>
            <div class="mini-stat"><span>CAMERAS</span><b id="camera-count">2</b></div>
            <div class="mini-stat"><span>AI TURNS</span><b id="turn-stat">0</b></div>
          </div>
        </section>
        <section class="panel-section">
          <div class="section-heading"><span class="eyebrow">SECURITY SYSTEMS</span><span class="section-index">01</span></div>
          <button class="system-row" data-action="buy-camera"><span class="system-icon camera-icon">◉</span><span class="system-copy"><b>Install camera</b><small>Add another surveillance point</small></span><span class="price">$350 <i>+</i></span></button>
          <button class="system-row" data-action="hire-guard"><span class="system-icon guard-icon">♟</span><span class="system-copy"><b>Hire guard</b><small>Deploy an additional NPC</small></span><span class="price">$850 <i>+</i></span></button>
          <button class="system-row" data-action="buy-charge"><span class="system-icon charge-icon">ϟ</span><span class="system-copy"><b>Interrupt charge</b><small>Cancel one generating prompt</small></span><span class="price">$500 <i>+</i></span></button>
        </section>
        <section class="panel-section ai-section">
          <div class="section-heading"><span class="eyebrow">PRISONER MONITOR</span><span class="section-index">02</span></div>
          <div class="ai-status-card">
            <div class="ai-card-top"><div class="avatar-bot">AI</div><div><b>SUBJECT 001</b><small id="provider-name">LOCAL DEMO PROVIDER</small></div><span class="status-pill" id="ai-state">IDLE</span></div>
            <div class="prompt-progress"><span id="prompt-progress"></span></div>
            <p id="ai-detail">The prisoner is waiting for an instruction cycle.</p>
            <div class="browser-session-controls">
              <label>ВЫБЕРИ ИИ-СЕРВИС
                <select id="browser-provider">
                  <option value="chatgpt">ChatGPT</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">Qwen Chat</option>
                  <option value="gemini">Gemini</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
              <button class="chrome-install-button" id="install-chrome-connector">УСТАНОВИТЬ CHROME CONNECTOR</button>
              <button class="connect-browser-button" id="connect-browser">ОТКРЫТЬ ИИ В CHROME</button>
              <small id="browser-connection-status">Один раз подключи расширение в chrome://extensions. После этого AIBOX будет работать с твоими обычными авторизованными вкладками Chrome — без второго профиля и повторного входа.</small>
            </div>
            <div class="ai-actions">
              <button class="primary-button" data-action="next-turn">RUN AI TURN <span>↗</span></button>
              <button class="interrupt-button" id="interrupt-button" data-action="interrupt" disabled title="Cancel the current prompt">ϟ <span>DELETE</span><b id="charge-count">1</b></button>
            </div>
            <details class="ai-cognition" open>
              <summary><span>AI COGNITION</span><span class="cognition-live">MEMORY ONLINE</span></summary>
              <div class="cognition-block">
                <small>CURRENT INTENT</small>
                <p id="ai-intent">Waiting for the first decision.</p>
                <div class="cognition-meta"><span>CONFIDENCE</span><b id="ai-confidence">—</b></div>
              </div>
              <div class="cognition-block">
                <small>ALTERNATIVE ACTIONS · NOT EXECUTED</small>
                <ol id="ai-alternatives"><li>Model alternatives will appear after its first turn.</li></ol>
              </div>
              <div class="cognition-block">
                <small>PERSISTENT STRATEGY MEMORY</small>
                <p id="ai-memory">The prisoner has not learned anything yet.</p>
              </div>
              <div class="cognition-block">
                <small>RECENT DECISIONS</small>
                <ol id="ai-history"><li>No completed turns.</li></ol>
              </div>
            </details>
            <div class="turn-note">ONE PROMPT = ONE TURN <span>·</span> OUTPUT IS VALIDATED</div>
          </div>
        </section>
        <section class="panel-section alarm-section">
          <div class="section-heading"><span class="eyebrow">EMERGENCY PROTOCOL</span><span class="section-index">03</span></div>
          <button class="alarm-button" data-action="alarm"><span class="alarm-light"></span><span><b>TRIGGER ALARM</b><small id="alarm-caption">False alarm penalty: −$180</small></span><kbd>SPACE</kbd></button>
        </section>
        <section class="event-section">
          <div class="section-heading"><span class="eyebrow">SHIFT LOG</span><span class="event-count" id="event-count">01 EVENTS</span></div>
          <div class="event-list" id="event-list"></div>
        </section>
      </aside>
    </main>
    <footer class="bottom-bar"><span>AIBOX <b>v0.1.0</b></span><span>PHYSICS SANDBOX <i></i> LOCAL SESSION <i></i> NO API KEY</span><span>BUILT FOR THE ESCAPE EXPERIMENT</span></footer>
  </div>
  <div class="intro-overlay" id="intro-overlay">
    <div class="intro-grain"></div>
    <div class="intro-frame">
      <div class="intro-kicker"><span class="live-dot"></span> AIBOX SECURITY NETWORK <span class="intro-separator">/</span> FACILITY 04</div>
      <div class="intro-wordmark"><span>AI</span>BOX</div>
      <div class="intro-subtitle">PRISON CONTROL SYSTEM</div>
      <div class="intro-rule"></div>
      <p class="intro-copy">ONE GUARD.<br>ONE PRISONER.<br><strong>ONE WAY OUT.</strong></p>
      <p class="intro-description">A containment experiment is about to begin.<br>Observe the facility. Anticipate the escape.</p>
      <button class="intro-enter" id="intro-enter" type="button">ENTER FACILITY <span>→</span></button>
      <div class="intro-foot">PRESS ENTER TO CONTINUE <i></i> F11 FULLSCREEN <i></i> ALT + F4 EXIT</div>
    </div>
    <div class="intro-corner intro-corner-left">SYS / 04.11<br>STATUS: LOCKDOWN</div>
    <div class="intro-corner intro-corner-right">AIBOX PROTOTYPE<br>BUILD 0.1.0</div>
  </div>
  <div class="start-overlay hidden" id="start-overlay">
    <div class="start-card">
      <div class="start-kicker"><span class="live-dot"></span> FACILITY INITIALIZATION</div>
      <div class="start-title"><span>AI</span>BOX</div>
      <p class="start-description">You are the warden. The prisoner is an AI.<br>Build the perimeter. Watch every move. Do not let it out.</p>
      <div class="difficulty-title"><span>SELECT SECURITY LEVEL</span><small>DIFFICULTY CHANGES THE PRISON RULESET</small></div>
      <div class="difficulty-grid">
        <button class="difficulty-card selected" data-difficulty="standard"><span class="diff-number">01</span><b>STANDARD</b><small>Basic cell block · Few sensors</small><em>STARTER BUDGET $1,400</em></button>
        <button class="difficulty-card" data-difficulty="strict"><span class="diff-number">02</span><b>STRICT</b><small>Reinforced doors · More patrols</small><em>STARTER BUDGET $1,800</em></button>
        <button class="difficulty-card" data-difficulty="special"><span class="diff-number">03</span><b>SPECIAL</b><small>Layered perimeter · Active sensors</small><em>STARTER BUDGET $2,400</em></button>
        <button class="difficulty-card black-card" data-difficulty="black-dolphin"><span class="diff-number">04</span><b>BLACK DOLPHIN</b><small>Maximum containment protocol</small><em>STARTER BUDGET $3,200</em></button>
      </div>
      <button class="start-button" id="start-button">BEGIN YOUR SHIFT <span>→</span></button>
      <div class="start-footnote">EARLY PROTOTYPE · LOCAL DEMO AI · PROGRESS NOT SAVED YET</div>
    </div>
  </div>
`;

let game: Game | null = null;
const browserProvider = new BrowserProvider();
let browserConnected = false;
let selectedDifficulty: PrisonDifficulty = "standard";
let eventNumber = 0;

const introOverlay = document.querySelector<HTMLDivElement>("#intro-overlay");
const startOverlay = document.querySelector<HTMLDivElement>("#start-overlay");
const introEnter = document.querySelector<HTMLButtonElement>("#intro-enter");
if (!introOverlay || !startOverlay || !introEnter) {
  throw new Error("Missing startup splash or difficulty selection controls");
}

function enterFacility(): void {
  introOverlay?.classList.add("hidden");
  startOverlay?.classList.remove("hidden");
}

introEnter.addEventListener("click", enterFacility);
window.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || introOverlay.classList.contains("hidden")) return;
  const target = event.target;
  if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
  event.preventDefault();
  enterFacility();
});

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

function addEvent(message: string, tone: "normal" | "warning" | "success" = "normal"): void {
  const list = $("#event-list");
  const row = document.createElement("div");
  row.className = `event-row ${tone}`;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const stamp = document.createElement("time");
  stamp.textContent = time;
  const text = document.createElement("p");
  text.textContent = message;
  row.append(stamp, text);
  list.prepend(row);
  eventNumber += 1;
  $("#event-count").textContent = `${String(eventNumber).padStart(2, "0")} EVENTS`;
  while (list.children.length > 7) list.lastElementChild?.remove();
}

function updateStats(stats: GameStats): void {
  $("#money-value").textContent = `$${stats.money.toLocaleString("en-US")}`;
  $("#guard-count").textContent = String(stats.guards);
  $("#camera-count").textContent = String(stats.cameras);
  $("#turn-count").textContent = String(stats.turn).padStart(2, "0");
  $("#turn-stat").textContent = String(stats.turn);
  $("#charge-count").textContent = String(stats.interruptCharges);
  $("#footer-difficulty").textContent = stats.difficulty.toUpperCase().replace("-", " ");
  $("#provider-name").textContent = browserConnected ? browserProvider.selectedProvider.toUpperCase() : "LOCAL DEMO PROVIDER";
  document.querySelector(".demo-label")!.textContent = browserConnected ? browserProvider.selectedProvider.toUpperCase() : "LOCAL DEMO";
  if (stats.alarmCooldown > 0) {
    $("#alarm-caption").textContent = `Alarm cooldown: ${stats.alarmCooldown}s`;
  } else {
    $("#alarm-caption").textContent = "False alarm penalty: −$180";
  }
}

function describeAIAction(action: PrisonerAction): string {
  switch (action.type) {
    case "move": return `MOVE → ${action.x.toFixed(1)}, ${action.z.toFixed(1)} · ${action.pace}`;
    case "inspect": return `INSPECT → ${action.target}`;
    case "interact": return `INTERACT → ${action.target}`;
    case "use_item": return `USE ITEM → ${action.target}`;
    case "throw": return `THROW → ${action.x.toFixed(1)}, ${action.z.toFixed(1)}`;
    case "speak": return `SPEAK → ${action.message}`;
    case "wait": return "WAIT";
  }
}

function renderDecision(decision: PrisonerDecision, history: TurnMemoryEntry[], memorySummary: string): void {
  $("#ai-intent").textContent = decision.intent;
  $("#ai-confidence").textContent = `${Math.round(decision.confidence * 100)}%`;
  const alternatives = $("#ai-alternatives");
  alternatives.replaceChildren();
  if (!decision.alternatives.length) {
    const empty = document.createElement("li");
    empty.textContent = "No valid alternatives returned.";
    alternatives.append(empty);
  } else {
    decision.alternatives.forEach((action) => {
      const item = document.createElement("li");
      item.textContent = describeAIAction(action);
      alternatives.append(item);
    });
  }
  $("#ai-memory").textContent = memorySummary;
  const historyList = $("#ai-history");
  historyList.replaceChildren();
  history.slice(-5).reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.success ? "memory-success" : "memory-failure";
    item.textContent = `#${entry.turn} · ${describeAIAction(entry.action)} — ${entry.outcome}`;
    historyList.append(item);
  });
  if (!history.length) {
    const item = document.createElement("li");
    item.textContent = "No completed turns.";
    historyList.append(item);
  }
}

function setTurnState(state: string, detail?: string): void {
  const stateLabel = $("#ai-state");
  stateLabel.textContent = state.toUpperCase();
  $("#ai-detail").textContent = detail ?? "Waiting for next prompt.";
  $("#ai-substatus").textContent = detail ?? state;
  const running = state === "generating";
  $("#interrupt-button").toggleAttribute("disabled", !running);
  $("#prompt-progress").classList.toggle("running", running);
  $("#facility-status").textContent = running ? "AI THINKING" : "ACTIVE";
}

$("#install-chrome-connector").addEventListener("click", async () => {
  const button = $("#install-chrome-connector");
  const status = $("#browser-connection-status");
  button.setAttribute("disabled", "true");
  status.textContent = "Готовлю Chrome Connector…";
  try {
    if (!window.aiboxAI?.installChromeConnector) {
      throw new Error("Установка Chrome Connector доступна в установленной Windows-версии AIBOX.");
    }
    const result = await window.aiboxAI.installChromeConnector();
    status.textContent = result.message;
    addEvent("Chrome Connector скопирован. Остался один ручной шаг в chrome://extensions.", "success");
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Не удалось установить Chrome Connector.";
    addEvent(status.textContent, "warning");
  } finally {
    button.removeAttribute("disabled");
  }
});

$("#connect-browser").addEventListener("click", async () => {
  const button = $("#connect-browser");
  const status = $("#browser-connection-status");
  const selected = $("#browser-provider") as HTMLSelectElement;
  button.setAttribute("disabled", "true");
  status.textContent = "Открываю выбранный сервис в обычном Chrome…";
  try {
    browserProvider.configure(selected.value as BrowserProviderId);
    const detail = await browserProvider.connect();
    if (game && !game.setAIProvider(browserProvider)) {
      throw new Error("Дождись завершения текущего хода, чтобы сменить ИИ-сервис.");
    }
    browserConnected = true;
    status.textContent = detail;
    $("#provider-name").textContent = browserProvider.selectedProvider.toUpperCase();
    $(".demo-label").textContent = browserProvider.selectedProvider.toUpperCase();
    addEvent(`Открыта вкладка ${browserProvider.selectedProvider} в обычном браузере. Используется текущая сессия Chrome.`, "success");
  } catch (error) {
    browserConnected = false;
    status.textContent = error instanceof Error ? error.message : "Не удалось открыть окно ИИ.";
    addEvent(status.textContent, "warning");
  } finally {
    button.removeAttribute("disabled");
  }
});

$("#start-button").addEventListener("click", async () => {
  const button = $("#start-button");
  button.textContent = "INITIALIZING…";
  button.setAttribute("disabled", "true");
  try {
    game = await Game.create($("#world-canvas"), selectedDifficulty, {
      onEvent: addEvent,
      onTurnState: setTurnState,
      onStats: updateStats,
      onDecision: renderDecision,
    }, browserConnected ? browserProvider : new DemoProvider());
    $("#start-overlay").classList.add("hidden");
    $("#facility-status").textContent = "ACTIVE";
    addEvent(`Facility initialized: ${selectedDifficulty.toUpperCase()}.`, "success");
  } catch (error) {
    button.textContent = "RETRY INITIALIZATION →";
    button.removeAttribute("disabled");
    addEvent(error instanceof Error ? error.message : "Failed to initialize game.", "warning");
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll("[data-difficulty]").forEach((item) => item.classList.remove("selected"));
    card.classList.add("selected");
    selectedDifficulty = card.dataset.difficulty as PrisonDifficulty;
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!game) return;
    switch (button.dataset.action) {
      case "alarm":
        game.triggerAlarm();
        break;
      case "buy-camera":
        if (!game.buyCamera()) addEvent("Insufficient facility budget for a camera.", "warning");
        break;
      case "hire-guard":
        if (!game.hireGuard()) addEvent("Insufficient facility budget to hire a guard.", "warning");
        break;
      case "buy-charge":
        if (!game.buyInterruptCharge()) addEvent("Insufficient budget or charge limit reached.", "warning");
        break;
      case "next-turn":
        await game.takeAITurn();
        break;
      case "interrupt":
        if (!game.useInterruptCharge()) addEvent("No active prompt or no interrupt charges.", "warning");
        break;
      case "cam-overview":
        game.setCameraPreset("overview");
        document.querySelectorAll(".view-button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        break;
      case "cam-cell":
        game.setCameraPreset("cell");
        document.querySelectorAll(".view-button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        break;
    }
  });
});

const joystick = $("#mobile-joystick") as HTMLDivElement;
const joystickHandle = $("#joystick-handle") as HTMLSpanElement;
let joystickPointer: number | null = null;

function updateJoystick(event: PointerEvent): void {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = rect.width * 0.31;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > maxRadius) {
    dx = (dx / distance) * maxRadius;
    dy = (dy / distance) * maxRadius;
  }
  joystickHandle.style.transform = `translate(${dx}px, ${dy}px)`;
  game?.setTouchMovement(dx / maxRadius, dy / maxRadius);
}

joystick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointer) updateJoystick(event);
});
const releaseJoystick = (event: PointerEvent): void => {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joystickHandle.style.transform = "translate(0, 0)";
  game?.setTouchMovement(0, 0);
};
joystick.addEventListener("pointerup", releaseJoystick);
joystick.addEventListener("pointercancel", releaseJoystick);
$("#mobile-interact").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  game?.interact();
});

window.addEventListener("beforeunload", () => game?.dispose());
