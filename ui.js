import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants.js";
import { FPSCounter } from "./utils.js";
import { LaserConfig } from "./laser.js";
import { getText } from "./localization.js";

export class UIManager {
  constructor() {
    this.fpsCounter = new FPSCounter();
    this.showDebug = false;

    this.uiContainer = null;
    this.buttons = new Map();
    this.debugPanel = null;

    this.onBackButton = null;
    this.onRestartButton = null;

    this.initialize();
  }

  initialize() {
    this.createUIContainer();
    this.createButtons();
    this.createDebugPanel();
    this.setupEventListeners();
  }

  createUIContainer() {
    this.uiContainer = document.createElement("div");
    this.uiContainer.id = "ui-container";
    this.uiContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      font-family: 'Courier New', monospace;
    `;

    document.body.appendChild(this.uiContainer);
  }

  createButtons() {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      display: flex;
      gap: 10px;
      pointer-events: auto;
      display: none;
    `;

    const buttons = [
      {
        id: "back",
        text: "←",
        tooltip: getText("ui.back"),
        callback: () => this.onBackButton?.(),
      },
      {
        id: "restart",
        text: "↻",
        tooltip: getText("ui.restart"),
        callback: () => this.onRestartButton?.(),
      },
      {
        id: "laser-debug",
        text: "🔺",
        tooltip: getText("ui.debug"),
        callback: () => this.toggleLaserDebug(),
      },
    ];

    buttons.forEach(({ id, text, tooltip, callback }) => {
      const button = this.createButton(text, tooltip, callback);
      buttonContainer.appendChild(button);
      this.buttons.set(id, button);
    });

    this.uiContainer.appendChild(buttonContainer);
  }

  //Kaldırılacak Butonlar
  createButton(text, tooltip, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.title = tooltip;
    button.onclick = onClick;

    button.style.cssText = `
      background: ${COLORS.UI_BUTTON};
      border: 2px solid ${COLORS.UI_TEXT};
      color: ${COLORS.UI_TEXT};
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s ease;
      min-width: 40px;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.background = COLORS.UI_TEXT;
      button.style.color = COLORS.UI_BUTTON;
      button.style.transform = "scale(1.05)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.background = COLORS.UI_BUTTON;
      button.style.color = COLORS.UI_TEXT;
      button.style.transform = "scale(1)";
    });

    return button;
  }

  createDebugPanel() {
    this.debugPanel = document.createElement("div");
    this.debugPanel.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: ${COLORS.UI_BACKGROUND};
      border: 2px solid ${COLORS.UI_TEXT};
      color: ${COLORS.UI_TEXT};
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      min-width: 200px;
      display: none;
      pointer-events: auto;
    `;

    this.uiContainer.appendChild(this.debugPanel);
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "F3":
          e.preventDefault();
          this.toggleDebugPanel();
          break;
      }
    });
  }

  toggleLaserDebug() {
    LaserConfig.debug.showLengthInfo = !LaserConfig.debug.showLengthInfo;
    LaserConfig.debug.showCollisionPoints =
      !LaserConfig.debug.showCollisionPoints;
    LaserConfig.debug.logLaserData = !LaserConfig.debug.logLaserData;
    LaserConfig.performance.debugMode = !LaserConfig.performance.debugMode;

    const debugButton = this.buttons.get("laser-debug");
    if (debugButton) {
      debugButton.style.background = LaserConfig.debug.showLengthInfo
        ? "#ff6b6b"
        : COLORS.UI_BUTTON;
      debugButton.textContent = LaserConfig.debug.showLengthInfo ? "🔴" : "🔺";
      debugButton.title = LaserConfig.debug.showLengthInfo
        ? "Disable Laser Debug"
        : "Enable Laser Debug";
    }

    this.showNotification(
      `Laser Debug ${
        LaserConfig.debug.showLengthInfo ? "Enabled" : "Disabled"
      }`,
      LaserConfig.debug.showLengthInfo ? "success" : "info"
    );
  }

  toggleDebugPanel() {
    this.showDebug = !this.showDebug;
    this.debugPanel.style.display = this.showDebug ? "block" : "none";
  }

  update(gameState, levelInfo, laserInfo) {
    this.fpsCounter.update();

    if (this.showDebug) {
      this.updateDebugPanel(gameState, levelInfo, laserInfo);
    }
  }

  updateDebugPanel(gameState, levelInfo, laserInfo) {
    const fps = this.fpsCounter.getFPS();

    this.debugPanel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: ${
        COLORS.LASER_BEAM
      };">
        DEBUG INFO
      </div>
      
      <div><strong>Performance:</strong></div>
      <div>FPS: ${fps}</div>
      <div>State: ${gameState?.current || "Unknown"}</div>
      <br>
      
      <div><strong>Level:</strong></div>
      <div>Level: ${levelInfo?.levelNumber || "N/A"}</div>
      <div>Entities: ${levelInfo?.entityCount || 0}</div>
      <div>Player: ${
        levelInfo?.playerPosition
          ? `(${Math.round(levelInfo.playerPosition.x)}, ${Math.round(
              levelInfo.playerPosition.y
            )})`
          : "N/A"
      }</div>
      <br>
      
      <div><strong>Laser System:</strong></div>
      <div>Beams: ${laserInfo?.beamCount || 0}</div>
      <div>Powered Cells: ${laserInfo?.poweredCellCount || 0}</div>
      <br>
      
      <div style="font-size: 10px; color: #888;">
        F3: Debug
      </div>
    `;
  }

  showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");

    const colors = {
      success: COLORS.POWER_CELL_POWERED,
      warning: COLORS.LASER_EMITTER,
      error: COLORS.PLAYER,
      info: COLORS.UI_BACKGROUND,
    };

    notification.style.cssText = `
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type] || colors.info};
      color: ${COLORS.UI_TEXT};
      padding: 10px 20px;
      border-radius: 4px;
      border: 2px solid ${COLORS.UI_TEXT};
      z-index: 300;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    notification.textContent = message;
    this.uiContainer.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 10);

    // Auto remove
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  showLoadingOverlay(show, message = "Loading...") {
    let overlay = document.getElementById("loading-overlay");

    if (show) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          z-index: 400;
          pointer-events: auto;
        `;

        const spinner = document.createElement("div");
        spinner.style.cssText = `
          width: 40px;
          height: 40px;
          border: 4px solid ${COLORS.UI_BACKGROUND};
          border-top: 4px solid ${COLORS.LASER_BEAM};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        `;

        const text = document.createElement("div");
        text.style.cssText = `
          color: ${COLORS.UI_TEXT};
          font-size: 18px;
          font-weight: bold;
        `;
        text.textContent = message;

        const style = document.createElement("style");
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);

        overlay.appendChild(spinner);
        overlay.appendChild(text);
        this.uiContainer.appendChild(overlay);
      } else {
        overlay.style.display = "flex";
        overlay.querySelector("div:last-child").textContent = message;
      }
    } else {
      if (overlay) {
        overlay.style.display = "none";
      }
    }
  }

  setButtonCallbacks(callbacks) {
    this.onBackButton = callbacks.onBack;
    this.onRestartButton = callbacks.onRestart;
  }

  destroy() {
    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }

    const styles = document.querySelectorAll('style[data-ui="true"]');
    styles.forEach((style) => style.remove());
  }
}

export class HUDRenderer {
  constructor() {
    this.visible = true;
  }

  render(ctx, gameData) {
    if (!this.visible) return;

    this.renderLevelInfo(ctx, gameData);
    this.renderObjectives(ctx, gameData);
  }

  renderLevelInfo(ctx, gameData) {
    ctx.save();

    ctx.fillStyle = COLORS.UI_TEXT;
    ctx.font = "16px Arial";
    ctx.textAlign = "left";

    const levelText = `${getText("game.level")} ${gameData.levelNumber || 1}`;
    ctx.fillText(levelText, 20, CANVAS_HEIGHT - 80);

    // Score display
    if (gameData.score !== undefined) {
      const scoreText = `${getText("game.score")}: ${gameData.score}`;
      ctx.fillText(scoreText, 20, CANVAS_HEIGHT - 60);
    }

    // Lives display
    if (gameData.lives !== undefined) {
      const livesText = `${getText("game.lives")}: ${gameData.lives}`;
      ctx.fillText(livesText, 20, CANVAS_HEIGHT - 40);
    }

    if (gameData.progress !== undefined) {
      ctx.strokeStyle = COLORS.UI_TEXT;
      ctx.lineWidth = 2;
      ctx.strokeRect(20, CANVAS_HEIGHT - 20, 200, 10);

      ctx.fillStyle = COLORS.LASER_BEAM;
      ctx.fillRect(22, CANVAS_HEIGHT - 18, (200 - 4) * gameData.progress, 6);
    }

    ctx.restore();
  }

  renderObjectives(ctx, gameData) {
    if (!gameData.objectives) return;

    ctx.save();

    ctx.fillStyle = COLORS.UI_TEXT;
    ctx.font = "14px Arial";
    ctx.textAlign = "right";

    let y = CANVAS_HEIGHT - 150;

    ctx.fillText(getText("game.objectives"), CANVAS_WIDTH - 20, y);
    y += 25;

    for (const objective of gameData.objectives) {
      const color = objective.completed
        ? COLORS.POWER_CELL_POWERED
        : COLORS.UI_TEXT;
      const marker = objective.completed ? "✓" : "○";

      ctx.fillStyle = color;
      ctx.fillText(`${marker} ${objective.text}`, CANVAS_WIDTH - 20, y);
      y += 20;
    }

    if (gameData.powerStats) {
      y += 15;
      ctx.fillStyle = COLORS.LASER_BEAM;
      ctx.font = "12px Arial";
      ctx.fillText("Güç İstatistikleri:", CANVAS_WIDTH - 20, y);
      y += 18;

      ctx.fillStyle = COLORS.UI_TEXT;
      ctx.font = "11px Arial";

      const stats = [
        `Hücre Güçlendirmeleri: ${gameData.powerStats.totalCellPowerings}`,
        `Güç Süresi: ${Math.floor(gameData.powerStats.totalPowerTime / 1000)}s`,
      ];

      for (const stat of stats) {
        ctx.fillText(stat, CANVAS_WIDTH - 20, y);
        y += 15;
      }
    }

    ctx.restore();
  }

  setVisible(visible) {
    this.visible = visible;
  }
}
