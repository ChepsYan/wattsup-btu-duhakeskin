/**
 * Lazer Sistemi - Lazer ışınları, yansıma, varlık kesişimi
 */

import { Vector2 } from "./utils.js";
import { LaserCollisionDetector } from "./collision.js";
import {
  LASER_BOUNCE_LIMIT,
  COLORS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "./constants.js";
import { LaserPowerCellManager } from "./laserPowerCell.js";

/* Lazer Ayarları  */
export const LaserConfig = {
  physics: {
    maxDistance: 2000,
    bounceLimit: LASER_BOUNCE_LIMIT,
    minIntensity: 0.1,
    intensityDecay: 0.1, // Sıçrama başına
  },
  rendering: {
    baseWidth: 2,
    glowSize: 6,
    coreIntensity: 0.9,
    impactRadius: 5,
    cullingMargin: 100, // Görüntü alanı dışında hala render edilecek pikseller
  },
  performance: {
    maxBeamsPerFrame: 50,
    poolSize: 100,
    debugMode: false, // Lazer uzunluk bilgisini göstermek için hata ayıklama modunu etkinleştir
  },
  debug: {
    showLengthInfo: false, // Uzunluk hata ayıklama bilgisini göster
    showCollisionPoints: false, // Çarpışma noktalarını göster
    showBlockingEntities: false, // Lazerin ne tarafından engellendiğini göster
    logLaserData: false, // Lazer verilerini konsola kaydet
    logEarlyCollisions: false, // YENİ: Çok erken gerçekleşen çarpışmaları kaydet
  },
};

// ===== Obje Poolları(Optimizasyon ile Alakalı Kısımlar) =====

class Vector2Pool {
  constructor(size = 50) {
    this.pool = [];
    this.used = [];

    for (let i = 0; i < size; i++) {
      this.pool.push(new Vector2(0, 0));
    }
  }

  get(x = 0, y = 0) {
    const vector = this.pool.pop() || new Vector2(0, 0);
    vector.x = x;
    vector.y = y;
    this.used.push(vector);
    return vector;
  }

  release() {
    while (this.used.length > 0) {
      this.pool.push(this.used.pop());
    }
  }
}

class LaserBeamPool {
  constructor(size = 50) {
    this.pool = [];
    this.active = [];

    for (let i = 0; i < size; i++) {
      this.pool.push(new LaserBeam());
    }
  }

  get(start, end, bounceCount = 0, intensity = 1.0) {
    const beam = this.pool.pop() || new LaserBeam();
    beam.init(start, end, bounceCount, intensity);
    this.active.push(beam);
    return beam;
  }

  releaseAll() {
    while (this.active.length > 0) {
      const beam = this.active.pop();
      beam.reset();
      this.pool.push(beam);
    }
  }
}

// ===== LASER BEAM SINIFI =====

/**
 * Tek bir lazer ışını segmenti
 */
export class LaserBeam {
  constructor() {
    this.reset();
  }

  init(start, end, bounceCount = 0, intensity = 1.0) {
    this.start = start;
    this.end = end;
    this.bounceCount = bounceCount;
    this.intensity = Math.max(0, intensity);
    this.length = this.calculateLength();
    this.direction = this.calculateDirection();
    this.color = this.getIntensityColor();
    this.visible = true;
    return this;
  }

  reset() {
    this.start = null;
    this.end = null;
    this.bounceCount = 0;
    this.intensity = 1.0;
    this.length = 0;
    this.direction = null;
    this.color = null;
    this.visible = false;
  }

  calculateLength() {
    if (!this.start || !this.end) return 0;
    return this.start.distance(this.end);
  }

  calculateDirection() {
    if (!this.start || !this.end) return new Vector2(0, 0);
    return this.end.subtract(this.start).normalize();
  }

  getIntensityColor() {
    const alpha = Math.max(0.3, this.intensity);
    const red = Math.floor(255 * this.intensity);
    const green = Math.floor(100 * this.intensity);
    const blue = Math.floor(50 * this.intensity);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  isInViewport(
    cameraX = 0,
    cameraY = 0,
    viewportWidth = CANVAS_WIDTH,
    viewportHeight = CANVAS_HEIGHT
  ) {
    const margin = LaserConfig.rendering.cullingMargin;

    const minX = Math.min(this.start.x, this.end.x);
    const maxX = Math.max(this.start.x, this.end.x);
    const minY = Math.min(this.start.y, this.end.y);
    const maxY = Math.max(this.start.y, this.end.y);

    return !(
      maxX < cameraX - margin ||
      minX > cameraX + viewportWidth + margin ||
      maxY < cameraY - margin ||
      minY > cameraY + viewportHeight + margin
    );
  }

  getLength() {
    return this.length;
  }

  getDirection() {
    return this.direction;
  }

  /**
   * Lazer ışını renderlanması
   */
  render(ctx) {
    if (!this.visible || !this.start || !this.end) return;

    const beamLength = this.length;

    ctx.save();

    const baseWidth = Math.max(1, 1 + this.intensity * 0.5);
    const glowSize = 3 + this.intensity * 3;

    ctx.shadowColor = this.color;
    ctx.shadowBlur = glowSize * 2;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = baseWidth * 3;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.15;

    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();

    ctx.shadowBlur = glowSize;
    ctx.lineWidth = baseWidth * 2;
    ctx.globalAlpha = 0.3;

    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = baseWidth;
    ctx.globalAlpha = Math.min(1.0, 0.7 + this.intensity * 0.3);

    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(
      1.0,
      this.intensity * 0.9
    )})`;
    ctx.lineWidth = Math.max(0.5, baseWidth * 0.3);
    ctx.globalAlpha = 1.0;

    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();

    if (beamLength < 1800) {
      this.renderImpactEffect(ctx, this.end);
    }

    // DEBUG: Visual debug information
    if (LaserConfig.debug.showLengthInfo) {
      this.renderDebugInfo(ctx, beamLength);
    }

    ctx.restore();
  }

  /**
   * Lazer kesişim Efekti
   */
  renderImpactEffect(ctx, impactPoint) {
    const time = Date.now() * 0.01;
    const pulseIntensity = 0.7 + 0.3 * Math.sin(time * 0.1);
    const impactRadius = 3 + this.intensity * 2;

    const impactGradient = ctx.createRadialGradient(
      impactPoint.x,
      impactPoint.y,
      0,
      impactPoint.x,
      impactPoint.y,
      impactRadius * pulseIntensity
    );

    impactGradient.addColorStop(0, this.color);
    impactGradient.addColorStop(0.3, this.color.replace(/[\d.]+\)$/g, "0.6)"));
    impactGradient.addColorStop(1, this.color.replace(/[\d.]+\)$/g, "0.0)"));

    ctx.fillStyle = impactGradient;
    ctx.beginPath();
    ctx.arc(
      impactPoint.x,
      impactPoint.y,
      impactRadius * pulseIntensity,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * pulseIntensity})`;
    ctx.beginPath();
    ctx.arc(impactPoint.x, impactPoint.y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Lazer Debug Bilgileri
   */
  renderDebugInfo(ctx, beamLength) {
    const maxDistance = LaserConfig.physics.maxDistance;
    const lengthRatio = beamLength / maxDistance;
    const isCutShort = beamLength < maxDistance * 0.9;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    const startPos = this.start;
    const bgColor = isCutShort
      ? "rgba(255, 0, 0, 0.8)"
      : "rgba(0, 255, 0, 0.6)";
    const textColor = "#ffffff";

    const lengthText = `${Math.round(beamLength)}px (${(
      lengthRatio * 100
    ).toFixed(0)}%)`;
    ctx.font = "bold 10px Arial";
    const textMetrics = ctx.measureText(lengthText);
    const boxWidth = textMetrics.width + 8;
    const boxHeight = 16;

    ctx.fillStyle = bgColor;
    ctx.fillRect(
      startPos.x - boxWidth / 2,
      startPos.y - 25,
      boxWidth,
      boxHeight
    );

    ctx.strokeStyle = isCutShort ? "#ff0000" : "#00ff00";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      startPos.x - boxWidth / 2,
      startPos.y - 25,
      boxWidth,
      boxHeight
    );

    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.fillText(lengthText, startPos.x, startPos.y - 13);

    if (isCutShort && LaserConfig.debug.showCollisionPoints) {
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(this.end.x, this.end.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
      ctx.fillRect(this.end.x - 15, this.end.y - 20, 30, 12);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "center";
      ctx.fillText("HIT", this.end.x, this.end.y - 11);
    }

    if (beamLength < 50) {
      const direction = this.direction;
      const arrowLength = 30;
      const arrowEnd = this.start.add(direction.multiply(arrowLength));

      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.start.x, this.start.y);
      ctx.lineTo(arrowEnd.x, arrowEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const perpendicular = new Vector2(-direction.y, direction.x);
      const arrowHead1 = arrowEnd
        .subtract(direction.multiply(8))
        .add(perpendicular.multiply(4));
      const arrowHead2 = arrowEnd
        .subtract(direction.multiply(8))
        .subtract(perpendicular.multiply(4));

      ctx.beginPath();
      ctx.moveTo(arrowEnd.x, arrowEnd.y);
      ctx.lineTo(arrowHead1.x, arrowHead1.y);
      ctx.moveTo(arrowEnd.x, arrowEnd.y);
      ctx.lineTo(arrowHead2.x, arrowHead2.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Lazer Renderer
 */
export class LaserRenderer {
  constructor() {
    this.gradientCache = new Map();
    this.maxCacheSize = 100;
  }

  getCachedGradient(ctx, start, end, color) {
    const key = `${Math.floor(start.x)},${Math.floor(start.y)},${Math.floor(
      end.x
    )},${Math.floor(end.y)},${color}`;

    if (this.gradientCache.has(key)) {
      return this.gradientCache.get(key);
    }

    if (this.gradientCache.size >= this.maxCacheSize) {
      // Clear old entries
      const firstKey = this.gradientCache.keys().next().value;
      this.gradientCache.delete(firstKey);
    }

    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, color);

    this.gradientCache.set(key, gradient);
    return gradient;
  }

  renderBeam(ctx, beam, cameraX = 0, cameraY = 0) {
    if (!beam.visible || !beam.start || !beam.end) return;

    // Viewport culling
    if (!beam.isInViewport(cameraX, cameraY)) return;

    const config = LaserConfig.rendering;
    const baseWidth = config.baseWidth * (1 + beam.intensity * 0.5);

    ctx.save();

    // Efficient glow effect with fewer layers
    this.renderGlow(ctx, beam, baseWidth * 2, 0.15);
    this.renderCore(ctx, beam, baseWidth);
    this.renderImpact(ctx, beam);

    ctx.restore();
  }

  renderGlow(ctx, beam, width, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.shadowColor = beam.color;
    ctx.shadowBlur = LaserConfig.rendering.glowSize;

    ctx.beginPath();
    ctx.moveTo(beam.start.x, beam.start.y);
    ctx.lineTo(beam.end.x, beam.end.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  renderCore(ctx, beam, width) {
    ctx.globalAlpha = Math.min(1.0, 0.7 + beam.intensity * 0.3);
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(beam.start.x, beam.start.y);
    ctx.lineTo(beam.end.x, beam.end.y);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = `rgba(255, 255, 255, ${
      beam.intensity * LaserConfig.rendering.coreIntensity
    })`;
    ctx.lineWidth = Math.max(0.5, width * 0.3);

    ctx.beginPath();
    ctx.moveTo(beam.start.x, beam.start.y);
    ctx.lineTo(beam.end.x, beam.end.y);
    ctx.stroke();
  }

  renderImpact(ctx, beam) {
    if (beam.length >= LaserConfig.physics.maxDistance * 0.9) return;

    const time = Date.now() * 0.01;
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.1);
    const radius = LaserConfig.rendering.impactRadius * pulse;

    const gradient = ctx.createRadialGradient(
      beam.end.x,
      beam.end.y,
      0,
      beam.end.x,
      beam.end.y,
      radius
    );

    gradient.addColorStop(0, beam.color);
    gradient.addColorStop(0.3, beam.color.replace(/[\d.]+\)$/g, "0.6)"));
    gradient.addColorStop(1, beam.color.replace(/[\d.]+\)$/g, "0.0)"));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(beam.end.x, beam.end.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  clearCache() {
    this.gradientCache.clear();
  }
}

// ===== Lazer Hesaplamaları =====

export class LaserPhysics {
  constructor() {
    this.collisionDetector = new LaserCollisionDetector();
    this.vectorPool = new Vector2Pool();
    this.powerCellManager = new LaserPowerCellManager();
  }

  traceLaser(
    start,
    direction,
    entities,
    wallCollisionCallback,
    bounceCount = 0,
    intensity = 1.0
  ) {
    if (
      bounceCount >= LaserConfig.physics.bounceLimit ||
      intensity < LaserConfig.physics.minIntensity
    ) {
      return null;
    }

    try {
      const traceResult = this.collisionDetector.traceLaser(
        start,
        direction,
        entities,
        wallCollisionCallback
      );

      if (!traceResult) return null;

      const { endPoint, hitEntities, wallHit } = traceResult;

      const expectedMaxDistance = LaserConfig.physics.maxDistance;
      const actualDistance = start.distance(endPoint);
      const lengthRatio = actualDistance / expectedMaxDistance;

      if (
        LaserConfig.debug.logLaserData &&
        actualDistance < expectedMaxDistance * 0.9
      ) {
        console.group(`🔴 Lazer Kesildi - Uzunluk Hata Ayıklama Bilgileri`);
        console.log(`Beklenen maksimum uzunluk: ${expectedMaxDistance}px`);
        console.log(`Gerçek uzunluk: ${Math.round(actualDistance)}px`);
        console.log(`Uzunluk oranı: ${(lengthRatio * 100).toFixed(1)}%`);
        console.log(
          `Başlangıç: (${Math.round(start.x)}, ${Math.round(start.y)})`
        );
        console.log(
          `Bitiş: (${Math.round(endPoint.x)}, ${Math.round(endPoint.y)})`
        );
        console.log(
          `Yön: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`
        );
        console.log(`Duvar çarpışması: ${wallHit}`);

        if (hitEntities.length > 0) {
          console.log(`${hitEntities.length} varlıkla karşılaştı:`);
          hitEntities.forEach((hitEntity, index) => {
            const entity = hitEntity.entity;
            const hit = hitEntity.hit;
            const distance = hit.t * actualDistance;
            console.log(
              `  ${index + 1}. ${entity.constructor.name} (solid: ${
                entity.solid
              })`
            );
            console.log(
              `     Konum: (${Math.round(entity.position.x)}, ${Math.round(
                entity.position.y
              )})`
            );
            console.log(`     Uzaklık: ${Math.round(distance)}px`);
            console.log(
              `     Çarpışma Noktası: (${Math.round(hit.point.x)}, ${Math.round(
                hit.point.y
              )})`
            );

            // Check if this entity is the one blocking the laser
            if (
              entity.solid &&
              Math.abs(hit.point.x - endPoint.x) < 5 &&
              Math.abs(hit.point.y - endPoint.y) < 5
            ) {
              console.log(`Lazer engellendi`);
            }
          });
        } else {
          console.log(`Varlıkla karşılaşılmadı`);
        }
        console.groupEnd();
      }

      for (const { entity } of hitEntities) {
        this.powerCellManager.processLaserHitOnPowerCell(entity);
      }

      return {
        endPoint,
        hitEntities,
        wallHit,
        intensity,
        debug: LaserConfig.debug.logLaserData
          ? {
              expectedDistance: expectedMaxDistance,
              actualDistance: actualDistance,
              lengthRatio: lengthRatio,
              wasCutShort: actualDistance < expectedMaxDistance * 0.9,
              blockingReason: wallHit
                ? "wall"
                : hitEntities.find((h) => h.entity.solid)
                ? "entity"
                : "none",
            }
          : undefined,
      };
    } catch (error) {
      if (LaserConfig.performance.debugMode) {
        console.warn("Lazer izleme hatası:", error);
      }
      return null;
    } finally {
      this.vectorPool.release();
    }
  }

  checkPlayerCollision(player, beams) {
    return this.collisionDetector.checkPlayerLaserCollision(player, beams);
  }
}

// ===== Ana Lazer Sistemi =====

export class LaserSystem {
  constructor() {
    this.beamPool = new LaserBeamPool(LaserConfig.performance.poolSize);
    this.renderer = new LaserRenderer();
    this.physics = new LaserPhysics();
    this.effects = new LaserEffects();

    this.activeBeams = [];
    this.frameCounter = 0;
    this.lastUpdate = 0;

    // Performans izleme
    this.stats = {
      beamsGenerated: 0,
      entityInteractions: 0,
      renderTime: 0,
    };
  }

  update(entities, wallCollisionCallback = null) {
    const startTime = performance.now();

    this.beamPool.releaseAll();
    this.activeBeams = [];

    if (!entities?.length) return;

    const activeLasers = this.findActiveLasers(entities);

    if (LaserConfig.performance.debugMode) {
      console.log(`Processing ${activeLasers.length} active laser emitters`);
    }

    let beamCount = 0;
    for (const emitter of activeLasers) {
      if (beamCount >= LaserConfig.performance.maxBeamsPerFrame) break;

      const beam = this.processLaserEmitter(
        emitter,
        entities,
        wallCollisionCallback
      );
      if (beam) {
        this.activeBeams.push(beam);
        beamCount++;
      }
    }

    this.stats.beamsGenerated = this.activeBeams.length;
    this.stats.renderTime = performance.now() - startTime;
    this.frameCounter++;
  }

  findActiveLasers(entities) {
    return entities.filter(
      (entity) =>
        entity?.constructor.name === "LaserEmitter" &&
        !entity.destroyed &&
        entity.visible !== false &&
        entity.isActive === true
    );
  }

  processLaserEmitter(emitter, entities, wallCollisionCallback) {
    try {
      const start = emitter.getLaserStart();
      const direction = emitter.getDirectionVector();

      if (!start || !direction?.magnitude()) return null;

      if (LaserConfig.debug && LaserConfig.debug.logEarlyCollisions) {
        this.physics.collisionDetector.debugNearbyEntities(emitter, entities);
      }

      const normalizedDirection = direction.normalize();
      const result = this.physics.traceLaser(
        start,
        normalizedDirection,
        entities,
        wallCollisionCallback
      );

      if (!result) return null;

      return this.beamPool.get(start, result.endPoint, 0, result.intensity);
    } catch (error) {
      if (LaserConfig.performance.debugMode) {
        console.warn(`Lazer yayıcı işleme hatası ${emitter.id}:`, error);
      }
      return null;
    }
  }

  render(ctx, cameraX = 0, cameraY = 0) {
    const startTime = performance.now();

    for (const beam of this.activeBeams) {
      if (beam.visible) {
        beam.render(ctx);
      }
    }

    this.effects.render(ctx);

    this.stats.renderTime += performance.now() - startTime;
  }

  checkPlayerCollision(player) {
    return this.physics.checkPlayerCollision(player, this.activeBeams);
  }

  getBeamCount() {
    return this.activeBeams.length;
  }

  getActiveBeams() {
    return this.activeBeams;
  }

  getStats() {
    return {
      ...this.stats,
      poolStats: {
        beamsInPool: this.beamPool.pool.length,
        activeBeams: this.beamPool.active.length,
      },
      frameCounter: this.frameCounter,
    };
  }

  configure(config) {
    Object.assign(LaserConfig, config);
  }

  setDebugMode(enabled) {
    LaserConfig.performance.debugMode = enabled;
  }

  dispose() {
    this.beamPool.releaseAll();
    this.renderer.clearCache();
    this.effects.clear();
  }
}

export class LaserEffects {
  constructor() {
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 100;
  }

  createSpark(position, intensity = 1.0) {
    const particleCount = Math.min(5, Math.floor(3 * intensity));

    for (let i = 0; i < particleCount; i++) {
      const particle = this.getParticle();
      particle.position = position.clone();
      particle.velocity = new Vector2(
        (Math.random() - 0.5) * 4 * intensity,
        (Math.random() - 0.5) * 4 * intensity
      );
      particle.life = 20 * intensity;
      particle.maxLife = particle.life;
      particle.size = Math.random() * 2 + 1;
      particle.active = true;

      this.particles.push(particle);
    }
  }

  getParticle() {
    return (
      this.particlePool.pop() || {
        position: new Vector2(),
        velocity: new Vector2(),
        life: 0,
        maxLife: 0,
        size: 0,
        active: false,
      }
    );
  }

  update(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.position = particle.position.add(particle.velocity);
      particle.velocity = particle.velocity.multiply(0.95);
      particle.life--;

      if (particle.life <= 0) {
        particle.active = false;
        this.particlePool.push(this.particles.splice(i, 1)[0]);
      }
    }
  }

  render(ctx) {
    if (this.particles.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.LASER_HIT;

      ctx.beginPath();
      ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.size * alpha,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }

  clear() {
    while (this.particles.length > 0) {
      const particle = this.particles.pop();
      particle.active = false;
      this.particlePool.push(particle);
    }
  }
}
