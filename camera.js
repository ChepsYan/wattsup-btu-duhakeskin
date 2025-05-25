/**
 * Kamera Sistemi - Oyuncuyu takip eden dinamik viewport
 * Sonsuz labirentler için dünya-ekran koordinat dönüşümlerini işler
 */

import { Vector2, clamp, lerp } from "./utils.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "./constants.js";

/**
 * Kamera sınıfı dinamik viewport yönetimi için
 */
export class Camera {
  constructor() {
    // Kamera konumu
    this.position = new Vector2(0, 0);
    this.targetPosition = new Vector2(0, 0);

    // Kamera özellikleri
    this.followSpeed = 0.1; // Kamera hedefe ne kadar geç takip edeceği (0-1)
    this.lookAhead = 1; // Kamera hedefe ne kadar uzaktan bakacağı (tile cinsinden)
    this.deadZone = { width: TILE_SIZE * 0, height: TILE_SIZE * 0 }; // Kamera hareket etmeye başlamadan önceki ölü alan (tile cinsinden)

    // Viewport özellikleri
    this.viewportWidth = CANVAS_WIDTH;
    this.viewportHeight = CANVAS_HEIGHT;

    // Shake efekti
    this.shake = { x: 0, y: 0, intensity: 0, duration: 0 };

    this.zoom = 1.0;
  }

  /**
   * Kamera hedefini ayarla (genellikle oyuncu konumu)
   * @param {Vector2} targetPos - Hedef konumu
   */
  setTarget(targetPos) {
    this.targetPosition = targetPos.clone();
  }

  /**
   * Kamera konumunu yumuşak takip ile güncelle
   * @param {Vector2} playerPos - Oyuncu konumu
   * @param {Vector2} playerVelocity - Oyuncu hızı (önceden bakılacak)
   * @param {number} deltaTime - Zaman farkı
   */
  update(playerPos, playerVelocity = new Vector2(0, 0), deltaTime) {
    // Önceden bakılacak konumu hesapla
    const lookAheadOffset = playerVelocity
      .normalize()
      .multiply(this.lookAhead * TILE_SIZE);
    const desiredPosition = playerPos.add(lookAheadOffset);

    // Ölü alan
    const deltaX = desiredPosition.x - this.position.x;
    const deltaY = desiredPosition.y - this.position.y;

    let shouldMoveX = Math.abs(deltaX) > this.deadZone.width / 2;
    let shouldMoveY = Math.abs(deltaY) > this.deadZone.height / 2;

    // Yumuşak kamera hareketi
    if (shouldMoveX || shouldMoveY) {
      this.targetPosition = desiredPosition.clone();
    }

    // Hedef konuma yumuşak geçiş
    this.position.x = lerp(
      this.position.x,
      this.targetPosition.x,
      this.followSpeed
    );
    this.position.y = lerp(
      this.position.y,
      this.targetPosition.y,
      this.followSpeed
    );

    // Ekran shake'i güncelle
    this.updateShake(deltaTime);
  }

  /**
   * Ekran shake'i güncelle
   * @param {number} deltaTime - Zaman farkı
   */
  updateShake(deltaTime) {
    if (this.shake.duration > 0) {
      this.shake.duration -= deltaTime;

      const shakeStrength = this.shake.intensity * (this.shake.duration / 100);
      this.shake.x = (Math.random() - 0.5) * 0.01 * shakeStrength;
      this.shake.y = (Math.random() - 0.5) * 0.01 * shakeStrength;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }
  }

  /**
   * Ekran shake'i ekle
   * @param {number} intensity - Shake şiddeti (piksel cinsinden)
   * @param {number} duration - Shake süresi (milisaniye cinsinden)
   */
  addShake(intensity, duration) {
    this.shake.intensity = Math.max(this.shake.intensity, intensity);
    this.shake.duration = Math.max(this.shake.duration, duration);
  }

  applyTransform(ctx) {
    ctx.save();

    // Center camera on viewport
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;

    // Apply zoom and position transforms
    ctx.translate(centerX, centerY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(
      -this.position.x + this.shake.x,
      -this.position.y + this.shake.y
    );
  }

  removeTransform(ctx) {
    ctx.restore();
  }

  /**
   * Dünya koordinatlarını ekran koordinatlarına dönüştürme
   * @param {Vector2} worldPos - Dünya koordinatlarındaki konum
   * @returns {Vector2} Ekran koordinatlarındaki konum
   */
  worldToScreen(worldPos) {
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;

    return new Vector2(
      (worldPos.x - this.position.x) * this.zoom + centerX + this.shake.x,
      (worldPos.y - this.position.y) * this.zoom + centerY + this.shake.y
    );
  }

  /**
   * Ekran koordinatlarını dünya koordinatlarına dönüştürme
   * @param {Vector2} screenPos - Ekran koordinatlarındaki konum
   * @returns {Vector2} Dünya koordinatlarındaki konum
   */
  screenToWorld(screenPos) {
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;

    return new Vector2(
      (screenPos.x - centerX - this.shake.x) / this.zoom + this.position.x,
      (screenPos.y - centerY - this.shake.y) / this.zoom + this.position.y
    );
  }

  /**
   * Kamera viewport sınırlarını dünya koordinatlarında al
   * @returns {Object} Sınırlar {left, right, top, bottom, width, height}
   */
  getViewportBounds() {
    const halfWidth = this.viewportWidth / 2 / this.zoom;
    const halfHeight = this.viewportHeight / 2 / this.zoom;

    return {
      left: this.position.x - halfWidth,
      right: this.position.x + halfWidth,
      top: this.position.y - halfHeight,
      bottom: this.position.y + halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    };
  }

  /**
   * Dünya koordinatlarında bir konumun görünür olup olmadığını kontrol et
   * @param {Vector2} worldPos - Dünya koordinatlarındaki konum
   * @param {number} margin - Ekran sınırlarına ekstra boşluk
   * @returns {boolean} Konum görünürlüğü
   */
  isVisible(worldPos, margin = 0) {
    const bounds = this.getViewportBounds();
    return (
      worldPos.x >= bounds.left - margin &&
      worldPos.x <= bounds.right + margin &&
      worldPos.y >= bounds.top - margin &&
      worldPos.y <= bounds.bottom + margin
    );
  }

  isRectVisible(rect, margin = 0) {
    const bounds = this.getViewportBounds();
    return !(
      rect.x + rect.width < bounds.left - margin ||
      rect.x > bounds.right + margin ||
      rect.y + rect.height < bounds.top - margin ||
      rect.y > bounds.bottom + margin
    );
  }

  /**
   * Hızlıca kamera hedef konumuna çek (yumuşak geçiş ılmadan)
   * @param {Vector2} position - Hedef konumu
   */
  snapTo(position) {
    this.position = position.clone();
    this.targetPosition = position.clone();
  }

  /**
   * Kamera özelliklerini ayarla
   * @param {Object} options - Kamera seçenekleri
   */
  setProperties({ followSpeed, lookAhead, deadZone, zoom } = {}) {
    if (followSpeed !== undefined) this.followSpeed = clamp(followSpeed, 0, 1);
    if (lookAhead !== undefined) this.lookAhead = Math.max(0, lookAhead);
    if (deadZone !== undefined)
      this.deadZone = { ...this.deadZone, ...deadZone };
    if (zoom !== undefined) this.zoom = clamp(zoom, 0.1, 5.0);
  }

  getDebugInfo() {
    return {
      position: this.position.toString(),
      target: this.targetPosition.toString(),
      zoom: this.zoom.toFixed(2),
      shake: `${this.shake.intensity.toFixed(1)}/${this.shake.duration.toFixed(
        0
      )}`,
      viewport: `${this.viewportWidth}x${this.viewportHeight}`,
    };
  }
}
