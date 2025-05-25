/**
 * Ana Oyun Döngüsü - Oyun döngüsü ve sahneler arası geçişler
 * Burada tüm oyun mantığı ve durum yönetimi yapılıyor
 */

import { DynamicLevelManager } from "./dynamicLevel.js";
import { LaserSystem, LaserEffects } from "./laser.js";
import { UIManager, HUDRenderer } from "./ui.js";
import { Vector2 } from "./utils.js";
import {
  KEYS,
  GAME_STATES,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TARGET_FPS,
  COLORS,
  TILE_SIZE,
} from "./constants.js";
import { CollisionManager } from "./collision.js";
import {
  powerManager,
  setupPowerManagement,
  POWER_EVENTS,
} from "./powerManagement.js";
import { getText, formatTime, formatScore } from "./localization.js";
import { audioManager } from "./audioManager.js";

// ===== GİRİŞ YÖNETİCİSİ =====

/**
 * tuş kontrol sistemi
 */
class InputManager {
  constructor() {
    this.keys = {};
    this.previousKeys = {};
    this.setupEventListeners();
  }

  /**
   * Event listener'lar
   */
  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      e.preventDefault();
    });

    // Pencere odağını kaybettiğimizde tuşları temizle
    window.addEventListener("blur", () => {
      this.keys = {};
    });

    // Canvas'a tıklandığında odaklan
    document.addEventListener("click", () => {
      const canvas = document.getElementById("game");
      if (canvas) canvas.focus();
    });
  }

  /**
   * Tuşa şu an basılıyor mu kontrol et
   * @param {string} keyCode - Tuş kodu
   * @returns {boolean} Basılıyor mu
   */
  isKeyPressed(keyCode) {
    return !!this.keys[keyCode];
  }

  /**
   * Tuş bu frame'de yeni mi basıldı kontrol et
   * @param {string} keyCode - Tuş kodu
   * @returns {boolean} Bu frame'de mi basıldı
   */
  isKeyJustPressed(keyCode) {
    return this.keys[keyCode] && !this.previousKeys[keyCode];
  }

  /**
   * Oyuncu için girdi durumunu al
   * @returns {Object} Girdi durumu
   */
  getPlayerInputState() {
    return {
      left: this.isKeyPressed("KeyA") || this.isKeyPressed("ArrowLeft"),
      right: this.isKeyPressed("KeyD") || this.isKeyPressed("ArrowRight"),
      up: this.isKeyPressed("KeyW") || this.isKeyPressed("ArrowUp"),
      down: this.isKeyPressed("KeyS") || this.isKeyPressed("ArrowDown"),
      dash: this.isKeyPressed("Space"),
      interact: this.isKeyPressed("KeyE"),
    };
  }

  /**
   * Girdi durumunu güncelle
   */
  update() {
    this.previousKeys = { ...this.keys };
  }
}

/**
 * Oyun durumu yöneticisi - menü, oyun, duraklama vs.
 */
class GameStateManager {
  constructor() {
    this.currentState = GAME_STATES.MENU;
    this.previousState = null;
    this.stateData = {};
    this.stateChangeCallbacks = new Map();
  }

  /**
   * Oyun durumunu değiştir
   * @param {string} newState - Yeni durum
   * @param {Object} data - Durum verisi
   */
  changeState(newState, data = {}) {
    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateData = data;

    // Eğer bu durum için bir callback varsa çalıştır
    const callback = this.stateChangeCallbacks.get(newState);
    if (callback) {
      callback(this.previousState, newState, data);
    }
  }

  /**
   * Durum değişikliği için callback kaydet
   * @param {string} state - Durum
   * @param {Function} callback - Callback fonksiyonu
   */
  onStateChange(state, callback) {
    this.stateChangeCallbacks.set(state, callback);
  }

  getCurrentState() {
    return this.currentState;
  }

  getPreviousState() {
    return this.previousState;
  }

  getStateData() {
    return this.stateData;
  }
}

/**
 * Ana oyun sınıfı
 */
export class Game {
  constructor() {
    // Temel sistemler
    this.canvas = null;
    this.ctx = null;
    this.inputManager = new InputManager();
    this.gameStateManager = new GameStateManager();
    this.collisionManager = new CollisionManager();

    // Oyun sistemleri
    this.levelManager = new DynamicLevelManager();
    this.laserSystem = new LaserSystem();
    this.laserEffects = new LaserEffects();
    this.uiManager = new UIManager();
    this.hudRenderer = new HUDRenderer();
    this.audioManager = audioManager;

    // UI durumu
    this.buttonHoverState = { nextButton: false, menuButton: false };

    // Güç Yönetim Sistemi
    this.powerManager = setupPowerManagement(this, false);
    this.setupPowerManagementEvents();

    // Oyun döngüsü
    this.isRunning = false;
    this.animationId = null;
    this.lastTime = 0;

    // Oyun verileri
    this.gameData = {
      levelNumber: 1,
      score: 0,
      highScore: this.loadHighScore(),
      totalTime: 0,
      lives: 1,
      objectives: [],
      stats: {
        dashCount: 0,
        interactionCount: 0,
        timeElapsed: 0,
      },
      powerStats: {
        totalCellPowerings: 0,
        totalPowerTime: 0,
      },
    };

    this.initialize();
  }

  /**
   * Güç yönetimi olaylarını dinle
   */
  setupPowerManagementEvents() {
    // Güç hücresi olaylarını dinle
    this.powerManager.addEventListener(POWER_EVENTS.CELL_POWERED, (data) => {
      this.gameData.powerStats.totalCellPowerings++;
    });
  }

  /**
   * Oyunu başlat - sistemleri hazırla
   */
  async initialize() {
    this.setupCanvas();
    this.setupUICallbacks();
    this.setupGameStates();
    this.setupLevelCompletionHandler();

    // Level manager'a laser sistemini tanıt
    this.levelManager.setLaserSystem(this.laserSystem);

    // Level manager'a UI manager'ı tanıt (bildirimler için)
    this.levelManager.setUIManager(this.uiManager);

    // Laser sistemi debug modunu ayarla
    this.laserSystem.setDebugMode(false);

    // Ses yöneticisini başlat
    await this.audioManager.initialize();

    // Level manager'ı başlat
    const levelInitSuccess = await this.levelManager.initialize();
    if (!levelInitSuccess) {
      console.warn(
        "Dinamik seviye sistemi başlatılamadı, yedek sisteme geçiliyor"
      );
    }

    // Oyunu başlat
    this.gameStateManager.changeState(GAME_STATES.MENU);
    this.start();

    console.log("Oyun sistemleri başarıyla hazırlandı");
  }

  /**
   * Bölüm tamamlanma olayını dinle
   */
  setupLevelCompletionHandler() {
    this.levelManager.setLevelCompleteCallback((levelNumber) => {
      this.gameStateManager.changeState(GAME_STATES.LEVEL_COMPLETE);
    });

    window.addEventListener("levelComplete", (event) => {
      if (this.gameStateManager.getCurrentState() === GAME_STATES.PLAYING) {
        this.gameStateManager.changeState(GAME_STATES.LEVEL_COMPLETE);
      }
    });
  }

  /**
   * Canvas'ı hazırla
   */
  setupCanvas() {
    this.canvas = document.getElementById("game");
    if (!this.canvas) {
      console.error("Canvas elementi bulunamadı!");
      return;
    }

    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      console.error("2D context alınamadı!");
      return;
    }

    // Canvas ayarları
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.canvas.style.background = COLORS.BACKGROUND;
    this.canvas.style.border = "2px solid " + COLORS.UI_TEXT;
    this.canvas.style.display = "block";
    this.canvas.style.margin = "0 auto";
    this.canvas.tabIndex = 0;
    this.canvas.focus();

    // Fare olaylarını dinle
    this.canvas.addEventListener("click", (event) =>
      this.handleCanvasClick(event)
    );
    this.canvas.addEventListener("mousemove", (event) =>
      this.handleCanvasMouseMove(event)
    );
  }

  /**
   * UI callback'lerini ayarla
   */
  setupUICallbacks() {
    this.uiManager.setButtonCallbacks({
      onBack: () => {
        if (this.gameStateManager.getCurrentState() === GAME_STATES.PLAYING) {
          this.gameStateManager.changeState(GAME_STATES.MENU);
        }
      },
      onRestart: () => {
        if (this.gameStateManager.getCurrentState() === GAME_STATES.PLAYING) {
          this.restartLevel();
        }
      },
      onMemory: () => {
        const levelState = this.levelManager.exportLevelState();
        const metadata = this.levelManager.currentLevel?.metadata;
        this.uiManager.setMemoryData({ levelState, metadata });
      },
    });
  }

  /**
   * Oyun durumlarını ayarla
   */
  setupGameStates() {
    // Menü durumu
    this.gameStateManager.onStateChange(GAME_STATES.MENU, () => {
      this.hudRenderer.setVisible(false);
      // Menüde müziği duraklat
      this.audioManager.pauseBackgroundMusic();
    });

    // Oyun durumu
    this.gameStateManager.onStateChange(GAME_STATES.PLAYING, async () => {
      this.hudRenderer.setVisible(true);
      this.uiManager.showLoadingOverlay(true, getText("ui.generatingWorld"));

      // Oyun oynarken müziği çal
      this.audioManager.playBackgroundMusic();

      try {
        const success = await this.levelManager.generateLevel(
          this.gameData.levelNumber
        );

        if (success) {
          this.uiManager.showNotification(
            getText("notifications.levelGenerated", {
              level: this.gameData.levelNumber,
            }),
            "success"
          );
        } else {
          this.uiManager.showNotification(
            getText("notifications.levelGenerationFailed"),
            "warning"
          );
        }

        // Eğer hiç varlık yoksa acil durum seviyesi oluştur
        if (this.levelManager.entities.length === 0) {
          this.createEmergencyLevel();
        }

        this.uiManager.showLoadingOverlay(false);
        this.updateObjectives();
      } catch (error) {
        console.error("Seviye oluşturma hatası:", error);
        this.createEmergencyLevel();
        this.uiManager.showLoadingOverlay(false);
        this.uiManager.showNotification(
          getText("notifications.emergencyLevel"),
          "error"
        );
      }
    });

    // Oyun bitti durumu
    this.gameStateManager.onStateChange(GAME_STATES.GAME_OVER, () => {
      this.uiManager.showNotification(
        getText("gameOver.restart") + " - " + getText("gameOver.menu"),
        "error",
        5000
      );
      // Oyun bittiğinde müziği duraklat
      this.audioManager.pauseBackgroundMusic();
    });

    // Bölüm tamamlandı durumu
    this.gameStateManager.onStateChange(GAME_STATES.LEVEL_COMPLETE, () => {
      // Bölüm geçiş sesini çal
      this.audioManager.playSoundEffect("level-pass");

      // Zaman bonusu hesapla
      const timeBonus = Math.max(
        0,
        10000 - this.gameData.stats.timeElapsed * 10
      );
      this.gameData.score += timeBonus;

      // Başarı bildirimini göster
      this.uiManager.showNotification(
        getText("levelComplete.title"),
        "success",
        3000
      );

      // Gerekirse yeni rekor kaydet
      if (this.gameData.score > this.gameData.highScore) {
        this.gameData.highScore = this.gameData.score;
        this.saveHighScore(this.gameData.score);
      }

      // Bölüm geçiş ekranında müziği çalmaya devam et
    });
  }

  /**
   * Acil durum seviyesi oluştur
   */
  createEmergencyLevel() {
    this.levelManager.clearLevel();

    try {
      const emergencyEntities = [
        { type: "Player", x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
        { type: "PowerCell", x: 6 * TILE_SIZE, y: 2 * TILE_SIZE, id: "cell1" },
      ];

      for (const entityData of emergencyEntities) {
        const worldPos = new Vector2(entityData.x, entityData.y);
        const entity = this.levelManager.createEntity(entityData, worldPos);
        if (entity) {
          this.levelManager.entities.push(entity);
        }
      }
    } catch (error) {
      console.error("Acil durum seviyesi oluşturulamadı:", error);
    }
  }

  /**
   * Oyunu başlat
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Oyunu durdur
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Ana oyun döngüsü
   */
  gameLoop() {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Oyun güncellemesi
   * @param {number} deltaTime - Frame süresi
   */
  update(deltaTime) {
    const currentState = this.gameStateManager.getCurrentState();

    // Global girdi kontrolü
    this.handleGlobalInput();

    // Duruma göre güncelleme
    switch (currentState) {
      case GAME_STATES.MENU:
        this.updateMenu(deltaTime);
        break;
      case GAME_STATES.PLAYING:
        this.updatePlaying(deltaTime);
        break;
      case GAME_STATES.PAUSED:
        break;
      case GAME_STATES.GAME_OVER:
        break;
    }

    // UI ve efektleri güncelle
    this.uiManager.update(
      { current: currentState },
      this.levelManager.getDebugInfo(),
      this.laserSystem.getStats()
    );
    this.laserEffects.update(deltaTime);

    // Girdi durumunu son olarak güncelle
    this.inputManager.update();
  }

  /**
   * Global girdi kontrolü
   */
  handleGlobalInput() {
    const currentState = this.gameStateManager.getCurrentState();

    // Müzik sesini kapat/aç
    if (this.inputManager.isKeyJustPressed("KeyM")) {
      this.audioManager.toggleMute();
      this.uiManager.showNotification(
        this.audioManager.isMuted ? "Müzik Kapatıldı" : "Müzik Açıldı",
        "info",
        1000
      );
    }

    // Menü navigasyonu
    if (currentState === GAME_STATES.MENU) {
      if (this.inputManager.isKeyJustPressed("Space")) {
        this.gameStateManager.changeState(GAME_STATES.PLAYING);
      }
    }

    // Bölüm tamamlandı navigasyonu
    if (currentState === GAME_STATES.LEVEL_COMPLETE) {
      if (this.inputManager.isKeyJustPressed("Space")) {
        // Sonraki bölüme geç
        this.gameData.levelNumber++;
        this.gameData.stats = {
          dashCount: 0,
          interactionCount: 0,
          timeElapsed: 0,
        }; // İstatistikleri sıfırla
        this.gameStateManager.changeState(GAME_STATES.PLAYING);
      } else if (this.inputManager.isKeyJustPressed("Escape")) {
        // Menüye dön
        this.gameStateManager.changeState(GAME_STATES.MENU);
      }
    }

    // Oyun bitti yeniden başlatma
    if (currentState === GAME_STATES.GAME_OVER) {
      if (this.inputManager.isKeyJustPressed("KeyR")) {
        this.gameData.levelNumber = 1;
        this.gameData.score = 0;
        this.gameData.lives = 1;
        this.gameData.stats = {
          dashCount: 0,
          interactionCount: 0,
          timeElapsed: 0,
        };
        this.gameStateManager.changeState(GAME_STATES.PLAYING);
      } else if (this.inputManager.isKeyJustPressed("Escape")) {
        this.gameStateManager.changeState(GAME_STATES.MENU);
      }
    }

    // Oyun sırasında duraklama/devam ettirme
    if (
      currentState === GAME_STATES.PLAYING ||
      currentState === GAME_STATES.PAUSED
    ) {
      if (this.inputManager.isKeyJustPressed("Escape")) {
        const newState =
          currentState === GAME_STATES.PLAYING
            ? GAME_STATES.PAUSED
            : GAME_STATES.PLAYING;
        this.gameStateManager.changeState(newState);

        // Oyun durumu ile birlikte müziği de duraklat/devam ettir
        if (newState === GAME_STATES.PAUSED) {
          this.audioManager.pauseBackgroundMusic();
        } else {
          this.audioManager.playBackgroundMusic();
        }
      }

      // Bölümü yeniden başlat
      if (this.inputManager.isKeyJustPressed("KeyR")) {
        this.restartLevel();
      }
    }
  }

  /**
   * Menü güncellemesi
   * @param {number} deltaTime - Frame süresi
   */
  updateMenu(deltaTime) {
    if (this.inputManager.isKeyJustPressed("Space")) {
      this.gameStateManager.changeState(GAME_STATES.PLAYING);
    }
  }

  /**
   * Oyun durumu güncellemesi
   * @param {number} deltaTime - Frame süresi
   */
  updatePlaying(deltaTime) {
    // Level manager'ı güncelle
    this.levelManager.update(deltaTime);

    // Gerekirse güç yönetimini başlat (varlıklar değiştiğinde)
    if (
      !this.powerManager.laserStates.size &&
      this.levelManager.entities.length > 0
    ) {
      this.powerManager.initialize(this.levelManager.entities);
    }

    // Oyuncuyu merkezi çarpışma kontrolü ile güncelle
    if (this.levelManager.player) {
      const inputState = this.inputManager.getPlayerInputState();
      this.levelManager.player.updateInput(inputState);
      this.levelManager.player.update(deltaTime);
    }

    // Laser sistemini güncelle
    const laserCollisionCallback = (pos) =>
      this.levelManager.hasCollisionAt(pos);
    this.laserSystem.update(this.levelManager.entities, laserCollisionCallback);

    // Güç yönetim sistemini mevcut laser ışınları ile güncelle
    this.powerManager.update(
      this.levelManager.entities,
      this.laserSystem.getActiveBeams()
    );

    // Oyun verisindeki güç istatistiklerini güncelle
    const powerStats = this.powerManager.getStatistics();
    this.gameData.powerStats = {
      totalCellPowerings:
        powerStats.totalCellPowerings ||
        this.gameData.powerStats.totalCellPowerings,
      totalPowerTime:
        powerStats.totalPowerTime || this.gameData.powerStats.totalPowerTime,
    };

    // Laser efektlerini güncelle
    this.laserEffects.update(deltaTime);

    // Oyuncu-laser çarpışmasını kontrol et
    if (
      this.levelManager.player &&
      this.laserSystem.checkPlayerCollision(this.levelManager.player)
    ) {
      this.playerDeath();
      return;
    }

    // Oyuncu etkileşimlerini güncelle
    this.levelManager.updatePlayerInteractions();

    // Görevleri güncelle
    this.updateObjectives();

    // Oyun bitti kontrolü
    if (this.levelManager.player?.health <= 0) {
      this.playerDeath();
    }
  }

  /**
   * Oyuncu ölümü - can kaybı vs.
   */
  playerDeath() {
    // Kalıcı girdi durumunu temizle
    this.inputManager.keys = {};
    this.inputManager.previousKeys = {};

    // Ölüm ses efektini çal
    this.audioManager.playSoundEffect("death");

    this.gameData.lives--;

    if (this.gameData.lives <= 0) {
      this.gameStateManager.changeState(GAME_STATES.GAME_OVER);
    } else {
      this.uiManager.showNotification(
        `Canlar: ${this.gameData.lives}`,
        "warning"
      );
      this.restartLevel();
    }
  }

  /**
   * Bölümü yeniden başlat - temiz slate
   */
  restartLevel() {
    // Kalıcı girdi durumunu temizle
    this.inputManager.keys = {};
    this.inputManager.previousKeys = {};

    // Oyuncu varsa durumunu sıfırla
    if (this.levelManager.player) {
      this.levelManager.player.resetState();
    }

    this.levelManager.restartLevel();

    // Güç yönetimi durumlarını temizle
    this.powerManager.clearStates();

    // Mevcut deneme için güç istatistiklerini sıfırla
    this.gameData.powerStats = {
      totalCellPowerings: 0,
      totalPowerTime: 0,
    };

    this.uiManager.showNotification("Bölüm sıfırlandı", "info");
  }

  /**
   * Görevleri güncelle - oyuncunun ne yapması gerektiğini göster
   */
  updateObjectives() {
    const powerCells = this.levelManager.entities.filter(
      (e) => e.constructor.name === "PowerCell"
    );
    const poweredCount = powerCells.filter((cell) => cell.isPowered).length;
    const allPowerCellsActivated =
      poweredCount === powerCells.length && powerCells.length > 0;

    // Oyuncunun çıkış odasında olup olmadığını kontrol et
    const playerPos = this.levelManager.player
      ? this.levelManager.player.getCenter()
      : null;
    const currentRoom = playerPos
      ? this.levelManager.worldManager.getRoomAtWorldPosition(playerPos)
      : null;
    const isInExitRoom = currentRoom && currentRoom.isExit;

    this.gameData.objectives = [
      {
        text: `Tüm güç hücrelerini aktif et (${poweredCount}/${powerCells.length})`,
        completed: allPowerCellsActivated,
      },
      {
        text: "Çıkış odasına ulaş",
        completed: isInExitRoom,
      },
      {
        text: "Bölümü tamamlamak için tüm güç hücrelerini aktif et ve çıkış odasına ulaş",
        completed: allPowerCellsActivated && isInExitRoom,
      },
    ];
  }

  render() {
    if (!this.ctx) return;

    // Canvas'ı temizle
    this.ctx.fillStyle = COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const currentState = this.gameStateManager.getCurrentState();

    switch (currentState) {
      case GAME_STATES.MENU:
        this.renderMenu();
        break;
      case GAME_STATES.PLAYING:
      case GAME_STATES.PAUSED:
        this.renderPlaying();
        break;
      case GAME_STATES.LEVEL_COMPLETE:
        this.renderLevelComplete();
        break;
      case GAME_STATES.GAME_OVER:
        this.renderGameOver();
        break;
    }

    // HUD'ı çiz
    this.hudRenderer.render(this.ctx, this.gameData);
  }

  renderMenu() {
    if (!this.ctx) return;

    this.ctx.save();

    // Arka plan gradyanı
    const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, COLORS.BACKGROUND);
    gradient.addColorStop(1, "#0f1932");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Parlama efektli başlık
    this.ctx.fillStyle = COLORS.LASER_BEAM;
    this.ctx.font = "bold 48px Arial";
    this.ctx.textAlign = "center";
    this.ctx.shadowColor = COLORS.LASER_BEAM;
    this.ctx.shadowBlur = 20;
    this.ctx.fillText(
      getText("menu.title"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 100
    );

    // Alt başlık için gölgeyi kaldır
    this.ctx.shadowBlur = 0;

    // Alt başlık
    this.ctx.fillStyle = COLORS.UI_TEXT;
    this.ctx.font = "24px Arial";
    this.ctx.fillText(
      getText("menu.subtitle"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 50
    );

    // Başlama talimatı
    this.ctx.font = "20px Arial";
    this.ctx.fillStyle = COLORS.POWER_CELL_POWERED;
    this.ctx.fillText(
      getText("menu.startGame"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 50
    );

    // En yüksek skor
    this.ctx.font = "18px Arial";
    this.ctx.fillStyle = COLORS.LASER_HIT;
    this.ctx.fillText(
      getText("menu.highScore", {
        score: formatScore(this.gameData.highScore),
      }),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 90
    );

    // Kontroller
    this.ctx.font = "14px Arial";
    this.ctx.fillStyle = COLORS.UI_TEXT;
    this.ctx.fillText(
      getText("menu.controls"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 150
    );

    this.ctx.restore();
  }

  /**
   * Oyun durumu
   */
  renderPlaying() {
    this.levelManager.render(this.ctx);

    this.laserEffects.render(this.ctx);

    if (this.gameStateManager.getCurrentState() === GAME_STATES.PAUSED) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.fillStyle = COLORS.UI_TEXT;
      this.ctx.font = "bold 36px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        getText("game.paused"),
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2
      );

      this.ctx.font = "18px Arial";
      this.ctx.fillText(
        getText("game.pauseInstruction"),
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 50
      );

      this.ctx.restore();
    }
  }

  renderGameOver() {
    this.renderPlaying();

    this.ctx.save();

    const gradient = this.ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      0,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH / 2
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.9)");
    gradient.addColorStop(1, "rgba(26, 26, 46, 0.95)");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Parlama efektli Oyun Bitti başlığı
    this.ctx.fillStyle = COLORS.PLAYER;
    this.ctx.font = "bold 48px Arial";
    this.ctx.textAlign = "center";
    this.ctx.shadowColor = COLORS.PLAYER;
    this.ctx.shadowBlur = 20;
    this.ctx.fillText(
      getText("gameOver.title"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 50
    );

    // Diğer yazılar için gölgeyi kaldır
    this.ctx.shadowBlur = 0;

    // İstatistikler
    this.ctx.fillStyle = COLORS.UI_TEXT;
    this.ctx.font = "24px Arial";
    this.ctx.fillText(
      getText("gameOver.levelReached", { level: this.gameData.levelNumber }),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 10
    );

    this.ctx.fillText(
      getText("gameOver.finalScore", {
        score: formatScore(this.gameData.score),
      }),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 50
    );

    // Yeni rekor bildirimi
    if (this.gameData.score >= this.gameData.highScore) {
      this.ctx.fillStyle = COLORS.LASER_HIT;
      this.ctx.font = "bold 20px Arial";
      this.ctx.fillText(
        getText("gameOver.newHighScore"),
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 90
      );
    }

    // Talimatlar
    this.ctx.fillStyle = COLORS.POWER_CELL_POWERED;
    this.ctx.font = "18px Arial";
    this.ctx.fillText(
      getText("gameOver.restart") + " | " + getText("gameOver.menu"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 130
    );

    this.ctx.restore();
  }

  /**
   * Kaynakları temizle
   */
  destroy() {
    this.stop();
    this.uiManager.destroy();
    this.levelManager.clearLevel();
    this.audioManager.destroy();

    // Fare event listener'larını kaldır
    if (this.canvas) {
      this.canvas.removeEventListener("click", this.handleCanvasClick);
      this.canvas.removeEventListener("mousemove", this.handleCanvasMouseMove);
      this.canvas.style.cursor = "default";
    }
  }

  /**
   * En yüksek skoru yükle
   * @returns {number} En yüksek skor
   */
  loadHighScore() {
    try {
      return parseInt(localStorage.getItem("dungeonRunnerHighScore")) || 0;
    } catch (error) {
      console.warn("En yüksek skor yüklenemedi:", error);
      return 0;
    }
  }

  /**
   * En yüksek skoru kaydet
   * @param {number} score - Kaydedilecek skor
   */
  saveHighScore(score) {
    try {
      localStorage.setItem("dungeonRunnerHighScore", score.toString());
    } catch (error) {
      console.warn("En yüksek skor kaydedilemedi:", error);
    }
  }

  /**
   * Bölüm tamamlandı
   */
  renderLevelComplete() {
    // Son frame'i arka plan olarak çiz
    this.renderPlaying();

    // Yarı şeffaf overlay
    this.ctx.save();
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tamamlanma paneli için gradyan arka plan
    const gradient = this.ctx.createLinearGradient(
      CANVAS_WIDTH / 2 - 300,
      CANVAS_HEIGHT / 2 - 200,
      CANVAS_WIDTH / 2 + 300,
      CANVAS_HEIGHT / 2 + 200
    );
    gradient.addColorStop(0, "rgba(116, 185, 255, 0.2)");
    gradient.addColorStop(0.5, "rgba(0, 184, 148, 0.3)");
    gradient.addColorStop(1, "rgba(116, 185, 255, 0.2)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      CANVAS_WIDTH / 2 - 300,
      CANVAS_HEIGHT / 2 - 200,
      600,
      400
    );

    // Panel çerçevesi
    this.ctx.strokeStyle = COLORS.LASER_BEAM;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(
      CANVAS_WIDTH / 2 - 300,
      CANVAS_HEIGHT / 2 - 200,
      600,
      400
    );

    // Parlama efektli başlık
    this.ctx.fillStyle = COLORS.LASER_BEAM;
    this.ctx.font = "bold 42px Arial";
    this.ctx.textAlign = "center";
    this.ctx.shadowColor = COLORS.LASER_BEAM;
    this.ctx.shadowBlur = 20;
    this.ctx.fillText(
      getText("levelComplete.title"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 140
    );

    // Sonraki yazılar için gölgeyi kaldır
    this.ctx.shadowBlur = 0;

    // Tebrik yazısı
    this.ctx.fillStyle = COLORS.UI_TEXT;
    this.ctx.font = "24px Arial";
    this.ctx.fillText(
      getText("levelComplete.congratulations"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 90
    );

    // Bölüm tamamlanma bilgisi
    this.ctx.font = "20px Arial";
    this.ctx.fillText(
      getText("levelComplete.levelCompleted", {
        level: this.gameData.levelNumber,
      }),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 50
    );

    // İstatistikler bölümü
    this.ctx.fillStyle = COLORS.POWER_CELL_POWERED;
    this.ctx.font = "18px Arial";

    const timeBonus = Math.max(0, 10000 - this.gameData.stats.timeElapsed * 10);
    const stats = [
      getText("levelComplete.stats.timeElapsed", {
        time: Math.floor(this.gameData.stats.timeElapsed / 1000),
      }),
      getText("levelComplete.stats.dashCount", {
        count: this.gameData.stats.dashCount,
      }),
      getText("levelComplete.stats.interactionCount", {
        count: this.gameData.stats.interactionCount,
      }),
      getText("levelComplete.timeBonus", { bonus: formatScore(timeBonus) }),
    ];

    stats.forEach((stat, index) => {
      this.ctx.fillText(
        stat,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - 10 + index * 25
      );
    });

    // Toplam skor
    this.ctx.fillStyle = COLORS.LASER_HIT;
    this.ctx.font = "bold 22px Arial";
    this.ctx.fillText(
      getText("levelComplete.totalScore", {
        score: formatScore(this.gameData.score),
      }),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 80
    );

    // Gelişmiş stil ile düğmeler
    this.renderLevelCompleteButtons();

    // Talimatlar
    this.ctx.fillStyle = COLORS.UI_TEXT;
    this.ctx.font = "14px Arial";
    this.ctx.fillText(
      "SPACE - " +
        getText("levelComplete.nextLevel") +
        " | ESC - " +
        getText("levelComplete.backToMenu"),
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 170
    );

    this.ctx.restore();
  }

  /**
   * Bölüm tamamlandı ekranı için etkileşimli düğmeler çiz
   */
  renderLevelCompleteButtons() {
    const buttonWidth = 180;
    const buttonHeight = 40;
    const buttonY = CANVAS_HEIGHT / 2 + 120;

    // Hover durumunu başlat eğer ayarlanmamışsa
    if (!this.buttonHoverState) {
      this.buttonHoverState = { nextButton: false, menuButton: false };
    }

    // Sonraki Bölüm Düğmesi
    const nextButtonX = CANVAS_WIDTH / 2 - buttonWidth - 10;
    const isHoveringNext = this.buttonHoverState.nextButton;

    // Hover efektli düğme arka planı
    this.ctx.fillStyle = isHoveringNext
      ? COLORS.LASER_BEAM
      : COLORS.POWER_CELL_POWERED;
    this.ctx.fillRect(nextButtonX, buttonY, buttonWidth, buttonHeight);

    // Hover efektli düğme çerçevesi
    this.ctx.strokeStyle = isHoveringNext
      ? COLORS.POWER_CELL_POWERED
      : COLORS.LASER_BEAM;
    this.ctx.lineWidth = isHoveringNext ? 3 : 2;
    this.ctx.strokeRect(nextButtonX, buttonY, buttonWidth, buttonHeight);

    // Düğme yazısı
    this.ctx.fillStyle = isHoveringNext ? COLORS.BACKGROUND : COLORS.BACKGROUND;
    this.ctx.font = "bold 16px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      getText("levelComplete.nextLevel"),
      nextButtonX + buttonWidth / 2,
      buttonY + buttonHeight / 2 + 6
    );

    // Menü Düğmesi
    const menuButtonX = CANVAS_WIDTH / 2 + 10;
    const isHoveringMenu = this.buttonHoverState.menuButton;

    // Hover efektli düğme arka planı
    this.ctx.fillStyle = isHoveringMenu ? COLORS.UI_TEXT : COLORS.UI_BUTTON;
    this.ctx.fillRect(menuButtonX, buttonY, buttonWidth, buttonHeight);

    // Hover efektli düğme çerçevesi
    this.ctx.strokeStyle = isHoveringMenu ? COLORS.LASER_BEAM : COLORS.UI_TEXT;
    this.ctx.lineWidth = isHoveringMenu ? 3 : 2;
    this.ctx.strokeRect(menuButtonX, buttonY, buttonWidth, buttonHeight);

    // Düğme yazısı
    this.ctx.fillStyle = isHoveringMenu ? COLORS.BACKGROUND : COLORS.UI_TEXT;
    this.ctx.fillText(
      getText("levelComplete.backToMenu"),
      menuButtonX + buttonWidth / 2,
      buttonY + buttonHeight / 2 + 6
    );
  }

  /**
   * Canvas'a tıklama olaylarını işle
   */
  handleCanvasClick(event) {
    const currentState = this.gameStateManager.getCurrentState();

    if (currentState === GAME_STATES.LEVEL_COMPLETE) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Fare koordinatlarını canvas iç koordinatlarına ölçekle
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const canvasX = mouseX * scaleX;
      const canvasY = mouseY * scaleY;

      this.checkLevelCompleteButtonClicks(canvasX, canvasY);
    }
  }

  /**
   * Hover efektleri için fare hareketini işle
   */
  handleCanvasMouseMove(event) {
    const currentState = this.gameStateManager.getCurrentState();

    if (currentState === GAME_STATES.LEVEL_COMPLETE) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Fare koordinatlarını canvas iç koordinatlarına ölçekle
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const canvasX = mouseX * scaleX;
      const canvasY = mouseY * scaleY;

      this.updateButtonHoverState(canvasX, canvasY);
    }
  }

  /**
   * Fare tıklamasının bölüm tamamlandı düğmelerinde olup olmadığını kontrol et
   */
  checkLevelCompleteButtonClicks(mouseX, mouseY) {
    const buttonWidth = 180;
    const buttonHeight = 40;
    const buttonY = CANVAS_HEIGHT / 2 + 120;

    // Sonraki Bölüm Düğmesi
    const nextButtonX = CANVAS_WIDTH / 2 - buttonWidth - 10;
    if (
      mouseX >= nextButtonX &&
      mouseX <= nextButtonX + buttonWidth &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonHeight
    ) {
      // Sonraki bölüme tıklandı
      this.gameData.levelNumber++;
      this.gameData.stats = {
        dashCount: 0,
        interactionCount: 0,
        timeElapsed: 0,
      };
      this.gameStateManager.changeState(GAME_STATES.PLAYING);
      return;
    }

    // Menü Düğmesi
    const menuButtonX = CANVAS_WIDTH / 2 + 10;
    if (
      mouseX >= menuButtonX &&
      mouseX <= menuButtonX + buttonWidth &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonHeight
    ) {
      // Menüye dön tıklandı
      this.gameStateManager.changeState(GAME_STATES.MENU);
      return;
    }
  }

  /**
   * Görsel geri bildirim için düğme hover durumunu güncelle
   */
  updateButtonHoverState(mouseX, mouseY) {
    const buttonWidth = 180;
    const buttonHeight = 40;
    const buttonY = CANVAS_HEIGHT / 2 + 120;

    // Sonraki Bölüm Düğmesi
    const nextButtonX = CANVAS_WIDTH / 2 - buttonWidth - 10;
    const isHoveringNext =
      mouseX >= nextButtonX &&
      mouseX <= nextButtonX + buttonWidth &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonHeight;

    // Menü Düğmesi
    const menuButtonX = CANVAS_WIDTH / 2 + 10;
    const isHoveringMenu =
      mouseX >= menuButtonX &&
      mouseX <= menuButtonX + buttonWidth &&
      mouseY >= buttonY &&
      mouseY <= buttonY + buttonHeight;

    this.buttonHoverState = {
      nextButton: isHoveringNext,
      menuButton: isHoveringMenu,
    };

    // İmleç stilini değiştir
    this.canvas.style.cursor =
      isHoveringNext || isHoveringMenu ? "pointer" : "default";
  }
}

// ===== OTOMATİK BAŞLATMA =====

/**
 * Oyun başlatma fonksiyonu - sade ve anlaşılır
 */
function startGame() {
  if (window.game) {
    if (!(window.game instanceof Game)) {
      window.game = null;
    } else if (!window.game.isRunning) {
      window.game.start();
      return;
    } else {
      return;
    }
  }

  try {
    window.game = new Game();

    // Global debug fonksiyonları ekle
    window.debugCollision = () => {
      if (!window.game || !window.game.levelManager) {
        console.log("Oyun veya seviye yöneticisi mevcut değil");
        return;
      }

      const solidObjects = window.game.levelManager.solidObjects;
      console.log(`Katı objeler (${solidObjects.length}):`);
      solidObjects.forEach((obj, index) => {
        const bounds = obj.getBounds();
        console.log(
          `${index}: ${obj.constructor.name} konumda (${bounds.x}, ${bounds.y}) boyut (${bounds.width}x${bounds.height})`
        );
      });
    };

    window.testCollisionAt = (x, y) => {
      if (!window.game || !window.game.levelManager) {
        console.log("Oyun veya seviye yöneticisi mevcut değil");
        return;
      }

      const pos = new Vector2(x, y);
      const hasCollision = window.game.levelManager.hasCollisionAt(pos);
      console.log(`(${x}, ${y}) konumunda çarpışma: ${hasCollision}`);

      // Hangi objenin çarpışmaya sebep olduğunu göster
      if (hasCollision) {
        const solidObjects = window.game.levelManager.solidObjects;
        for (const obj of solidObjects) {
          const bounds = obj.getBounds();
          if (
            x >= bounds.x &&
            x < bounds.x + bounds.width &&
            y >= bounds.y &&
            y < bounds.y + bounds.height
          ) {
            console.log(
              `Çarpışmaya sebep olan: ${obj.constructor.name} konumda (${bounds.x}, ${bounds.y})`
            );
            break;
          }
        }
      }
    };

    console.log(
      "Debug fonksiyonları eklendi: debugCollision(), testCollisionAt(x, y)"
    );
  } catch (error) {
    console.error("Oyun örneği oluşturulurken hata:", error);
  }
}

// DOM hazır olduğunda oyunu başlat
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startGame);
} else {
  startGame();
}

// Yedek başlatma
setTimeout(() => {
  if (!window.game) {
    startGame();
  }
}, 1000);

// Hata yakalama
window.addEventListener("error", (e) => {
  console.error("Oyun hatası:", e.error);
});

// Sayfa kapatılırken temizlik
window.addEventListener("beforeunload", () => {
  if (window.game) {
    window.game.destroy();
  }
});

export default Game;
