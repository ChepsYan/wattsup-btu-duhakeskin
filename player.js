/**
 * Dedicated Player Movement and Collision System
 * Centralizes ALL player movement to ensure proper collision detection
 */

import { Vector2, generateUID } from "./utils.js";
import {
  TILE_SIZE,
  COLORS,
  EASING,
  PLAYER_SPEED,
  DASH_DISTANCE,
  DASH_DURATION,
} from "./constants.js";
import { audioManager } from "./audioManager.js";

/**
 * Player class with centralized movement and collision handling
 */
export class Player {
  constructor(x = 0, y = 0) {
    this.id = generateUID();

    // Konum
    this.position = new Vector2(x, y);
    this.width = TILE_SIZE * 0.8;
    this.height = TILE_SIZE * 0.8;

    // Görünüm özellikleri
    this.visible = true;
    this.active = true;
    this.solid = false;
    this.layer = 3;

    // Oyuncu özellikleri
    this.health = 100;

    // Hareket durumu
    this.velocity = new Vector2(0, 0);
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDirection = new Vector2(0, 0);
    this.dashStartPosition = new Vector2(0, 0);

    // 2.5D efekt için görsel durum
    this.facingDirection = "down"; // 'up', 'down', 'left', 'right'
    this.lastMovementDirection = new Vector2(0, 1); // Varsayılan yukarı yön

    // Input durumu
    this.inputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      dash: false,
      interact: false,
    };

    // Çarpışma callback (dış sistem tarafından ayarlanır)
    this.collisionCallback = null;

    // Dash efektleri
    this.dashTrail = []; // Trail konumlarını sakla
    this.dashParticles = []; // Enerji parçacıklarını sakla
    this.dashIntensity = 0; // Şu anki dash efekti şiddeti
    this.maxTrailLength = 8; // Maksimum trail segmenti

    // Efekt özellikleri
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.blinkDuration = 150; // ms
    this.nextBlinkTime = 2000 + Math.random() * 3000; // Rastgele blink aralığı
    this.antennaFloat = 0; // Anten yükselme efekti
    this.eyeEmote = "normal"; // 'normal', 'happy', 'surprised', 'focused'
    this.emoteDuration = 0;
    this.idleBobbing = 0; // Hafif idle animasyon
  }

  /**
   * Çarpışma callback fonksiyonunu ayarla
   * @param {Function} callback - Çarpışma tespiti fonksiyonu
   */
  setCollisionCallback(callback) {
    this.collisionCallback = callback;
  }

  /**
   * Pozisyon ayarlayıcı
   * @param {number} x - Yeni X pozisyonu
   * @param {number} y - Yeni Y pozisyonu
   * @param {boolean} forceMove - Çarpışma kontrolü olmadan hareketi zorla
   */
  setPosition(x, y, forceMove = false) {
    if (forceMove || !this.collisionCallback) {
      this.position.x = x;
      this.position.y = y;
      return;
    }

    // Çarpışma kontrolü ile pozisyon değişimi
    this.moveToPosition(new Vector2(x, y));
  }

  /**
   * Belirli bir pozisyona çarpışma kontrolü ile hareket et
   * @param {Vector2} targetPosition - Hedef pozisyon
   */
  moveToPosition(targetPosition) {
    if (!this.collisionCallback) {
      this.position.x = targetPosition.x;
      this.position.y = targetPosition.y;
      return;
    }

    // Hedef pozisyon çarpışma olursa hareket et
    if (!this.wouldCollideAt(targetPosition)) {
      this.position.x = targetPosition.x;
      this.position.y = targetPosition.y;
    } else {
      // Çarpışma olursa kayma hareketi yap
      this.performSlidingMovement(targetPosition);
    }
  }

  /**
   * Verilen pozisyonda çarpışma olup olmadığını kontrol et
   * @param {Vector2} position - Kontrol edilecek pozisyon
   * @returns {boolean} Çarpışma olursa true, aksi takdirde false
   */
  wouldCollideAt(position) {
    if (!this.collisionCallback) return false;

    // Oyuncunun tüm dört köşesini kontrol et
    const testPoints = [
      new Vector2(position.x, position.y), // Sol üst köşe
      new Vector2(position.x + this.width, position.y), // Sağ üst köşe
      new Vector2(position.x, position.y + this.height), // Sol alt köşe
      new Vector2(position.x + this.width, position.y + this.height), // Sağ alt köşe
    ];

    return testPoints.some((point) => this.collisionCallback(point));
  }

  /**
   * Çarpışma olursa kayma hareketi yap
   * @param {Vector2} targetPosition - Hedef pozisyon
   */
  performSlidingMovement(targetPosition) {
    // Yalnızca yatay hareket
    const horizontalPos = new Vector2(targetPosition.x, this.position.y);
    if (!this.wouldCollideAt(horizontalPos)) {
      this.position.x = targetPosition.x;
    }

    // Yalnızca dikey hareket
    const verticalPos = new Vector2(this.position.x, targetPosition.y);
    if (!this.wouldCollideAt(verticalPos)) {
      this.position.y = targetPosition.y;
    }
  }

  // ===== INPUT HANDLING =====

  /**
   * Input durumunu güncelle
   * @param {Object} inputState - Input durumu
   */
  updateInput(inputState) {
    this.inputState = { ...inputState };
  }

  /**
   * Hareket hızını girişten hesapla
   * @returns {Vector2} Hareket hızı
   */
  calculateMovementVelocity() {
    const velocity = new Vector2(0, 0);

    if (this.inputState.left) velocity.x -= PLAYER_SPEED;
    if (this.inputState.right) velocity.x += PLAYER_SPEED;
    if (this.inputState.up) velocity.y -= PLAYER_SPEED;
    if (this.inputState.down) velocity.y += PLAYER_SPEED;

    // Diagonal hareketi normalleştir
    if (velocity.magnitude() > 0) {
      return velocity.normalize().multiply(PLAYER_SPEED);
    }

    return velocity;
  }

  /**
   * Girişten dash yönünü hesapla
   * @returns {Vector2} Dash yönü
   */
  calculateDashDirection() {
    const dashDir = new Vector2(0, 0);

    if (this.inputState.left) dashDir.x -= 1;
    if (this.inputState.right) dashDir.x += 1;
    if (this.inputState.up) dashDir.y -= 1;
    if (this.inputState.down) dashDir.y += 1;

    return dashDir.magnitude() > 0 ? dashDir.normalize() : new Vector2(0, 0);
  }

  /**
   * Dash başlatılabilir mi kontrol et
   * @returns {boolean} Dash başlatılabilir mi?
   */
  canStartDash() {
    return !this.isDashing && this.calculateDashDirection().magnitude() > 0;
  }

  /**
   * Dash hareketini başlat
   */
  startDash() {
    if (!this.canStartDash()) return;

    this.isDashing = true;
    this.dashTimer = 0;
    this.dashDirection = this.calculateDashDirection();
    this.dashStartPosition = this.position.clone();

    // Dash ses efekti çal
    audioManager.playSoundEffect("dash");

    // Dash yönü için yön güncelle
    this.updateFacingDirection(this.dashDirection);

    // Dash görsel efektlerini başlat
    this.dashIntensity = 1.0;
    this.dashTrail = [];
    this.dashParticles = [];

    // Başlangıçta parçacıkları oluştur
    this.createDashStartParticles();
  }

  /**
   * Dash başlangıcında parçacıkları oluştur
   */
  createDashStartParticles() {
    const center = this.getCenter();
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 50 + Math.random() * 100;

      this.dashParticles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? "#00f5ff" : "#40e0d0",
      });
    }
  }

  /**
   * Çarpışma kontrolü ile dash hareketini güncelle
   * @param {number} deltaTime - Frame time
   */
  updateDashMovement(deltaTime) {
    this.dashTimer += deltaTime;

    // DASH_DURATION'ı frame'ten milisaniye
    const dashDurationMs = (DASH_DURATION / 60) * 1000;

    if (this.dashTimer >= dashDurationMs) {
      this.finishDash();
      return;
    }

    // Dash şiddetini güncelle
    const progress = this.dashTimer / dashDurationMs;
    this.dashIntensity = 1.0 - progress * 0.3; // 70% şiddete kadar yok olur

    // Şu anki pozisyonu trail'e ekle
    const center = this.getCenter();
    this.dashTrail.unshift({
      x: center.x,
      y: center.y,
      alpha: this.dashIntensity,
      size: this.width * (0.8 + Math.random() * 0.4),
      rotation: Math.random() * Math.PI * 2,
    });

    // Trail uzunluğunu sınırla
    if (this.dashTrail.length > this.maxTrailLength) {
      this.dashTrail.pop();
    }

    // Sürekli dash parçacıkları oluştur
    if (Math.random() < 0.7) {
      // 70%
      this.createDashTrailParticles();
    }

    // Mevcut parçacıkları güncelle
    this.updateDashParticles(deltaTime);

    const easedProgress = EASING.cubicOut(progress);
    const dashOffset = this.dashDirection.multiply(
      DASH_DISTANCE * easedProgress
    );
    const targetPosition = this.dashStartPosition.add(dashOffset);

    // Aynı çarpışma kontrolünü dash hareketi için kullan
    if (this.wouldCollideAt(targetPosition)) {
      this.finishDash(); // Çarpışma varsa dash'i durdur
    } else {
      this.moveToPosition(targetPosition);
    }
  }

  /**
   * Dash sırasında trail parçacıkları oluştur
   */
  createDashTrailParticles() {
    const center = this.getCenter();
    const particleCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < particleCount; i++) {
      // Robot'un arkasında parçacıklar oluştur
      const behindOffset = this.dashDirection.multiply(
        -20 - Math.random() * 20
      );
      const perpOffset = new Vector2(
        -this.dashDirection.y,
        this.dashDirection.x
      ).multiply((Math.random() - 0.5) * 30);

      this.dashParticles.push({
        x: center.x + behindOffset.x + perpOffset.x,
        y: center.y + behindOffset.y + perpOffset.y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? "#00f5ff" : "#40e0d0",
      });
    }
  }

  /**
   * Dash parçacıklarını güncelle
   */
  updateDashParticles(deltaTime) {
    const timeScale = deltaTime / 1000;

    for (let i = this.dashParticles.length - 1; i >= 0; i--) {
      const particle = this.dashParticles[i];

      // Pozisyonu güncelle
      particle.x += particle.vx * timeScale;
      particle.y += particle.vy * timeScale;

      // Sürtünme uygula
      particle.vx *= 0.95;
      particle.vy *= 0.95;

      // Yaşını güncelle
      particle.life -= timeScale;

      // Ölü parçacıkları kaldır
      if (particle.life <= 0) {
        this.dashParticles.splice(i, 1);
      }
    }
  }

  /**
   * Dash hareketini bitir
   */
  finishDash() {
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashIntensity = 0;

    // Dash biti parçacıklarını oluştur
    this.createDashEndParticles();
  }

  /**
   * Dash biti parçacıklarını oluştur
   */
  createDashEndParticles() {
    const center = this.getCenter();
    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 30 + Math.random() * 60;

      this.dashParticles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
        color: "#87ceeb",
      });
    }
  }

  /**
   * Normal (dash olmayan) hareketi güncelle
   * @param {number} deltaTime - Frame time
   */
  updateNormalMovement(deltaTime) {
    this.velocity = this.calculateMovementVelocity();

    if (this.velocity.magnitude() > 0) {
      // Hareket yönünü güncelle
      this.updateFacingDirection(this.velocity);

      // DeltaTime'ı frame-rate bağımsız hale getir
      const timeScale = (deltaTime / 1000) * 60;
      const scaledVelocity = this.velocity.multiply(timeScale);
      const targetPosition = this.position.add(scaledVelocity);
      this.moveToPosition(targetPosition);
    }
  }

  /**
   * Hareket yönünü hareket hızına göre güncelle
   * @param {Vector2} velocity - Şu anki hareket hızı
   */
  updateFacingDirection(velocity) {
    if (velocity.magnitude() === 0) return;

    this.lastMovementDirection = velocity.normalize();

    // Öncelikli yönü belirle (diagonal hareket için yatay üzerine dikey)
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
      this.facingDirection = velocity.x > 0 ? "right" : "left";
    } else {
      this.facingDirection = velocity.y > 0 ? "down" : "up";
    }
  }

  /**
   * Ana oyuncu güncellemesi - tüm hareketleri işler
   * @param {number} deltaTime - Frame time
   */
  update(deltaTime) {
    // Dash girişini işle
    if (this.inputState.dash && this.canStartDash()) {
      this.startDash();
    }

    // Hareketi mevcut duruma göre güncelle
    if (this.isDashing) {
      this.updateDashMovement(deltaTime);
      // Dash sırasında odaklanmış ifadeyi ayarla
      this.setEyeEmote("focused", 500);
    } else {
      this.updateNormalMovement(deltaTime);
      // Dash olmadan bile parçacıkları güncelle (görünmez efekt için)
      this.updateDashParticles(deltaTime);
      // Dash olmadan görünmez efekt
      this.updateTrailFade(deltaTime);
    }

    this.updateCuteAnimations(deltaTime);
  }

  /**
   * Update cute animations like blinking and antenna floating
   */
  updateCuteAnimations(deltaTime) {
    // Blink güncellemesi
    this.blinkTimer += deltaTime;
    if (this.isBlinking) {
      if (this.blinkTimer >= this.blinkDuration) {
        this.isBlinking = false;
        this.nextBlinkTime = 2000 + Math.random() * 3000; // Sonraki blink 2-5 saniye arası
        this.blinkTimer = 0;
      }
    } else {
      if (this.blinkTimer >= this.nextBlinkTime) {
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
    }

    // Anten yükselme animasyonunu güncelle
    this.antennaFloat += deltaTime * 0.003; // Yavaş yükselme hareketi

    // Hareketsiz olduğunda idle bobbing'i güncelle
    if (this.velocity.magnitude() === 0 && !this.isDashing) {
      this.idleBobbing += deltaTime * 0.005;
    } else {
      this.idleBobbing = 0;
    }

    // Emote süresini güncelle
    if (this.emoteDuration > 0) {
      this.emoteDuration -= deltaTime;
      if (this.emoteDuration <= 0) {
        this.eyeEmote = "normal";
      }
    }

    // Hareket ederken mutlu ifadeyi ayarla
    if (
      this.velocity.magnitude() > 0 &&
      !this.isDashing &&
      this.eyeEmote === "normal"
    ) {
      this.setEyeEmote("happy", 200);
    }
  }

  /**
   * Belirli bir süre için göz ifadesini ayarla
   */
  setEyeEmote(emote, duration) {
    this.eyeEmote = emote;
    this.emoteDuration = duration;
  }

  /**
   * Dash olmadan görünmez efekt
   */
  updateTrailFade(deltaTime) {
    const fadeRate = deltaTime / 500; // 500ms'de yok olma

    for (let i = this.dashTrail.length - 1; i >= 0; i--) {
      this.dashTrail[i].alpha -= fadeRate;
      if (this.dashTrail[i].alpha <= 0) {
        this.dashTrail.splice(i, 1);
      }
    }
  }

  /**
   * Oyuncunun çarpışma algılama için sınırlarını al
   * @returns {Object} Sınırlar {x, y, width, height}
   */
  getBounds() {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Merkez pozisyonunu al
   * @returns {Vector2} Merkez pozisyonu
   */
  getCenter() {
    return new Vector2(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2
    );
  }

  /**
   * Grid pozisyonunu al
   * @returns {Vector2} Grid koordinatları
   */
  getGridPosition() {
    return new Vector2(
      Math.floor(this.position.x / TILE_SIZE),
      Math.floor(this.position.y / TILE_SIZE)
    );
  }

  /**
   * Başka bir varlıkla kesişip kesişmediğini kontrol et
   * @param {Object} other - getBounds yöntemine sahip başka bir varlık
   * @returns {boolean} Kesişiyor mu?
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

  /**
   * Oyuncuyu yok et (temizle)
   */
  destroy() {
    this.active = false;
  }

  /**
   * Oyuncunun durumunu sıfırla (seviye yeniden başlatma/ölüm için)
   */
  resetState() {
    // Hareket durumunu sıfırla
    this.velocity = new Vector2(0, 0);
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDirection = new Vector2(0, 0);
    this.dashStartPosition = new Vector2(0, 0);

    // Görsel efektleri sıfırla
    this.dashTrail = [];
    this.dashParticles = [];
    this.dashIntensity = 0;
    this.facingDirection = "down";
    this.lastMovementDirection = new Vector2(0, 1);

    // Giriş durumunu sıfırla
    this.inputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      dash: false,
      interact: false,
    };

    // Canı sıfırla
    this.health = 100;

    // Animasyon özelliklerini sıfırla
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.nextBlinkTime = 2000 + Math.random() * 3000;
    this.antennaFloat = 0;
    this.eyeEmote = "normal";
    this.emoteDuration = 0;
    this.idleBobbing = 0;
  }

  // ===== RENDERING =====

  /**
   * Oyuncuyu çiz
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    const center = this.getCenter();
    ctx.translate(center.x, center.y);

    // Gelişmiş dash saydamlığı ve parlaklık
    if (this.isDashing) {
      ctx.globalAlpha = 0.9;
      // Ekran bozukluk efekti ekle
      this.renderDashDistortion(ctx);
    }

    // Gelişmiş dash izleme efekti
    this.renderAdvancedDashTrail(ctx);

    // Dash parçacıklarını çiz
    this.renderDashParticles(ctx);

    // Pikselated görünüm için blur'ı devre dışı bırak
    ctx.imageSmoothingEnabled = false;

    // Robot boyutları
    const robotWidth = this.width;
    const robotHeight = this.height;
    const pixelSize = Math.max(2, Math.floor(robotWidth / 16));

    // 2.5D derinlik offset
    const depthOffset = 3;

    // Pikselated dikdörtgenleri çizmek için yardımcı işlev
    const drawPixelRect = (x, y, w, h, color, hasDepth = false) => {
      ctx.fillStyle = color;
      const pixelX = Math.floor(x / pixelSize) * pixelSize - robotWidth / 2;
      const pixelY = Math.floor(y / pixelSize) * pixelSize - robotHeight / 2;
      const pixelW = Math.ceil(w / pixelSize) * pixelSize;
      const pixelH = Math.ceil(h / pixelSize) * pixelSize;

      if (hasDepth) {
        // Gölge/derinlik önce çiz
        ctx.fillStyle = this.getDarkerColor(color);
        ctx.fillRect(
          pixelX + depthOffset,
          pixelY + depthOffset,
          pixelW,
          pixelH
        );

        // Ana dikdörtgeni çiz
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, pixelW, pixelH);
      } else {
        ctx.fillRect(pixelX, pixelY, pixelW, pixelH);
      }
    };

    // Zemin gölgesini çiz
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.ellipse(
      0,
      robotHeight * 0.4,
      robotWidth * 0.6,
      robotHeight * 0.2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Dash enerji parlaklığı robotun etrafında
    if (this.isDashing || this.dashIntensity > 0) {
      this.renderDashEnergyGlow(ctx, robotWidth, robotHeight);
    }

    // Yönüne göre robotu çiz
    this.renderRobotForDirection(
      ctx,
      drawPixelRect,
      robotWidth,
      robotHeight,
      pixelSize,
      depthOffset
    );

    // Motor/thruster parlaklığı (hareket ediyorsa)
    if (this.velocity.magnitude() > 0 && !this.isDashing) {
      this.renderThrusterEffects(ctx, robotWidth, robotHeight);
    }

    // Başta durum LED (animasyonlu) - dash sırasında gelişmiş
    const time = Date.now() * 0.003;
    const ledIntensity = Math.sin(time) * 0.3 + 0.7;
    const ledBoost = this.isDashing ? 0.5 : 0;
    ctx.fillStyle = `rgba(0, 245, 255, ${Math.min(
      1.0,
      ledIntensity + ledBoost
    )})`;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = this.isDashing ? 8 : 4;

    // LED konumu yöne göre değişir
    const ledPos = this.getLEDPosition(robotWidth, robotHeight);
    drawPixelRect(
      ledPos.x,
      ledPos.y,
      pixelSize * 2,
      pixelSize * 2,
      ctx.fillStyle
    );
    ctx.shadowBlur = 0;

    // Yön göstergesi (hareket ediyorsa)
    if (!this.isDashing && this.velocity.magnitude() > 0) {
      this.renderDirectionIndicator(ctx);
    }

    // Dash sırasında hız çizgilerini çiz
    if (this.isDashing) {
      this.renderSpeedLines(ctx, robotWidth, robotHeight);
    }

    // Pikselated görünüm için blur'ı yeniden etkinleştir
    ctx.imageSmoothingEnabled = true;

    ctx.restore();
  }

  /**
   * Gelişmiş dash izleme efekti
   */
  renderAdvancedDashTrail(ctx) {
    if (this.dashTrail.length === 0) return;

    ctx.save();

    // Çizgi segmentlerini farklı efektlerle çiz
    for (let i = 0; i < this.dashTrail.length; i++) {
      const segment = this.dashTrail[i];
      const fadeRatio = 1 - i / this.dashTrail.length;
      const alpha = segment.alpha * fadeRatio * 0.8;

      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.translate(
        segment.x - this.getCenter().x,
        segment.y - this.getCenter().y
      );
      ctx.rotate(segment.rotation);

      // Dış parlaklık
      ctx.shadowColor = "#00f5ff";
      ctx.shadowBlur = 15 * fadeRatio;
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = "#00f5ff";
      ctx.fillRect(
        -segment.size / 2,
        -segment.size / 2,
        segment.size,
        segment.size
      );

      // İç çekirdek
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = fadeRatio > 0.5 ? "#87ceeb" : "#40e0d0";
      const coreSize = segment.size * 0.6;
      ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Dash parçacıklarını çiz
   */
  renderDashParticles(ctx) {
    if (this.dashParticles.length === 0) return;

    ctx.save();

    for (const particle of this.dashParticles) {
      const alpha = particle.life / particle.maxLife;
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = particle.size * 2;

      ctx.beginPath();
      ctx.arc(
        particle.x - this.getCenter().x,
        particle.y - this.getCenter().y,
        particle.size * alpha,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Dash bozukluk efektini çiz
   */
  renderDashDistortion(ctx) {
    const distortionIntensity = this.dashIntensity * 0.5;

    // Hafif ekran sarsıntı efekti oluştur
    const shakeX = (Math.random() - 0.5) * 4 * distortionIntensity;
    const shakeY = (Math.random() - 0.5) * 4 * distortionIntensity;
    ctx.translate(shakeX, shakeY);
  }

  /**
   * Dash sırasında robotun etrafında parlaklık çiz
   */
  renderDashEnergyGlow(ctx, robotWidth, robotHeight) {
    const glowIntensity = this.dashIntensity;
    if (glowIntensity <= 0) return;

    ctx.save();
    ctx.globalAlpha = glowIntensity * 0.4;

    // Çok katmanlı parlaklık
    const glowLayers = [
      { radius: robotWidth * 0.8, color: "#00f5ff", alpha: 0.3 },
      { radius: robotWidth * 0.6, color: "#40e0d0", alpha: 0.5 },
      { radius: robotWidth * 0.4, color: "#87ceeb", alpha: 0.7 },
    ];

    for (const layer of glowLayers) {
      ctx.globalAlpha = glowIntensity * layer.alpha;
      ctx.shadowColor = layer.color;
      ctx.shadowBlur = layer.radius;
      ctx.fillStyle = layer.color;

      ctx.beginPath();
      ctx.arc(0, 0, layer.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Dash sırasında hız çizgilerini çiz
   */
  renderSpeedLines(ctx, robotWidth, robotHeight) {
    ctx.save();

    const lineCount = 12;
    const lineLength = robotWidth * 2;
    const dashDir = this.dashDirection;

    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 1;
    ctx.globalAlpha = this.dashIntensity * 0.6;

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2;
      const startRadius = robotWidth * 0.8;
      const endRadius = startRadius + lineLength;

      // Hareketin tersi yönüne doğru olan çizgiler
      const lineDir = new Vector2(Math.cos(angle), Math.sin(angle));
      if (lineDir.dot(dashDir) > -0.3) continue; // Sadece hareketin arkasındaki çizgileri göster

      const startX = Math.cos(angle) * startRadius;
      const startY = Math.sin(angle) * startRadius;
      const endX = Math.cos(angle) * endRadius;
      const endY = Math.sin(angle) * endRadius;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Derinlik efekti için daha koyu renk al
   * @param {string} color - Orijinal renk
   * @returns {string} Daha koyu renk
   */
  getDarkerColor(color) {
    if (color.startsWith("#")) {
      const r = parseInt(color.substr(1, 2), 16);
      const g = parseInt(color.substr(3, 2), 16);
      const b = parseInt(color.substr(5, 2), 16);
      return `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(
        b * 0.6
      )})`;
    }
    return color; // Hex olmayan renkler için fallback
  }

  /**
   * Yönüne göre robotu çiz
   */
  renderRobotForDirection(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    depthOffset
  ) {
    switch (this.facingDirection) {
      case "down":
        this.renderRobotFront(
          ctx,
          drawPixelRect,
          robotWidth,
          robotHeight,
          pixelSize,
          depthOffset
        );
        break;
      case "up":
        this.renderRobotBack(
          ctx,
          drawPixelRect,
          robotWidth,
          robotHeight,
          pixelSize,
          depthOffset
        );
        break;
      case "left":
        this.renderRobotLeft(
          ctx,
          drawPixelRect,
          robotWidth,
          robotHeight,
          pixelSize,
          depthOffset
        );
        break;
      case "right":
        this.renderRobotRight(
          ctx,
          drawPixelRect,
          robotWidth,
          robotHeight,
          pixelSize,
          depthOffset
        );
        break;
    }
  }

  /**
   * Robot ön görünümünü çiz
   */
  renderRobotFront(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    depthOffset
  ) {
    // Uyku salınımı animasyonu uygula
    const bobOffset = Math.sin(this.idleBobbing) * 2;
    ctx.translate(0, bobOffset);

    // Ana robot vücudu
    const bodyWidth = robotWidth * 0.75;
    const bodyHeight = robotHeight * 0.6;
    const bodyY = robotHeight * 0.25;

    // Body gradient effect
    drawPixelRect(
      robotWidth * 0.125,
      bodyY,
      bodyWidth,
      bodyHeight,
      "#4a5568",
      true
    );

    drawPixelRect(
      robotWidth * 0.15,
      bodyY + robotHeight * 0.05,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );
    drawPixelRect(
      robotWidth * 0.15,
      bodyY + robotHeight * 0.35,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );

    const headWidth = robotWidth * 0.7;
    const headHeight = robotHeight * 0.45;
    const headY = robotHeight * 0.02;

    drawPixelRect(
      robotWidth * 0.15,
      headY,
      headWidth,
      headHeight,
      "#63b3ed",
      true
    );

    drawPixelRect(
      robotWidth * 0.18,
      headY + robotHeight * 0.02,
      headWidth * 0.6,
      headHeight * 0.3,
      "#7ac3f3"
    );

    const antennaFloat = Math.sin(this.antennaFloat) * 2;
    const antennaY = headY - robotHeight * 0.08 + antennaFloat;

    drawPixelRect(
      robotWidth * 0.35,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#4a5568"
    );
    drawPixelRect(
      robotWidth * 0.55,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#4a5568"
    );

    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 8;
    drawPixelRect(
      robotWidth * 0.33,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#00f5ff"
    );
    drawPixelRect(
      robotWidth * 0.53,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#00f5ff"
    );
    ctx.restore();

    const visorWidth = robotWidth * 0.55;
    const visorHeight = robotHeight * 0.28;
    const visorY = headY + robotHeight * 0.08;

    drawPixelRect(
      robotWidth * 0.225,
      visorY,
      visorWidth,
      visorHeight,
      "#001a33"
    );
    drawPixelRect(
      robotWidth * 0.235,
      visorY + robotHeight * 0.01,
      visorWidth * 0.9,
      visorHeight * 0.85,
      "#00f5ff"
    );

    drawPixelRect(
      robotWidth * 0.25,
      visorY + robotHeight * 0.02,
      visorWidth * 0.3,
      visorHeight * 0.2,
      "#87ceeb"
    );

    this.renderCuteEyes(
      ctx,
      drawPixelRect,
      robotWidth,
      robotHeight,
      pixelSize,
      visorY + robotHeight * 0.05
    );

    const chestY = bodyY + robotHeight * 0.15;
    const chestWidth = robotWidth * 0.5;
    const chestHeight = robotHeight * 0.3;

    drawPixelRect(
      robotWidth * 0.25,
      chestY,
      chestWidth,
      chestHeight,
      "#00d4ff",
      true
    );

    drawPixelRect(
      robotWidth * 0.28,
      chestY + robotHeight * 0.03,
      chestWidth * 0.8,
      chestHeight * 0.6,
      "#40e0d0"
    );
    drawPixelRect(
      robotWidth * 0.32,
      chestY + robotHeight * 0.08,
      chestWidth * 0.6,
      chestHeight * 0.15,
      "#87ceeb"
    );

    for (let i = 0; i < 3; i++) {
      const lineY = chestY + robotHeight * (0.12 + i * 0.05);
      drawPixelRect(
        robotWidth * 0.34,
        lineY,
        chestWidth * 0.5,
        pixelSize,
        "#00f5ff"
      );
    }

    const armWidth = robotWidth * 0.18;
    const armHeight = robotHeight * 0.35;
    const armY = bodyY + robotHeight * 0.1;

    // Sol kol
    drawPixelRect(
      robotWidth * 0.02,
      armY,
      armWidth,
      armHeight,
      "#63b3ed",
      true
    );
    drawPixelRect(
      robotWidth * 0.04,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#7ac3f3"
    );
    // Kol bağlantısı
    drawPixelRect(
      robotWidth * 0.06,
      armY + robotHeight * 0.15,
      armWidth * 0.5,
      pixelSize * 2,
      "#4a5568"
    );

    // Sağ kol
    drawPixelRect(robotWidth * 0.8, armY, armWidth, armHeight, "#63b3ed", true);
    drawPixelRect(
      robotWidth * 0.82,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#7ac3f3"
    );
    drawPixelRect(
      robotWidth * 0.84,
      armY + robotHeight * 0.15,
      armWidth * 0.5,
      pixelSize * 2,
      "#4a5568"
    );

    const legWidth = robotWidth * 0.22;
    const legHeight = robotHeight * 0.25;
    const legY = robotHeight * 0.75;

    drawPixelRect(robotWidth * 0.2, legY, legWidth, legHeight, "#63b3ed", true);
    drawPixelRect(
      robotWidth * 0.22,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#7ac3f3"
    );
    drawPixelRect(
      robotWidth * 0.18,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#4a5568",
      true
    );

    drawPixelRect(
      robotWidth * 0.58,
      legY,
      legWidth,
      legHeight,
      "#63b3ed",
      true
    );
    drawPixelRect(
      robotWidth * 0.6,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#7ac3f3"
    );
    drawPixelRect(
      robotWidth * 0.56,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#4a5568",
      true
    );

    // Translation'ı sıfırla
    ctx.translate(0, -bobOffset);
  }

  /**
   * Güzel, ifade dolu gözleri çiz
   */
  renderCuteEyes(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    eyeBaseY
  ) {
    const eyeSize = pixelSize * 4;
    const eyeSpacing = robotWidth * 0.15;
    const leftEyeX = robotWidth * 0.35;
    const rightEyeX = robotWidth * 0.55;

    if (this.isBlinking) {
      drawPixelRect(
        leftEyeX,
        eyeBaseY + eyeSize * 0.4,
        eyeSize,
        pixelSize,
        "#1a202c"
      );
      drawPixelRect(
        rightEyeX,
        eyeBaseY + eyeSize * 0.4,
        eyeSize,
        pixelSize,
        "#1a202c"
      );
    } else {
      switch (this.eyeEmote) {
        case "happy":
          drawPixelRect(leftEyeX, eyeBaseY, eyeSize, pixelSize * 2, "#1a202c");
          drawPixelRect(
            leftEyeX + pixelSize,
            eyeBaseY + pixelSize,
            eyeSize - pixelSize * 2,
            pixelSize,
            "#1a202c"
          );

          drawPixelRect(rightEyeX, eyeBaseY, eyeSize, pixelSize * 2, "#1a202c");
          drawPixelRect(
            rightEyeX + pixelSize,
            eyeBaseY + pixelSize,
            eyeSize - pixelSize * 2,
            pixelSize,
            "#1a202c"
          );
          break;

        case "focused":
          drawPixelRect(
            leftEyeX,
            eyeBaseY + pixelSize,
            eyeSize,
            pixelSize * 2,
            "#1a202c"
          );
          drawPixelRect(
            rightEyeX,
            eyeBaseY + pixelSize,
            eyeSize,
            pixelSize * 2,
            "#1a202c"
          );
          break;

        case "surprised":
          drawPixelRect(
            leftEyeX - pixelSize,
            eyeBaseY - pixelSize,
            eyeSize + pixelSize * 2,
            eyeSize + pixelSize * 2,
            "#1a202c"
          );
          drawPixelRect(
            rightEyeX - pixelSize,
            eyeBaseY - pixelSize,
            eyeSize + pixelSize * 2,
            eyeSize + pixelSize * 2,
            "#1a202c"
          );
          break;

        default:
          drawPixelRect(leftEyeX, eyeBaseY, eyeSize, eyeSize, "#1a202c");
          drawPixelRect(rightEyeX, eyeBaseY, eyeSize, eyeSize, "#1a202c");

          drawPixelRect(
            leftEyeX + pixelSize,
            eyeBaseY + pixelSize,
            pixelSize,
            pixelSize,
            "#4a5568"
          );
          drawPixelRect(
            rightEyeX + pixelSize,
            eyeBaseY + pixelSize,
            pixelSize,
            pixelSize,
            "#4a5568"
          );
      }
    }
  }

  renderRobotBack(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    depthOffset
  ) {
    const bobOffset = Math.sin(this.idleBobbing) * 2;
    ctx.translate(0, bobOffset);

    const bodyWidth = robotWidth * 0.75;
    const bodyHeight = robotHeight * 0.6;
    const bodyY = robotHeight * 0.25;

    drawPixelRect(
      robotWidth * 0.125,
      bodyY,
      bodyWidth,
      bodyHeight,
      "#3a4553",
      true
    );

    drawPixelRect(
      robotWidth * 0.15,
      bodyY + robotHeight * 0.05,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#4a5568"
    );
    drawPixelRect(
      robotWidth * 0.15,
      bodyY + robotHeight * 0.35,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#4a5568"
    );

    const headWidth = robotWidth * 0.7;
    const headHeight = robotHeight * 0.45;
    const headY = robotHeight * 0.02;

    drawPixelRect(
      robotWidth * 0.15,
      headY,
      headWidth,
      headHeight,
      "#5aa3dd",
      true
    );

    drawPixelRect(
      robotWidth * 0.18,
      headY + robotHeight * 0.02,
      headWidth * 0.6,
      headHeight * 0.3,
      "#6ac3ed"
    );

    const antennaFloat = Math.sin(this.antennaFloat) * 2;
    const antennaY = headY - robotHeight * 0.08 + antennaFloat;

    drawPixelRect(
      robotWidth * 0.35,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#3a4553"
    );
    drawPixelRect(
      robotWidth * 0.55,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#3a4553"
    );

    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 6;
    drawPixelRect(
      robotWidth * 0.33,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#0099cc"
    );
    drawPixelRect(
      robotWidth * 0.53,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#0099cc"
    );
    ctx.restore();

    const backPanelY = headY + robotHeight * 0.08;
    drawPixelRect(
      robotWidth * 0.25,
      backPanelY,
      robotWidth * 0.5,
      robotHeight * 0.25,
      "#2d5a87"
    );
    drawPixelRect(
      robotWidth * 0.28,
      backPanelY + robotHeight * 0.02,
      robotWidth * 0.44,
      robotHeight * 0.2,
      "#1e3f5f"
    );

    for (let i = 0; i < 4; i++) {
      const ventY = backPanelY + robotHeight * (0.04 + i * 0.04);
      drawPixelRect(
        robotWidth * 0.3,
        ventY,
        robotWidth * 0.4,
        pixelSize,
        "#0d1f2f"
      );
    }

    const chestY = bodyY + robotHeight * 0.15;
    const chestWidth = robotWidth * 0.5;
    const chestHeight = robotHeight * 0.3;

    drawPixelRect(
      robotWidth * 0.25,
      chestY,
      chestWidth,
      chestHeight,
      "#2d5a87",
      true
    );
    drawPixelRect(
      robotWidth * 0.28,
      chestY + robotHeight * 0.03,
      chestWidth * 0.8,
      chestHeight * 0.6,
      "#1e3f5f"
    );

    drawPixelRect(
      robotWidth * 0.35,
      chestY + robotHeight * 0.12,
      chestWidth * 0.6,
      robotHeight * 0.08,
      "#0d1f2f"
    );
    drawPixelRect(
      robotWidth * 0.37,
      chestY + robotHeight * 0.22,
      chestWidth * 0.5,
      robotHeight * 0.05,
      "#0d1f2f"
    );

    const armWidth = robotWidth * 0.18;
    const armHeight = robotHeight * 0.35;
    const armY = bodyY + robotHeight * 0.1;

    drawPixelRect(
      robotWidth * 0.02,
      armY,
      armWidth,
      armHeight,
      "#5aa3dd",
      true
    );
    drawPixelRect(
      robotWidth * 0.04,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#6ac3ed"
    );

    drawPixelRect(robotWidth * 0.8, armY, armWidth, armHeight, "#5aa3dd", true);
    drawPixelRect(
      robotWidth * 0.82,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#6ac3ed"
    );

    const legWidth = robotWidth * 0.22;
    const legHeight = robotHeight * 0.25;
    const legY = robotHeight * 0.75;

    drawPixelRect(robotWidth * 0.2, legY, legWidth, legHeight, "#5aa3dd", true);
    drawPixelRect(
      robotWidth * 0.22,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#6ac3ed"
    );
    drawPixelRect(
      robotWidth * 0.18,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#3a4553",
      true
    );

    drawPixelRect(
      robotWidth * 0.58,
      legY,
      legWidth,
      legHeight,
      "#5aa3dd",
      true
    );
    drawPixelRect(
      robotWidth * 0.6,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#6ac3ed"
    );
    drawPixelRect(
      robotWidth * 0.56,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#3a4553",
      true
    );

    ctx.translate(0, -bobOffset);
  }

  /**
   * Render robot left side view
   */
  renderRobotLeft(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    depthOffset
  ) {
    const bobOffset = Math.sin(this.idleBobbing) * 2;
    ctx.translate(0, bobOffset);

    const bodyWidth = robotWidth * 0.55;
    const bodyHeight = robotHeight * 0.6;
    const bodyY = robotHeight * 0.25;

    drawPixelRect(
      robotWidth * 0.225,
      bodyY,
      bodyWidth,
      bodyHeight,
      "#4a5568",
      true
    );

    drawPixelRect(
      robotWidth * 0.24,
      bodyY + robotHeight * 0.05,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );
    drawPixelRect(
      robotWidth * 0.24,
      bodyY + robotHeight * 0.35,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );

    const headWidth = robotWidth * 0.6;
    const headHeight = robotHeight * 0.45;
    const headY = robotHeight * 0.02;

    drawPixelRect(
      robotWidth * 0.2,
      headY,
      headWidth,
      headHeight,
      "#63b3ed",
      true
    );

    drawPixelRect(
      robotWidth * 0.22,
      headY + robotHeight * 0.02,
      headWidth * 0.7,
      headHeight * 0.3,
      "#7ac3f3"
    );

    const antennaFloat = Math.sin(this.antennaFloat) * 2;
    const antennaY = headY - robotHeight * 0.08 + antennaFloat;

    drawPixelRect(
      robotWidth * 0.45,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#4a5568"
    );

    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 8;
    drawPixelRect(
      robotWidth * 0.43,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#00f5ff"
    );
    ctx.restore();

    const visorWidth = robotWidth * 0.15;
    const visorHeight = robotHeight * 0.28;
    const visorY = headY + robotHeight * 0.08;

    drawPixelRect(robotWidth * 0.2, visorY, visorWidth, visorHeight, "#001a33");
    drawPixelRect(
      robotWidth * 0.21,
      visorY + robotHeight * 0.01,
      visorWidth * 0.8,
      visorHeight * 0.85,
      "#00f5ff"
    );

    const eyeY = visorY + robotHeight * 0.05;
    this.renderSideEye(ctx, drawPixelRect, robotWidth * 0.25, eyeY, pixelSize);

    const chestY = bodyY + robotHeight * 0.15;
    const chestWidth = robotWidth * 0.35;
    const chestHeight = robotHeight * 0.3;

    drawPixelRect(
      robotWidth * 0.325,
      chestY,
      chestWidth,
      chestHeight,
      "#00d4ff",
      true
    );
    drawPixelRect(
      robotWidth * 0.34,
      chestY + robotHeight * 0.03,
      chestWidth * 0.8,
      chestHeight * 0.6,
      "#40e0d0"
    );

    for (let i = 0; i < 2; i++) {
      const lineY = chestY + robotHeight * (0.12 + i * 0.08);
      drawPixelRect(
        robotWidth * 0.35,
        lineY,
        chestWidth * 0.6,
        pixelSize,
        "#00f5ff"
      );
    }

    const armWidth = robotWidth * 0.22;
    const armHeight = robotHeight * 0.35;
    const armY = bodyY + robotHeight * 0.1;

    drawPixelRect(robotWidth * 0.1, armY, armWidth, armHeight, "#63b3ed", true);
    drawPixelRect(
      robotWidth * 0.12,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#7ac3f3"
    );
    drawPixelRect(
      robotWidth * 0.14,
      armY + robotHeight * 0.15,
      armWidth * 0.5,
      pixelSize * 2,
      "#4a5568"
    );

    const legWidth = robotWidth * 0.35;
    const legHeight = robotHeight * 0.25;
    const legY = robotHeight * 0.75;

    drawPixelRect(
      robotWidth * 0.325,
      legY,
      legWidth,
      legHeight,
      "#63b3ed",
      true
    );
    drawPixelRect(
      robotWidth * 0.34,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#7ac3f3"
    );

    drawPixelRect(
      robotWidth * 0.3,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#4a5568",
      true
    );

    ctx.translate(0, -bobOffset);
  }

  renderSideEye(ctx, drawPixelRect, eyeX, eyeY, pixelSize) {
    const eyeSize = pixelSize * 4;

    if (this.isBlinking) {
      drawPixelRect(eyeX, eyeY + eyeSize * 0.4, eyeSize, pixelSize, "#1a202c");
    } else {
      switch (this.eyeEmote) {
        case "happy":
          drawPixelRect(eyeX, eyeY, eyeSize, pixelSize * 2, "#1a202c");
          drawPixelRect(
            eyeX + pixelSize,
            eyeY + pixelSize,
            eyeSize - pixelSize * 2,
            pixelSize,
            "#1a202c"
          );
          break;
        case "focused":
          drawPixelRect(
            eyeX,
            eyeY + pixelSize,
            eyeSize,
            pixelSize * 2,
            "#1a202c"
          );
          break;
        case "surprised":
          drawPixelRect(
            eyeX - pixelSize,
            eyeY - pixelSize,
            eyeSize + pixelSize * 2,
            eyeSize + pixelSize * 2,
            "#1a202c"
          );
          break;
        default:
          drawPixelRect(eyeX, eyeY, eyeSize, eyeSize, "#1a202c");
          drawPixelRect(
            eyeX + pixelSize,
            eyeY + pixelSize,
            pixelSize,
            pixelSize,
            "#4a5568"
          );
      }
    }
  }

  renderRobotRight(
    ctx,
    drawPixelRect,
    robotWidth,
    robotHeight,
    pixelSize,
    depthOffset
  ) {
    const bobOffset = Math.sin(this.idleBobbing) * 2;
    ctx.translate(0, bobOffset);

    const bodyWidth = robotWidth * 0.55;
    const bodyHeight = robotHeight * 0.6;
    const bodyY = robotHeight * 0.25;

    drawPixelRect(
      robotWidth * 0.225,
      bodyY,
      bodyWidth,
      bodyHeight,
      "#4a5568",
      true
    );

    drawPixelRect(
      robotWidth * 0.24,
      bodyY + robotHeight * 0.05,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );
    drawPixelRect(
      robotWidth * 0.24,
      bodyY + robotHeight * 0.35,
      bodyWidth * 0.8,
      bodyHeight * 0.15,
      "#5a6578"
    );

    const headWidth = robotWidth * 0.6;
    const headHeight = robotHeight * 0.45;
    const headY = robotHeight * 0.02;

    drawPixelRect(
      robotWidth * 0.2,
      headY,
      headWidth,
      headHeight,
      "#63b3ed",
      true
    );

    drawPixelRect(
      robotWidth * 0.22,
      headY + robotHeight * 0.02,
      headWidth * 0.7,
      headHeight * 0.3,
      "#7ac3f3"
    );

    const antennaFloat = Math.sin(this.antennaFloat) * 2;
    const antennaY = headY - robotHeight * 0.08 + antennaFloat;

    drawPixelRect(
      robotWidth * 0.45,
      antennaY,
      pixelSize,
      robotHeight * 0.08,
      "#4a5568"
    );

    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 8;
    drawPixelRect(
      robotWidth * 0.43,
      antennaY - pixelSize,
      pixelSize * 3,
      pixelSize * 3,
      "#00f5ff"
    );
    ctx.restore();

    const visorWidth = robotWidth * 0.15;
    const visorHeight = robotHeight * 0.28;
    const visorY = headY + robotHeight * 0.08;

    drawPixelRect(
      robotWidth * 0.65,
      visorY,
      visorWidth,
      visorHeight,
      "#001a33"
    );
    drawPixelRect(
      robotWidth * 0.66,
      visorY + robotHeight * 0.01,
      visorWidth * 0.8,
      visorHeight * 0.85,
      "#00f5ff"
    );

    const eyeY = visorY + robotHeight * 0.05;
    this.renderSideEye(ctx, drawPixelRect, robotWidth * 0.65, eyeY, pixelSize);

    const chestY = bodyY + robotHeight * 0.15;
    const chestWidth = robotWidth * 0.35;
    const chestHeight = robotHeight * 0.3;

    drawPixelRect(
      robotWidth * 0.325,
      chestY,
      chestWidth,
      chestHeight,
      "#00d4ff",
      true
    );
    drawPixelRect(
      robotWidth * 0.34,
      chestY + robotHeight * 0.03,
      chestWidth * 0.8,
      chestHeight * 0.6,
      "#40e0d0"
    );

    for (let i = 0; i < 2; i++) {
      const lineY = chestY + robotHeight * (0.12 + i * 0.08);
      drawPixelRect(
        robotWidth * 0.35,
        lineY,
        chestWidth * 0.6,
        pixelSize,
        "#00f5ff"
      );
    }

    const armWidth = robotWidth * 0.22;
    const armHeight = robotHeight * 0.35;
    const armY = bodyY + robotHeight * 0.1;

    drawPixelRect(
      robotWidth * 0.68,
      armY,
      armWidth,
      armHeight,
      "#63b3ed",
      true
    );
    drawPixelRect(
      robotWidth * 0.7,
      armY + robotHeight * 0.05,
      armWidth * 0.7,
      armHeight * 0.6,
      "#7ac3f3"
    );
    drawPixelRect(
      robotWidth * 0.72,
      armY + robotHeight * 0.15,
      armWidth * 0.5,
      pixelSize * 2,
      "#4a5568"
    );

    const legWidth = robotWidth * 0.35;
    const legHeight = robotHeight * 0.25;
    const legY = robotHeight * 0.75;

    drawPixelRect(
      robotWidth * 0.325,
      legY,
      legWidth,
      legHeight,
      "#63b3ed",
      true
    );
    drawPixelRect(
      robotWidth * 0.34,
      legY + robotHeight * 0.02,
      legWidth * 0.8,
      legHeight * 0.7,
      "#7ac3f3"
    );

    drawPixelRect(
      robotWidth * 0.3,
      legY + robotHeight * 0.18,
      legWidth * 1.1,
      legHeight * 0.3,
      "#4a5568",
      true
    );

    ctx.translate(0, -bobOffset);
  }

  getLEDPosition(robotWidth, robotHeight) {
    switch (this.facingDirection) {
      case "down":
        return { x: robotWidth * 0.47, y: robotHeight * 0.08 };
      case "up":
        return { x: robotWidth * 0.47, y: robotHeight * 0.08 };
      case "left":
        return { x: robotWidth * 0.3, y: robotHeight * 0.08 };
      case "right":
        return { x: robotWidth * 0.6, y: robotHeight * 0.08 };
      default:
        return { x: robotWidth * 0.47, y: robotHeight * 0.08 };
    }
  }

  renderThrusterEffects(ctx, robotWidth, robotHeight) {
    const direction = this.velocity.normalize();
    let thrusterOffset;

    switch (this.facingDirection) {
      case "down":
        thrusterOffset = new Vector2(0, -robotHeight * 0.6);
        break;
      case "up":
        thrusterOffset = new Vector2(0, robotHeight * 0.6);
        break;
      case "left":
        thrusterOffset = new Vector2(robotWidth * 0.6, 0);
        break;
      case "right":
        thrusterOffset = new Vector2(-robotWidth * 0.6, 0);
        break;
      default:
        thrusterOffset = direction.multiply(-robotWidth * 0.8);
    }

    for (let i = 0; i < 3; i++) {
      const offset = thrusterOffset.add(
        new Vector2((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
      );

      ctx.fillStyle = i === 0 ? "#00f5ff" : "#40e0d0";
      ctx.shadowColor = "#00f5ff";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(offset.x, offset.y, 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  renderDirectionIndicator(ctx) {
    const direction = this.velocity.normalize();
    const arrowStart = direction.multiply(this.width * 0.1);
    const arrowEnd = direction.multiply(this.width * 0.5);

    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.moveTo(arrowStart.x, arrowStart.y);
    ctx.lineTo(arrowEnd.x, arrowEnd.y);

    const arrowSize = 6;
    const perpendicular = new Vector2(-direction.y, direction.x);
    const arrowHead1 = arrowEnd
      .subtract(direction.multiply(arrowSize))
      .add(perpendicular.multiply(arrowSize / 2));
    const arrowHead2 = arrowEnd
      .subtract(direction.multiply(arrowSize))
      .subtract(perpendicular.multiply(arrowSize / 2));

    ctx.lineTo(arrowHead1.x, arrowHead1.y);
    ctx.moveTo(arrowEnd.x, arrowEnd.y);
    ctx.lineTo(arrowHead2.x, arrowHead2.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
