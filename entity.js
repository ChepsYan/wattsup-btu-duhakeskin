/**
 * Entity Class
 * Door, LaserEmitter, Button, PowerCell
 */

import { Vector2, generateUID } from "./utils.js";
import {
  TILE_SIZE,
  DIRECTIONS,
  COLORS,
  DOOR_ANIMATION_FRAMES,
  EASING,
} from "./constants.js";
import { powerManager } from "./powerManagement.js";
import { audioManager } from "./audioManager.js";

/**
 * Tüm oyun varlıkları için class
 */
export class Entity {
  constructor(x = 0, y = 0, width = TILE_SIZE, height = TILE_SIZE) {
    this.id = generateUID();
    this.position = new Vector2(x, y);
    this.width = width;
    this.height = height;
    this.visible = true;
    this.active = true;
    this.solid = false;
    this.layer = 1;
  }

  getBounds() {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  getCenter() {
    return new Vector2(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2
    );
  }

  getGridPosition() {
    return new Vector2(
      Math.floor(this.position.x / TILE_SIZE),
      Math.floor(this.position.y / TILE_SIZE)
    );
  }

  update(deltaTime) {
    // Override in subclasses
  }

  render(ctx) {
    if (!this.visible) return;

    // Default rendering (rectangle)
    ctx.fillStyle = COLORS.WALL;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
  }

  /**
   * Başka bir varlıkla çarpışma kontrolü
   * @param {Entity} other - Başka bir varlık
   * @returns {boolean} Çarpışıyor
   */
  intersects(other) {
    const bounds1 = this.getBounds();
    const bounds2 = other.getBounds();

    return (
      bounds1.x < bounds2.x + bounds2.width &&
      bounds1.x + bounds1.width > bounds2.x &&
      bounds1.y < bounds2.y + bounds2.height &&
      bounds1.y + bounds1.height > bounds2.y
    );
  }

  destroy() {
    this.active = false;
  }
}

// ===== DOOR SINIFI =====

/**
 * Kapı - Açılıp kapanabilen engel
 */
export class Door extends Entity {
  constructor(x, y, direction = "S", id = null) {
    super(x, y);
    this.id = id || generateUID();
    this.direction = direction; // Kapının yönü
    this.isOpen = false;
    this.isAnimating = false;
    this.animationTimer = 0;
    this.animationDirection = 1; // 1 = açılıyor, -1 = kapanıyor
    this.solid = true; // Kapalıyken solid
  }

  /**
   * Kapıyı aç
   */
  open() {
    if (this.isOpen || this.isAnimating) return;
    this.isAnimating = true;
    this.animationDirection = 1;
    this.animationTimer = 0;

    // Play door opening sound effect
    audioManager.playSoundEffect("door-open");
  }

  /**
   * Kapıyı kapat
   */
  close() {
    if (!this.isOpen || this.isAnimating) return;
    this.isAnimating = true;
    this.animationDirection = -1;
    this.animationTimer = DOOR_ANIMATION_FRAMES;
  }

  /**
   * Kapı durumunu toggle et
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Kapı güncellemesi
   * @param {number} deltaTime - Frame süresi
   */
  update(deltaTime) {
    if (this.isAnimating) {
      this.animationTimer += this.animationDirection;

      if (this.animationTimer >= DOOR_ANIMATION_FRAMES) {
        // Açılma tamamlandı
        this.isAnimating = false;
        this.isOpen = true;
        this.solid = false;
        this.animationTimer = DOOR_ANIMATION_FRAMES;
      } else if (this.animationTimer <= 0) {
        // Kapanma tamamlandı
        this.isAnimating = false;
        this.isOpen = false;
        this.solid = true;
        this.animationTimer = 0;
      }
    }
  }

  /**
   * Animasyon ilerlemesi (0-1)
   * @returns {number} Animasyon ilerlemesi
   */
  getAnimationProgress() {
    return this.animationTimer / DOOR_ANIMATION_FRAMES;
  }

  /**
   * Kapı çizimi - Endüstriyel mekanik kapı
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    const progress = this.getAnimationProgress();
    const openAmount = EASING.cubicOut(progress);
    const center = this.getCenter();

    ctx.translate(center.x, center.y);
    ctx.rotate((openAmount * Math.PI) / 2); // 0° -> 90° rotation

    // Kapı çerçevesi
    const frameGradient = ctx.createLinearGradient(
      -this.width / 2 - 4,
      -this.height / 2 - 4,
      this.width / 2 + 4,
      this.height / 2 + 4
    );
    frameGradient.addColorStop(0, "#616161");
    frameGradient.addColorStop(0.5, "#424242");
    frameGradient.addColorStop(1, "#212121");

    ctx.fillStyle = frameGradient;
    ctx.fillRect(
      -this.width / 2 - 4,
      -this.height / 2 - 4,
      this.width + 8,
      this.height + 8
    );

    // Ana kapı paneli
    const doorGradient = ctx.createLinearGradient(
      -this.width / 2,
      -this.height / 2,
      this.width / 2,
      this.height / 2
    );
    if (this.isOpen) {
      doorGradient.addColorStop(0, "#9c27b0");
      doorGradient.addColorStop(0.3, "#7b1fa2");
      doorGradient.addColorStop(0.7, "#6a1b9a");
      doorGradient.addColorStop(1, "#4a148c");
    } else {
      doorGradient.addColorStop(0, "#78909c");
      doorGradient.addColorStop(0.3, "#607d8b");
      doorGradient.addColorStop(0.7, "#546e7a");
      doorGradient.addColorStop(1, "#37474f");
    }

    ctx.fillStyle = doorGradient;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

    // Kapı paneli detayları
    const panelInset = 4;
    const panelWidth = this.width - panelInset * 2;
    const panelHeight = this.height - panelInset * 2;

    ctx.fillStyle = this.isOpen ? "#673ab7" : "#455a64";
    ctx.fillRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);

    // Merkezi giriş paneli
    const accessPanelSize = Math.min(panelWidth, panelHeight) * 0.4;
    ctx.fillStyle = this.isOpen ? "#8e24aa" : "#546e7a";
    ctx.fillRect(
      -accessPanelSize / 2,
      -accessPanelSize / 2,
      accessPanelSize,
      accessPanelSize
    );

    // Durum göstergesi
    const indicatorRadius = accessPanelSize * 0.15;
    ctx.fillStyle = this.isOpen ? "#00e676" : "#f44336";
    ctx.shadowColor = this.isOpen ? "#00e676" : "#f44336";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hidrolik pistonlar/sürtünme
    const pistonPositions = [
      { x: -this.width / 2 + 2, y: -this.height / 4 },
      { x: -this.width / 2 + 2, y: this.height / 4 },
    ];

    ctx.fillStyle = "#37474f";
    pistonPositions.forEach((pos) => {
      ctx.fillRect(pos.x - 2, pos.y - 3, 4, 6);
      // Piston head
      ctx.fillStyle = "#263238";
      ctx.fillRect(pos.x - 1, pos.y - 2, 2, 4);
      ctx.fillStyle = "#37474f";
    });

    // Uyarı çizgileri
    if (!this.isOpen) {
      ctx.strokeStyle = "#ffab00";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      const stripeY1 = -this.height / 2 + 8;
      const stripeY2 = this.height / 2 - 8;
      ctx.beginPath();
      ctx.moveTo(-panelWidth / 2 + 4, stripeY1);
      ctx.lineTo(panelWidth / 2 - 4, stripeY1);
      ctx.moveTo(-panelWidth / 2 + 4, stripeY2);
      ctx.lineTo(panelWidth / 2 - 4, stripeY2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Kapı sınırları
    ctx.strokeStyle = this.isOpen ? "#ba68c8" : "#90a4ae";
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

    // İç sınır
    ctx.strokeStyle = this.isOpen ? "#9575cd" : "#78909c";
    ctx.lineWidth = 1;
    ctx.strokeRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);

    // Köşe destekleri
    const cornerSize = 6;
    const cornerPositions = [
      { x: -this.width / 2, y: -this.height / 2 },
      { x: this.width / 2 - cornerSize, y: -this.height / 2 },
      { x: -this.width / 2, y: this.height / 2 - cornerSize },
      { x: this.width / 2 - cornerSize, y: this.height / 2 - cornerSize },
    ];

    ctx.fillStyle = "#263238";
    cornerPositions.forEach((pos) => {
      ctx.fillRect(pos.x, pos.y, cornerSize, cornerSize);
    });

    // Giriş tuşu
    if (!this.isOpen) {
      const keypadX = this.width / 2 - 8;
      const keypadY = -accessPanelSize / 2;

      ctx.fillStyle = "#1565c0";
      ctx.fillRect(keypadX - 3, keypadY, 6, 8);

      // Giriş tuşu butonları
      ctx.fillStyle = "#42a5f5";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(keypadX - 2, keypadY + 1 + i * 2, 4, 1);
      }
    }

    ctx.restore();
  }
}

/**
 * Lazer Silahı - Belirli yöne lazer ışını yayar
 */
export class LaserEmitter extends Entity {
  constructor(x, y, direction = "E", id = null) {
    super(x, y);
    this.id = id || generateUID();
    this.direction = direction;
    this.isActive = false;
    this.solid = false; // Oyuncu geçebilir
    this.canInteract = false; // Can player interact with this laser?
    this.interactionRange = TILE_SIZE * 1.5; // Interaction range
    this.rotationCooldown = 0; // Prevent rapid rotation
    this.layer = 1; // Render above floor but below UI
  }

  /**
   * Silahı 90° döndür
   */
  rotate() {
    if (this.rotationCooldown > 0) return; // Prevent rapid rotation

    const directions = ["N", "E", "S", "W"];
    const currentIndex = directions.indexOf(this.direction);
    const nextIndex = (currentIndex + 1) % directions.length;
    this.direction = directions[nextIndex];

    // Set cooldown to prevent rapid rotation
    this.rotationCooldown = 300; // 300ms cooldown

    // Power management integration
    powerManager.rotateLaserEmitter(this);
  }

  /**
   * Toggle laser active state
   */
  toggleActive() {
    this.isActive = !this.isActive;
    console.log(
      `LaserEmitter ${this.id} ${this.isActive ? "activated" : "deactivated"}`
    );

    // Power management integration
    powerManager.toggleLaserEmitter(this);
  }

  /**
   * Set laser active state
   * @param {boolean} active - Active state
   */
  setActive(active) {
    const oldState = this.isActive;
    this.isActive = Boolean(active); // Ensure boolean value

    if (this.isActive !== oldState) {
      console.log(
        `LaserEmitter ${this.id} state changed from ${oldState} to ${
          this.isActive
        } at position (${Math.floor(this.position.x)}, ${Math.floor(
          this.position.y
        )})`
      );

      // Only call power management integration when state actually changes
      try {
        if (
          typeof powerManager !== "undefined" &&
          powerManager.setLaserEmitterActive
        ) {
          powerManager.setLaserEmitterActive(this);
        }
      } catch (error) {
        console.warn(`LaserEmitter ${this.id}: Power management error:`, error);
      }
    } else {
      console.log(
        `LaserEmitter ${this.id}: State already ${this.isActive}, no change needed`
      );
    }
  }

  /**
   * Check if player is in interaction range
   * @param {Player} player - Player entity
   * @returns {boolean} Is player in range?
   */
  checkPlayerInRange(player) {
    const playerCenter = player.getCenter();
    const laserCenter = this.getCenter();
    const distance = playerCenter.subtract(laserCenter).magnitude();

    this.canInteract = distance <= this.interactionRange;
    return this.canInteract;
  }

  /**
   * Handle player interaction (rotation)
   * @param {Player} player - Player entity
   * @returns {boolean} Was interaction successful?
   */
  tryInteract(player) {
    if (!this.canInteract || this.rotationCooldown > 0) return false;

    this.rotate();
    return true;
  }

  /**
   * Update laser emitter state
   * @param {number} deltaTime - Frame time
   */
  update(deltaTime) {
    super.update(deltaTime);

    // Update rotation cooldown
    if (this.rotationCooldown > 0) {
      this.rotationCooldown -= deltaTime;
    }
  }

  /**
   * Get laser direction as a vector
   * @returns {Vector2} Laser direction vector
   */
  getDirectionVector() {
    const direction = DIRECTIONS[this.direction];
    if (!direction) {
      console.warn(
        `LaserEmitter ${this.id}: Invalid direction '${this.direction}', defaulting to East`
      );
      return new Vector2(1, 0); // Default to East
    }
    return new Vector2(direction.x, direction.y);
  }

  /**
   * Get laser start position (center with slight forward offset)
   * @returns {Vector2} Laser start point
   */
  getLaserStart() {
    const center = this.getCenter();

    // Validate position bounds
    if (center.x < 0 || center.y < 0) {
      console.warn(
        `LaserEmitter ${this.id} has invalid coordinates: (${Math.floor(
          center.x
        )}, ${Math.floor(center.y)})`
      );

      // Attempt to fix the position by moving to a safe location
      // This is a fallback to prevent system crashes
      const safeCenter = new Vector2(
        Math.max(0, center.x),
        Math.max(0, center.y)
      );

      console.warn(
        `LaserEmitter ${this.id} position corrected to: (${Math.floor(
          safeCenter.x
        )}, ${Math.floor(safeCenter.y)})`
      );

      // Update the entity's position to the safe location
      this.position.x = Math.max(0, this.position.x);
      this.position.y = Math.max(0, this.position.y);

      // Use the corrected center for calculations
      const direction = this.getDirectionVector();
      return safeCenter.add(direction.multiply(2));
    }

    // Slight forward offset to prevent immediate wall collisions
    const direction = this.getDirectionVector();
    return center.add(direction.multiply(2));
  }

  /**
   * Lazer emitter çizimi - Advanced technological device with futuristic design
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    // Interaction highlight (when player is in range)
    if (this.canInteract) {
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00bcd4";
      ctx.shadowBlur = 10;
      ctx.strokeRect(
        this.position.x - 3,
        this.position.y - 3,
        this.width + 6,
        this.height + 6
      );
      ctx.shadowBlur = 0;

      // "E" interaction prompt
      const center = this.getCenter();
      ctx.fillStyle = "#00bcd4";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("E", center.x, this.position.y - 8);
      ctx.fillText("ROTATE", center.x, this.position.y - 25);

      // Pulsing interaction ring
      const time = Date.now() * 0.005;
      const pulseRadius =
        this.interactionRange * (0.8 + 0.2 * Math.sin(time * 3));

      ctx.strokeStyle = `rgba(0, 188, 212, ${0.3 + 0.2 * Math.sin(time * 3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const center = this.getCenter();
    const time = Date.now() * 0.003;

    // Main device body - sleek metallic base
    const bodyGradient = ctx.createLinearGradient(
      this.position.x,
      this.position.y,
      this.position.x + this.width,
      this.position.y + this.height
    );
    bodyGradient.addColorStop(0, "#8a8a8a");
    bodyGradient.addColorStop(0.3, "#6d6d6d");
    bodyGradient.addColorStop(0.7, "#404040");
    bodyGradient.addColorStop(1, "#2e2e2e");

    ctx.fillStyle = bodyGradient;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

    // Secondary body layer for depth
    const innerSize = this.width * 0.85;
    const innerOffset = (this.width - innerSize) / 2;

    const innerGradient = ctx.createLinearGradient(
      this.position.x + innerOffset,
      this.position.y + innerOffset,
      this.position.x + innerOffset + innerSize,
      this.position.y + innerOffset + innerSize
    );
    innerGradient.addColorStop(0, "#5a5a5a");
    innerGradient.addColorStop(0.5, "#3e3e3e");
    innerGradient.addColorStop(1, "#1a1a1a");

    ctx.fillStyle = innerGradient;
    ctx.fillRect(
      this.position.x + innerOffset,
      this.position.y + innerOffset,
      innerSize,
      innerSize
    );

    // Energy core chamber - pulsating red/pink energy
    const coreSize = this.width * 0.4;
    const coreOffset = (this.width - coreSize) / 2;

    // Animated energy core
    const energyIntensity = this.isActive
      ? 0.7 + 0.3 * Math.sin(time * 4)
      : 0.3 + 0.1 * Math.sin(time * 2);

    const coreGradient = ctx.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      coreSize / 2
    );

    if (this.isActive) {
      coreGradient.addColorStop(0, `rgba(255, 80, 120, ${energyIntensity})`);
      coreGradient.addColorStop(
        0.4,
        `rgba(220, 60, 100, ${energyIntensity * 0.8})`
      );
      coreGradient.addColorStop(
        0.8,
        `rgba(180, 40, 80, ${energyIntensity * 0.6})`
      );
      coreGradient.addColorStop(
        1,
        `rgba(120, 20, 40, ${energyIntensity * 0.3})`
      );
    } else {
      coreGradient.addColorStop(0, `rgba(120, 40, 60, ${energyIntensity})`);
      coreGradient.addColorStop(
        0.6,
        `rgba(80, 20, 40, ${energyIntensity * 0.7})`
      );
      coreGradient.addColorStop(
        1,
        `rgba(40, 10, 20, ${energyIntensity * 0.4})`
      );
    }

    // Core glow effect
    if (this.isActive) {
      ctx.shadowColor = "#ff5078";
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, coreSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Emitter lens/crystal - directional focus element
    const dirVector = this.getDirectionVector();
    const lensRadius = this.width * 0.12;
    const lensDistance = this.width * 0.25;
    const lensCenter = center.add(dirVector.multiply(lensDistance));

    const lensGradient = ctx.createRadialGradient(
      lensCenter.x,
      lensCenter.y,
      0,
      lensCenter.x,
      lensCenter.y,
      lensRadius
    );

    if (this.isActive) {
      lensGradient.addColorStop(0, "#ffffff");
      lensGradient.addColorStop(0.3, "#ff8fa3");
      lensGradient.addColorStop(0.7, "#ff5078");
      lensGradient.addColorStop(1, "#d63384");

      ctx.shadowColor = "#ff5078";
      ctx.shadowBlur = 8;
    } else {
      lensGradient.addColorStop(0, "#b0b0b0");
      lensGradient.addColorStop(0.5, "#808080");
      lensGradient.addColorStop(1, "#404040");
    }

    ctx.fillStyle = lensGradient;
    ctx.beginPath();
    ctx.arc(lensCenter.x, lensCenter.y, lensRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Directional indicators - tech panels on sides
    const panelSize = this.width * 0.15;
    const panelDistance = this.width * 0.4;

    // Side panels for tech aesthetic
    const perpendicular = new Vector2(-dirVector.y, dirVector.x);
    const leftPanel = center.add(perpendicular.multiply(panelDistance));
    const rightPanel = center.subtract(perpendicular.multiply(panelDistance));

    [leftPanel, rightPanel].forEach((panelCenter) => {
      ctx.fillStyle = this.isActive ? "#4a4a4a" : "#2a2a2a";
      ctx.fillRect(
        panelCenter.x - panelSize / 2,
        panelCenter.y - panelSize / 2,
        panelSize,
        panelSize
      );

      // Panel lights
      const lightColor = this.isActive ? "#00ff88" : "#666666";
      ctx.fillStyle = lightColor;
      ctx.fillRect(
        panelCenter.x - panelSize / 4,
        panelCenter.y - panelSize / 4,
        panelSize / 2,
        panelSize / 8
      );
    });

    // Direction arrow with enhanced design
    const arrowStart = center.add(dirVector.multiply(this.width * 0.15));
    const arrowEnd = center.add(dirVector.multiply(this.width * 0.35));

    if (this.isActive) {
      ctx.shadowColor = "#ff5078";
      ctx.shadowBlur = 6;
    }

    ctx.strokeStyle = this.isActive ? "#ff5078" : "#888888";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(arrowStart.x, arrowStart.y);
    ctx.lineTo(arrowEnd.x, arrowEnd.y);

    // Enhanced arrow head
    const arrowSize = 8;
    const perpArrow = new Vector2(-dirVector.y, dirVector.x);
    const arrowHead1 = arrowEnd
      .subtract(dirVector.multiply(arrowSize))
      .add(perpArrow.multiply(arrowSize / 2));
    const arrowHead2 = arrowEnd
      .subtract(dirVector.multiply(arrowSize))
      .subtract(perpArrow.multiply(arrowSize / 2));

    ctx.lineTo(arrowHead1.x, arrowHead1.y);
    ctx.moveTo(arrowEnd.x, arrowEnd.y);
    ctx.lineTo(arrowHead2.x, arrowHead2.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Corner status indicators - hexagonal tech lights
    const lightRadius = 3;
    const hexPositions = [
      new Vector2(this.position.x + 6, this.position.y + 6),
      new Vector2(this.position.x + this.width - 6, this.position.y + 6),
      new Vector2(this.position.x + 6, this.position.y + this.height - 6),
      new Vector2(
        this.position.x + this.width - 6,
        this.position.y + this.height - 6
      ),
    ];

    const lightColor = this.isActive ? "#00ff88" : "#ff4444";
    ctx.fillStyle = lightColor;

    hexPositions.forEach((pos, index) => {
      const lightPhase = time * 2 + (index * Math.PI) / 2;
      const lightIntensity = 0.7 + 0.3 * Math.sin(lightPhase);

      ctx.globalAlpha = lightIntensity;

      // Hexagonal lights
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = pos.x + lightRadius * Math.cos(angle);
        const y = pos.y + lightRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Device border with metallic highlight
    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);

    // Inner metallic border
    ctx.strokeStyle = "#707070";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.position.x + 1,
      this.position.y + 1,
      this.width - 2,
      this.height - 2
    );

    // Active state outer glow
    if (this.isActive) {
      ctx.shadowColor = "#ff5078";
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "#ff5078";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(
        this.position.x - 2,
        this.position.y - 2,
        this.width + 4,
        this.height + 4
      );
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Rotation cooldown indicator
    if (this.rotationCooldown > 0) {
      const cooldownProgress = this.rotationCooldown / 300; // 300ms total cooldown
      ctx.fillStyle = `rgba(255, 193, 7, ${cooldownProgress * 0.7})`;
      ctx.fillRect(
        this.position.x,
        this.position.y + this.height - 3,
        this.width * (1 - cooldownProgress),
        3
      );
    }

    ctx.restore();
  }
}

// ===== BUTTON SINIFI =====

/**
 * Düğme - İnteract tuşu ile açılıp kapanabilen switch
 */
export class Button extends Entity {
  constructor(x, y, id = null, targets = []) {
    super(x, y);
    this.id = id || generateUID();
    this.targets = Array.isArray(targets) ? targets : [targets];
    this.isOn = false; // Switch state (on/off)
    this.canInteract = false; // Can player interact with this button?
    this.solid = false; // Oyuncu geçebilir
    this.onToggleCallback = null; // Called when switch is toggled
    this.interactionRange = TILE_SIZE * 1.2; // Interaction range
    this.controlsLasers = true; // Button controls lasers in the same room
    this.roomLasers = []; // Cache of lasers in the same room
    this.lastUpdate = 0; // For laser cache refresh
    this.layer = 1; // Render above floor but below UI
    this.toggleCooldown = 0; // Prevent rapid toggling
    this.toggleCooldownTime = 200; // 200ms cooldown between toggles
  }

  /**
   * Set the room manager reference for laser control
   * @param {DynamicLevelManager} roomManager - Room manager reference
   */
  setRoomManager(roomManager) {
    this.roomManager = roomManager;
    this.updateLaserCache();
  }

  /**
   * Update cache of lasers in the same room
   */
  updateLaserCache() {
    if (!this.roomManager || !this.roomManager.worldManager) {
      console.warn(`Button ${this.id}: Missing room manager or world manager`);
      return;
    }

    // Find current room
    const currentRoom = this.roomManager.worldManager.getRoomAtWorldPosition(
      this.getCenter()
    );
    if (!currentRoom) {
      console.warn(
        `Button ${this.id}: No room found at position`,
        this.getCenter()
      );
      return;
    }

    // Find all laser emitters in the same room
    const allLasers = this.roomManager.entities.filter((entity) => {
      return entity && entity.constructor.name === "LaserEmitter";
    });

    console.log(
      `Button ${this.id}: Found ${allLasers.length} total laser emitters in level`
    );

    this.roomLasers = allLasers.filter((entity) => {
      const laserRoom = this.roomManager.worldManager.getRoomAtWorldPosition(
        entity.getCenter()
      );

      if (!laserRoom) {
        console.warn(`Button ${this.id}: Laser emitter has no room`, entity.id);
        return false;
      }

      const sameRoom =
        laserRoom.roomX === currentRoom.roomX &&
        laserRoom.roomY === currentRoom.roomY;

      if (sameRoom) {
        console.log(
          `Button ${this.id}: Found laser ${entity.id} in same room (${currentRoom.roomX}, ${currentRoom.roomY})`
        );
      }

      return sameRoom;
    });

    console.log(
      `Button ${this.id} found ${this.roomLasers.length} lasers in room (${currentRoom.roomX}, ${currentRoom.roomY})`
    );
  }

  /**
   * Control lasers in the same room
   */
  controlRoomLasers() {
    // Update laser cache periodically
    const now = Date.now();
    if (now - this.lastUpdate > 2000) {
      // Update every 2 seconds
      this.updateLaserCache();
      this.lastUpdate = now;
    }

    console.log(
      `Button ${this.id}: Attempting to ${
        this.isOn ? "activate" : "deactivate"
      } ${this.roomLasers.length} lasers`
    );

    // Toggle all lasers in the room
    let controlledCount = 0;
    for (const laser of this.roomLasers) {
      if (laser && !laser.destroyed && laser.setActive) {
        const oldState = laser.isActive;
        laser.setActive(this.isOn);

        if (laser.isActive !== oldState) {
          controlledCount++;
          console.log(
            `Button ${this.id}: Successfully ${
              laser.isActive ? "activated" : "deactivated"
            } laser ${laser.id}`
          );
        } else {
          console.warn(
            `Button ${this.id}: Failed to change state of laser ${laser.id} (old: ${oldState}, new: ${laser.isActive})`
          );
        }
      } else {
        console.warn(
          `Button ${this.id}: Invalid laser or missing setActive method`,
          laser
        );
      }
    }

    console.log(
      `Button ${this.id} ${
        this.isOn ? "activated" : "deactivated"
      } ${controlledCount}/${this.roomLasers.length} lasers`
    );
  }

  /**
   * Switch durumunu toggle et
   */
  toggle() {
    const wasOn = this.isOn;
    this.isOn = !this.isOn;

    console.log(
      `Button ${this.id} toggled from ${wasOn} to ${
        this.isOn
      } at position (${Math.floor(this.position.x)}, ${Math.floor(
        this.position.y
      )})`
    );

    // Play button toggle sound effect
    audioManager.playSoundEffect("button-toggle");

    // Control lasers in the same room
    if (this.controlsLasers) {
      console.log(`Button ${this.id}: Controlling lasers...`);
      this.controlRoomLasers();
    } else {
      console.log(`Button ${this.id}: Not configured to control lasers`);
    }

    // Call legacy callback for other targets
    if (this.onToggleCallback) {
      console.log(`Button ${this.id}: Calling legacy toggle callback`);
      this.onToggleCallback(this);
    }

    console.log(
      `Button ${this.id}: Toggle complete, current state: ${this.isOn}`
    );
  }

  /**
   * Switch durumunu ayarla
   * @param {boolean} state - Switch durumu (on/off)
   */
  setState(state) {
    if (this.isOn === state) return;

    this.isOn = state;

    // Play button toggle sound effect
    audioManager.playSoundEffect("button-toggle");

    // Control lasers in the same room
    if (this.controlsLasers) {
      this.controlRoomLasers();
    }

    // Call legacy callback for other targets
    if (this.onToggleCallback) {
      this.onToggleCallback(this);
    }
  }

  /**
   * Player'ın etkileşim menzilinde olup olmadığını kontrol et
   * @param {Player} player - Oyuncu
   * @returns {boolean} Etkileşim menzilinde mi?
   */
  checkPlayerInRange(player) {
    const playerCenter = player.getCenter();
    const buttonCenter = this.getCenter();
    const distance = playerCenter.subtract(buttonCenter).magnitude();

    this.canInteract = distance <= this.interactionRange;
    return this.canInteract;
  }

  /**
   * Player interact input'u ile etkileşim
   * @param {Player} player - Oyuncu
   * @returns {boolean} Etkileşim gerçekleşti mi?
   */
  tryInteract(player) {
    if (!this.canInteract || this.toggleCooldown > 0) return false;

    this.toggle();
    this.toggleCooldown = this.toggleCooldownTime; // Set cooldown
    return true;
  }

  /**
   * Toggle callback ayarlama
   * @param {Function} callback - Toggle callback'i
   */
  setOnToggle(callback) {
    this.onToggleCallback = callback;
  }

  /**
   * Update button state
   * @param {number} deltaTime - Frame time
   */
  update(deltaTime) {
    super.update(deltaTime);

    // Update toggle cooldown
    if (this.toggleCooldown > 0) {
      this.toggleCooldown -= deltaTime;
    }

    // Periodically refresh laser cache
    const now = Date.now();
    if (now - this.lastUpdate > 5000) {
      // Update every 5 seconds
      this.updateLaserCache();
      this.lastUpdate = now;
    }
  }

  /**
   * Düğme çizimi - Advanced pressure plate/button with laser control indicator
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    // Interaction highlight (when player is in range)
    if (this.canInteract) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffeb3b";
      ctx.shadowBlur = 8;
      ctx.strokeRect(
        this.position.x - 2,
        this.position.y - 2,
        this.width + 4,
        this.height + 4
      );
      ctx.shadowBlur = 0;

      // "E" interaction prompt
      const center = this.getCenter();
      ctx.fillStyle = "#ffeb3b";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("E", center.x, this.position.y - 8);

      // Show laser control info
      if (this.roomLasers.length > 0) {
        ctx.fillText(
          `${this.roomLasers.length} LASERS`,
          center.x,
          this.position.y - 25
        );
      }

      // Pulsing interaction ring
      const time = Date.now() * 0.005;
      const pulseRadius =
        this.interactionRange * (0.8 + 0.2 * Math.sin(time * 3));

      ctx.strokeStyle = `rgba(255, 235, 59, ${0.3 + 0.2 * Math.sin(time * 3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Button housing/frame
    const frameGradient = ctx.createLinearGradient(
      this.position.x,
      this.position.y,
      this.position.x + this.width,
      this.position.y + this.height
    );
    frameGradient.addColorStop(0, "#455a64");
    frameGradient.addColorStop(0.5, "#37474f");
    frameGradient.addColorStop(1, "#263238");

    ctx.fillStyle = frameGradient;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

    // Switch mechanism
    const switchSize = this.width * 0.8;
    const center = this.getCenter();

    // Switch base with depth
    const switchGradient = ctx.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      switchSize / 2
    );
    if (this.isOn) {
      switchGradient.addColorStop(0, "#4caf50");
      switchGradient.addColorStop(0.3, "#388e3c");
      switchGradient.addColorStop(0.7, "#2e7d32");
      switchGradient.addColorStop(1, "#1b5e20");
    } else {
      switchGradient.addColorStop(0, "#f44336");
      switchGradient.addColorStop(0.3, "#d32f2f");
      switchGradient.addColorStop(0.7, "#c62828");
      switchGradient.addColorStop(1, "#b71c1c");
    }

    ctx.fillStyle = switchGradient;
    ctx.fillRect(
      center.x - switchSize / 2,
      center.y - switchSize / 2,
      switchSize,
      switchSize
    );

    // Switch lever/indicator
    const leverWidth = switchSize * 0.6;
    const leverHeight = switchSize * 0.2;
    const leverOffset = this.isOn ? -switchSize * 0.15 : switchSize * 0.15;

    ctx.fillStyle = this.isOn ? "#81c784" : "#ef5350";
    ctx.fillRect(
      center.x - leverWidth / 2,
      center.y + leverOffset - leverHeight / 2,
      leverWidth,
      leverHeight
    );

    // ON/OFF labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "8px Arial";
    ctx.textAlign = "center";

    if (this.isOn) {
      ctx.fillText("ON", center.x, center.y - switchSize * 0.25);
    } else {
      ctx.fillText("OFF", center.x, center.y + switchSize * 0.35);
    }

    // Laser control indicator
    if (this.roomLasers.length > 0) {
      ctx.fillStyle = this.isOn ? "#00ff41" : "#ff6b6b";
      ctx.font = "6px Arial";
      ctx.fillText(
        `${this.roomLasers.length}L`,
        center.x,
        center.y + switchSize * 0.5
      );
    }

    // Status LED indicators in corners
    const ledPositions = [
      { x: this.position.x + 4, y: this.position.y + 4 },
      { x: this.position.x + this.width - 6, y: this.position.y + 4 },
      { x: this.position.x + 4, y: this.position.y + this.height - 6 },
      {
        x: this.position.x + this.width - 6,
        y: this.position.y + this.height - 6,
      },
    ];

    ctx.fillStyle = this.isOn ? "#4caf50" : "#616161";
    if (this.isOn) {
      ctx.shadowColor = "#4caf50";
      ctx.shadowBlur = 4;
    }

    ledPositions.forEach((pos) => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.shadowBlur = 0;

    // Toggle cooldown indicator
    if (this.toggleCooldown > 0) {
      const cooldownProgress = this.toggleCooldown / this.toggleCooldownTime;
      ctx.fillStyle = `rgba(255, 152, 0, ${cooldownProgress * 0.6})`;
      ctx.fillRect(
        this.position.x,
        this.position.y + this.height - 3,
        this.width * (1 - cooldownProgress),
        3
      );
    }

    ctx.restore();
  }
}

// ===== POWER CELL SINIFI =====

/**
 * Enerji Hücresi - Lazer ışınıyla güçlendirilen hücre
 */
export class PowerCell extends Entity {
  constructor(x, y, id = null) {
    super(x, y);
    this.id = id || generateUID();
    this.isPowered = false;
    this.laserPowered = false; // Flag to indicate if powered by laser (for blue color)
    this.solid = true; // Power cells are solid and block lasers
    this.glowTimer = 0; // Glow animasyonu için
  }

  /**
   * Güç durumunu ayarla
   * @param {boolean} powered - Güçlü mü?
   */
  setPowered(powered) {
    // Play sound effect when power cell gets charged (only when turning on)
    if (powered && !this.isPowered) {
      audioManager.playSoundEffect("powercell-charge");
    }

    this.isPowered = powered;
  }

  /**
   * Hücre güncellemesi
   * @param {number} deltaTime - Frame süresi
   */
  update(deltaTime) {
    // Glow animasyon timer'ı
    this.glowTimer += 0.1;
  }

  /**
   * Enerji hücresi çizimi - Advanced energy core
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    // Base containment unit
    const baseGradient = ctx.createLinearGradient(
      this.position.x,
      this.position.y,
      this.position.x + this.width,
      this.position.y + this.height
    );
    baseGradient.addColorStop(0, "#37474f");
    baseGradient.addColorStop(0.5, "#263238");
    baseGradient.addColorStop(1, "#1a1a1a");

    ctx.fillStyle = baseGradient;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

    // Energy core chamber
    const coreSize = this.width * 0.7;
    const coreOffset = (this.width - coreSize) / 2;
    const center = this.getCenter();

    if (this.isPowered) {
      // Powered state - blue energy for laser-powered, green for other
      const energyGradient = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        coreSize / 2
      );
      const glowIntensity = 0.7 + 0.3 * Math.sin(this.glowTimer);

      if (this.laserPowered) {
        // Blue energy for laser-powered cells
        energyGradient.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity})`);
        energyGradient.addColorStop(
          0.3,
          `rgba(64, 196, 255, ${glowIntensity * 0.8})`
        );
        energyGradient.addColorStop(
          0.7,
          `rgba(33, 150, 243, ${glowIntensity * 0.6})`
        );
        energyGradient.addColorStop(
          1,
          `rgba(13, 71, 161, ${glowIntensity * 0.4})`
        );
      } else {
        // Green energy for other power sources
        energyGradient.addColorStop(0, `rgba(0, 255, 128, ${glowIntensity})`);
        energyGradient.addColorStop(
          0.3,
          `rgba(0, 230, 118, ${glowIntensity * 0.8})`
        );
        energyGradient.addColorStop(
          0.7,
          `rgba(0, 184, 96, ${glowIntensity * 0.6})`
        );
        energyGradient.addColorStop(
          1,
          `rgba(0, 150, 78, ${glowIntensity * 0.4})`
        );
      }

      ctx.fillStyle = energyGradient;
      ctx.fillRect(
        this.position.x + coreOffset,
        this.position.y + coreOffset,
        coreSize,
        coreSize
      );

      // Energy plasma effect
      const glowColor = this.laserPowered ? "#40c4ff" : "#00ff80";
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15 * glowIntensity;

      // Pulsing energy orb
      const orbRadius =
        coreSize * 0.3 * (1 + 0.1 * Math.sin(this.glowTimer * 2));
      const orbGradient = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        orbRadius
      );

      if (this.laserPowered) {
        orbGradient.addColorStop(0, "#ffffff");
        orbGradient.addColorStop(0.3, "#40c4ff");
        orbGradient.addColorStop(0.8, "#2196f3");
        orbGradient.addColorStop(1, "rgba(33, 150, 243, 0)");
      } else {
        orbGradient.addColorStop(0, "#ffffff");
        orbGradient.addColorStop(0.3, "#00ff80");
        orbGradient.addColorStop(0.8, "#00cc66");
        orbGradient.addColorStop(1, "rgba(0, 200, 102, 0)");
      }

      ctx.fillStyle = orbGradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Energy particles/sparks
      const particleColor = this.laserPowered
        ? "100, 200, 255"
        : "255, 255, 255";
      for (let i = 0; i < 6; i++) {
        const angle =
          (this.glowTimer * 0.5 + (i * Math.PI) / 3) % (Math.PI * 2);
        const sparkRadius = orbRadius * 0.7;
        const sparkX = center.x + Math.cos(angle) * sparkRadius;
        const sparkY = center.y + Math.sin(angle) * sparkRadius;

        ctx.fillStyle = `rgba(${particleColor}, ${
          0.6 + 0.4 * Math.sin(this.glowTimer + i)
        })`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    } else {
      // Unpowered state - dark with minimal indicators
      ctx.fillStyle = "#424242";
      ctx.fillRect(
        this.position.x + coreOffset,
        this.position.y + coreOffset,
        coreSize,
        coreSize
      );

      // Inactive core
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        this.position.x + coreOffset,
        this.position.y + coreOffset,
        coreSize,
        coreSize
      );

      // Dormant indicator
      ctx.fillStyle = "#616161";
      ctx.beginPath();
      ctx.arc(center.x, center.y, coreSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Containment field generators (corner details)
    const generatorSize = 4;
    const generatorPositions = [
      new Vector2(this.position.x + 2, this.position.y + 2),
      new Vector2(this.position.x + this.width - 6, this.position.y + 2),
      new Vector2(this.position.x + 2, this.position.y + this.height - 6),
      new Vector2(
        this.position.x + this.width - 6,
        this.position.y + this.height - 6
      ),
    ];

    const generatorColor = this.isPowered
      ? this.laserPowered
        ? "#42a5f5"
        : "#4fc3f7"
      : "#78909c";
    ctx.fillStyle = generatorColor;
    generatorPositions.forEach((pos) => {
      ctx.fillRect(pos.x, pos.y, generatorSize, generatorSize);
    });

    // Main containment border
    const borderColor = this.isPowered
      ? this.laserPowered
        ? "#2196f3"
        : "#00bcd4"
      : "#546e7a";
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);

    // Inner frame
    const innerBorderColor = this.isPowered
      ? this.laserPowered
        ? "#42a5f5"
        : "#26c6da"
      : "#607d8b";
    ctx.strokeStyle = innerBorderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.position.x + 3,
      this.position.y + 3,
      this.width - 6,
      this.height - 6
    );

    // Status indicator lights
    const statusY = this.position.y + this.height - 8;
    const statusColor = this.isPowered
      ? this.laserPowered
        ? "#2196f3"
        : "#4caf50"
      : "#424242";
    for (let i = 0; i < 3; i++) {
      const statusX = this.position.x + 6 + i * 4;
      ctx.fillStyle = statusColor;
      ctx.fillRect(statusX, statusY, 2, 4);
    }

    // Power level indicator (if powered)
    if (this.isPowered) {
      const powerBarWidth = this.width * 0.8;
      const powerBarHeight = 3;
      const powerBarX = this.position.x + (this.width - powerBarWidth) / 2;
      const powerBarY = this.position.y + this.height - 12;

      // Power bar background
      const barBgColor = this.laserPowered ? "#0d47a1" : "#1b5e20";
      ctx.fillStyle = barBgColor;
      ctx.fillRect(powerBarX, powerBarY, powerBarWidth, powerBarHeight);

      // Power bar fill (animated)
      const powerLevel = 0.8 + 0.2 * Math.sin(this.glowTimer);
      const barFillColor = this.laserPowered ? "#2196f3" : "#00ff41";
      ctx.fillStyle = barFillColor;
      ctx.fillRect(
        powerBarX,
        powerBarY,
        powerBarWidth * powerLevel,
        powerBarHeight
      );
    }

    ctx.restore();
  }
}

// ===== AUTO DOOR CLASS =====

/**
 * Auto Door - Door that automatically opens when player approaches
 */
export class AutoDoor extends Door {
  constructor(
    x,
    y,
    direction = "S",
    id = null,
    activationDistance = TILE_SIZE * 3.5 // Increased from 2 to ensure detection from both sides
  ) {
    super(x, y, direction, id);
    this.activationDistance = activationDistance;
    this.playerInRange = false;
    this.autoCloseTimer = 0;
    this.autoCloseDelay = 2000; // 2 seconds in milliseconds
    this.onSolidStateChange = null; // Callback for when solid state changes

    // Start CLOSED and solid - doors should be closed initially
    this.isOpen = false;
    this.solid = true;
    this.animationTimer = 0;
  }

  /**
   * Set callback for solid state changes
   * @param {Function} callback - Callback function
   */
  setSolidStateChangeCallback(callback) {
    this.onSolidStateChange = callback;
  }

  /**
   * Override Door's open method to handle solid state
   */
  open() {
    if (this.isOpen || this.isAnimating) return;
    super.open();
    if (this.onSolidStateChange) {
      this.onSolidStateChange(this, false); // Door is now non-solid
    }
  }

  /**
   * Override Door's close method to handle solid state
   */
  close() {
    if (!this.isOpen || this.isAnimating) return;
    super.close();
    if (this.onSolidStateChange) {
      this.onSolidStateChange(this, true); // Door is now solid
    }
  }

  /**
   * Override Door's update method to handle solid state changes
   */
  update(deltaTime) {
    const wasSolid = this.solid;
    super.update(deltaTime);

    // Check if solid state changed during animation
    if (wasSolid !== this.solid && this.onSolidStateChange) {
      this.onSolidStateChange(this, this.solid);
    }
  }

  /**
   * Check if player is in activation range
   * @param {Vector2} playerPos - Player position
   * @returns {boolean} Is player in range?
   *
   * NOTE: This detection works regardless of whether the player is within room boundaries
   * or outside in empty space between rooms. The door will detect any player within
   * the activation distance, even if they're standing outside floor tiles.
   */
  isPlayerInRange(playerPos) {
    const doorCenter = this.getCenter();

    // Quick bounds check first (optimization)
    const quickDistance = this.activationDistance + TILE_SIZE; // Add some buffer
    if (
      Math.abs(doorCenter.x - playerPos.x) > quickDistance ||
      Math.abs(doorCenter.y - playerPos.y) > quickDistance
    ) {
      return false; // Too far away, skip expensive sqrt calculation
    }

    // Accurate distance calculation
    const dx = doorCenter.x - playerPos.x;
    const dy = doorCenter.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.activationDistance;
  }

  /**
   * Otomatik kapı mantığı
   * @param {number} deltaTime - Frame zamanı (ms)
   * @param {Vector2} playerPos - Oyuncu konumu
   */
  updateWithPlayer(deltaTime, playerPos) {
    // İlk olarak temel kapı animasyonunu güncelle
    this.update(deltaTime);

    if (!playerPos) return;

    const wasInRange = this.playerInRange;
    this.playerInRange = this.isPlayerInRange(playerPos);

    // Oyuncu aralığa girdi - kapıyı aç
    if (this.playerInRange && !wasInRange && !this.isOpen) {
      this.open();
      this.autoCloseTimer = 0;
    }

    // Oyuncu aralığa girdi - kapıyı aç
    if (this.playerInRange) {
      this.autoCloseTimer = 0;
    }

    // Oyuncu aralığından çıktı - kapıyı kapatma sayacını başlat
    if (!this.playerInRange && this.isOpen && !this.isAnimating) {
      this.autoCloseTimer += deltaTime;
      if (this.autoCloseTimer >= this.autoCloseDelay) {
        this.close();
        this.autoCloseTimer = 0;
      }
    }
  }

  /**
   * Debug kapıyı aralık göstergesiyle görüntüle
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {boolean} showDebug - Hata bilgilerini göster
   */
  render(ctx, showDebug = false) {
    super.render(ctx);

    if (showDebug || this.playerInRange) {
      const center = this.getCenter();
      ctx.save();

      ctx.strokeStyle = this.playerInRange ? "#00ff00" : "#ffff00";
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, this.activationDistance, 0, Math.PI * 2);
      ctx.stroke();

      if (this.playerInRange) {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#00ff00";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = "#00ff00";
        ctx.shadowBlur = 5;
        ctx.fillText(
          "DETECTING",
          center.x,
          center.y - this.activationDistance - 10
        );
        ctx.shadowBlur = 0;

        // Show detection info
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px Arial";
        ctx.fillText(
          `Range: ${Math.floor(this.activationDistance)}px`,
          center.x,
          center.y - this.activationDistance - 25
        );
      }

      ctx.restore();
    }
  }
}
