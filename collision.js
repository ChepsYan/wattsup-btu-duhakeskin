/**
 * Çarpışma Sistemi
 * Çarpışma tespiti, kesişim testi vs özellikleri içerir
 */

import { Vector2 } from "./utils.js";
import { TILE_SIZE } from "./constants.js";
import { LaserConfig } from "./laser.js";

export function rectangleIntersect(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

export function entitiesIntersect(entity1, entity2) {
  const bounds1 = entity1.getBounds();
  const bounds2 = entity2.getBounds();
  return rectangleIntersect(bounds1, bounds2);
}

export function pointInRectangle(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function circleRectangleIntersect(center, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));

  const distanceX = center.x - closestX;
  const distanceY = center.y - closestY;

  return distanceX * distanceX + distanceY * distanceY <= radius * radius;
}

export function lineAABBIntersect(start, end, rect) {
  const dir = end.subtract(start);
  const invDir = new Vector2(
    dir.x === 0 ? Infinity : 1 / dir.x,
    dir.y === 0 ? Infinity : 1 / dir.y
  );

  const t1 = (rect.x - start.x) * invDir.x;
  const t2 = (rect.x + rect.width - start.x) * invDir.x;
  const t3 = (rect.y - start.y) * invDir.y;
  const t4 = (rect.y + rect.height - start.y) * invDir.y;

  const tMin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
  const tMax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

  if (tMax < 0 || tMin > tMax || tMin > 1) {
    return null;
  }

  const t = tMin < 0 ? tMax : tMin;
  if (t > 1) return null;

  const hitPoint = start.add(dir.multiply(t));

  let normal;
  const epsilon = 0.001;

  if (Math.abs(hitPoint.x - rect.x) < epsilon) {
    normal = new Vector2(-1, 0);
  } else if (Math.abs(hitPoint.x - (rect.x + rect.width)) < epsilon) {
    normal = new Vector2(1, 0);
  } else if (Math.abs(hitPoint.y - rect.y) < epsilon) {
    normal = new Vector2(0, -1);
  } else {
    normal = new Vector2(0, 1);
  }

  return {
    point: hitPoint,
    normal: normal,
    t: t,
  };
}

export function pointToLineDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function worldToTile(worldPos) {
  return new Vector2(
    Math.floor(worldPos.x / TILE_SIZE),
    Math.floor(worldPos.y / TILE_SIZE)
  );
}

export function tileToWorld(tilePos) {
  return new Vector2(tilePos.x * TILE_SIZE, tilePos.y * TILE_SIZE);
}

export function calculateOverlap(rect1, rect2) {
  const overlapX = Math.min(
    rect1.x + rect1.width - rect2.x,
    rect2.x + rect2.width - rect1.x
  );
  const overlapY = Math.min(
    rect1.y + rect1.height - rect2.y,
    rect2.y + rect2.height - rect1.y
  );

  return { x: overlapX, y: overlapY };
}

export function resolveCollisionPushback(entity, solidRect) {
  const entityBounds = entity.getBounds();
  const overlap = calculateOverlap(entityBounds, solidRect);

  if (overlap.x < overlap.y) {
    // Horizontal push
    if (entityBounds.x < solidRect.x) {
      entity.position.x = solidRect.x - entityBounds.width;
    } else {
      entity.position.x = solidRect.x + solidRect.width;
    }
  } else {
    // Vertical push
    if (entityBounds.y < solidRect.y) {
      entity.position.y = solidRect.y - entityBounds.height;
    } else {
      entity.position.y = solidRect.y + solidRect.height;
    }
  }
}

export class PlayerCollisionDetector {
  constructor(player) {
    this.player = player;
  }

  getCollisionTestPoints(position) {
    return [
      new Vector2(position.x, position.y), // Sol üst
      new Vector2(position.x + this.player.width, position.y), // Sağ üst
      new Vector2(position.x, position.y + this.player.height), // Sol alt
      new Vector2(
        position.x + this.player.width,
        position.y + this.player.height
      ), // Sağ alt
    ];
  }

  checkCollisionAt(position, collisionCallback) {
    if (!collisionCallback) return false;

    const testPoints = this.getCollisionTestPoints(position);
    return testPoints.some((point) => collisionCallback(point));
  }

  moveWithCollisionSliding(newPosition, collisionCallback) {
    if (!collisionCallback) {
      this.player.position.x = newPosition.x;
      this.player.position.y = newPosition.y;
      return;
    }

    const wouldCollide = this.checkCollisionAt(newPosition, collisionCallback);

    if (!wouldCollide) {
      this.player.position.x = newPosition.x;
      this.player.position.y = newPosition.y;
    } else {
      const horizontalPosition = new Vector2(
        newPosition.x,
        this.player.position.y
      );
      const horizontalCollision = this.checkCollisionAt(
        horizontalPosition,
        collisionCallback
      );

      if (!horizontalCollision) {
        this.player.position.x = newPosition.x;
      }

      const verticalPosition = new Vector2(
        this.player.position.x,
        newPosition.y
      );
      const verticalCollision = this.checkCollisionAt(
        verticalPosition,
        collisionCallback
      );

      if (!verticalCollision) {
        this.player.position.y = newPosition.y;
      }
    }
  }

  handleEntityCollisions(entities) {
    const playerBounds = this.player.getBounds();

    for (const entity of entities) {
      if (!entity.solid || entity === this.player) continue;

      if (entitiesIntersect(this.player, entity)) {
        const entityBounds = entity.getBounds();
        resolveCollisionPushback(this.player, entityBounds);
      }
    }
  }
}
export class LaserCollisionDetector {
  traceLaser(start, direction, entities, wallCollisionCallback = null) {
    const maxDistance = LaserConfig.physics.maxDistance;
    let determinedEndPoint = start.add(direction.multiply(maxDistance)); // Maksimum mesafeye göre başlangıç
    let wallHit = false;
    let debugInfo = {
      originalMaxDistance: maxDistance,
      wallCollisionChecked: false,
      entitiesChecked: entities ? entities.length : 0,
      solidEntitiesHit: [],
    };

    const wallHitPoint = this.checkWallCollision(
      start,
      direction,
      maxDistance, // Hala maksimum mesafeye kadar kontrol et
      wallCollisionCallback
    );

    debugInfo.wallCollisionChecked = true;

    if (wallHitPoint) {
      determinedEndPoint = wallHitPoint;
      wallHit = true;
      debugInfo.wallHitDistance = start.distance(wallHitPoint);

      if (LaserConfig.performance.debugMode) {
        console.log(
          `🔶 Duvara çarptı: Laser duvara ${Math.round(
            debugInfo.wallHitDistance
          )}px uzaklıkta çarptı`
        );
        console.log(
          `   Duvar Çarpışma Noktası: (${Math.round(
            wallHitPoint.x
          )}, ${Math.round(wallHitPoint.y)})`
        );
      }
    }

    const hitEntities = this.findEntityCollisions(
      start,
      determinedEndPoint,
      entities
    );

    const processedEntities = [];

    for (const hitEntity of hitEntities) {
      const { entity, hit } = hitEntity;
      const hitDistance = start.distance(hit.point);

      if (entity.constructor.name === "LaserEmitter") {
        continue;
      }

      if (
        LaserConfig.debug &&
        LaserConfig.debug.logEarlyCollisions &&
        hitDistance <= 50
      ) {
        console.log(
          `⚡ EARLY ENTITY HIT: ${entity.constructor.name} at ${Math.round(
            hitDistance
          )}px`
        );
        console.log(
          `   Entity position: (${Math.round(entity.position.x)}, ${Math.round(
            entity.position.y
          )})`
        );
        console.log(`   Entity solid: ${entity.solid}`);
        console.log(
          `   Hit point: (${Math.round(hit.point.x)}, ${Math.round(
            hit.point.y
          )})`
        );
        console.log(
          `   Entity bounds: ${Math.round(entity.position.x)},${Math.round(
            entity.position.y
          )} ${entity.width}x${entity.height}`
        );
      }

      if (entity.solid) {
        debugInfo.solidEntitiesHit.push({
          type: entity.constructor.name,
          position: entity.position,
          hitPoint: hit.point,
          distance: hitDistance,
        });

        if (
          (entity.constructor.name === "AutoDoor" ||
            entity.constructor.name === "Door") &&
          entity.isOpen
        ) {
          processedEntities.push(hitEntity);
          if (LaserConfig.performance.debugMode) {
            console.log(
              `🔷 DOOR PASS: Laser passed through open ${
                entity.constructor.name
              } at distance ${Math.round(hitDistance)}px`
            );
          }
          continue;
        }

        determinedEndPoint = hit.point;
        processedEntities.push(hitEntity);

        if (LaserConfig.performance.debugMode) {
          console.log(
            `🔴 ENTITY BLOCK: ${
              entity.constructor.name
            } blocked laser at distance ${Math.round(hitDistance)}px`
          );
          console.log(
            `   Entity position: (${Math.round(
              entity.position.x
            )}, ${Math.round(entity.position.y)})`
          );
          console.log(
            `   Hit point: (${Math.round(hit.point.x)}, ${Math.round(
              hit.point.y
            )})`
          );
        }

        break;
      }

      processedEntities.push(hitEntity);
      if (LaserConfig.performance.debugMode) {
        console.log(
          `🔵 NON-SOLID HIT: ${
            entity.constructor.name
          } hit but not blocking at distance ${Math.round(hitDistance)}px`
        );
      }
    }

    const finalDistance = start.distance(determinedEndPoint);
    debugInfo.finalDistance = finalDistance;
    debugInfo.distanceReduction = maxDistance - finalDistance;

    if (
      LaserConfig.performance.debugMode &&
      finalDistance < maxDistance * 0.9
    ) {
      console.log(
        `📊 LASER ÖZETİ: Son mesafe ${Math.round(
          finalDistance
        )}px (${Math.round(debugInfo.distanceReduction)}px daha kısa)`
      );
    }

    return {
      endPoint: determinedEndPoint,
      hitEntities: processedEntities, // All entities intersected by the final laser path (or that would have been if not blocked)
      wallHit: wallHit,
      debugInfo: debugInfo,
    };
  }

  checkWallCollision(start, direction, maxDistance, wallCollisionCallback) {
    if (!wallCollisionCallback) return null;

    const stepSize = 8;
    const steps = Math.floor(maxDistance / stepSize);
    const stepVector = direction.multiply(stepSize);

    for (let i = 1; i <= steps; i++) {
      const checkPoint = start.add(stepVector.multiply(i));

      // Enhanced debug logging for early collisions
      if (LaserConfig.debug && LaserConfig.debug.logEarlyCollisions && i <= 5) {
        console.log(
          `🔍 Wall check step ${i}: (${Math.round(checkPoint.x)}, ${Math.round(
            checkPoint.y
          )}) - distance: ${i * stepSize}px`
        );
      }

      if (wallCollisionCallback(checkPoint)) {
        if (
          LaserConfig.debug &&
          LaserConfig.debug.logEarlyCollisions &&
          i <= 10
        ) {
          console.log(
            `🧱 WALL COLLISION at step ${i}: (${Math.round(
              checkPoint.x
            )}, ${Math.round(checkPoint.y)}) - distance: ${i * stepSize}px`
          );
          console.log(
            `   Start point: (${Math.round(start.x)}, ${Math.round(start.y)})`
          );
          console.log(
            `   Direction: (${direction.x.toFixed(3)}, ${direction.y.toFixed(
              3
            )})`
          );
        }
        const safePoint = start.add(stepVector.multiply(i - 1));
        return this.snapToTileBoundary(safePoint, direction);
      }
    }

    return null;
  }

  snapToTileBoundary(point, direction) {
    let snappedX = point.x;
    let snappedY = point.y;

    if (direction.x > 0) {
      snappedX = Math.ceil(point.x / TILE_SIZE) * TILE_SIZE;
    } else if (direction.x < 0) {
      snappedX = Math.floor(point.x / TILE_SIZE) * TILE_SIZE;
    }

    if (direction.y > 0) {
      snappedY = Math.ceil(point.y / TILE_SIZE) * TILE_SIZE;
    } else if (direction.y < 0) {
      snappedY = Math.floor(point.y / TILE_SIZE) * TILE_SIZE;
    }

    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      return new Vector2(snappedX, point.y);
    } else {
      return new Vector2(point.x, snappedY);
    }
  }

  findEntityCollisions(start, end, entities) {
    const hitEntities = [];

    for (const entity of entities) {
      if (!entity.visible || !entity.active) continue;

      const bounds = entity.getBounds();
      const hit = lineAABBIntersect(start, end, bounds);

      if (hit) {
        hitEntities.push({
          entity: entity,
          hit: hit,
          distance: hit.t,
        });
      }
    }

    hitEntities.sort((a, b) => a.distance - b.distance);
    return hitEntities;
  }

  checkPlayerLaserCollision(player, beams) {
    const playerBounds = player.getBounds();

    for (const beam of beams) {
      const hit = lineAABBIntersect(beam.start, beam.end, playerBounds);
      if (hit) {
        return true;
      }

      const playerCenter = player.getCenter();
      const distance = pointToLineDistance(playerCenter, beam.start, beam.end);
      if (distance < player.width / 4) {
        return true;
      }
    }

    return false;
  }

  debugNearbyEntities(laser, entities, radius = 32) {
    if (!LaserConfig.debug || !LaserConfig.debug.logEarlyCollisions) return;

    const laserCenter = laser.getCenter();
    const nearbyEntities = [];

    for (const entity of entities) {
      if (entity === laser) continue;

      const entityCenter = entity.getCenter();
      const distance = laserCenter.distance(entityCenter);

      if (distance <= radius) {
        nearbyEntities.push({
          entity: entity,
          distance: distance,
          solid: entity.solid,
        });
      }
    }

    if (nearbyEntities.length > 0) {
      console.group(
        `🔍 LASER ${laser.id} NEARBY ENTITIES (within ${radius}px):`
      );
      console.log(
        `Laser position: (${Math.round(laserCenter.x)}, ${Math.round(
          laserCenter.y
        )})`
      );
      console.log(`Laser direction: ${laser.direction}`);

      nearbyEntities.forEach((nearby, index) => {
        const entity = nearby.entity;
        console.log(
          `${index + 1}. ${entity.constructor.name} - ${Math.round(
            nearby.distance
          )}px away ${nearby.solid ? "(SOLID)" : ""}`
        );
        console.log(
          `   Position: (${Math.round(entity.position.x)}, ${Math.round(
            entity.position.y
          )})`
        );
        console.log(`   Size: ${entity.width}x${entity.height}`);
      });
      console.groupEnd();
    }
  }
}

/**
 * Ana çarpışma yöneticisi
 */
export class CollisionManager {
  constructor() {
    this.playerCollisionDetector = null;
    this.laserCollisionDetector = new LaserCollisionDetector();
  }

  /**
   * Oyuncu referansıyla başlat
   * @param {Player} player - Oyuncu varlığı
   */
  setPlayer(player) {
    this.playerCollisionDetector = new PlayerCollisionDetector(player);
  }

  /**
   * Lazer çarpışmalarını kontrol et
   * @param {Vector2} start - Lazer başlangıç
   * @param {Vector2} direction - Lazer yönü
   * @param {Array<Entity>} entities - Çarpışma testi için varlıklar
   * @param {Function} wallCollisionCallback - Duvar çarpışma çağrısı
   * @returns {Object} Lazer çarpışma sonucu
   */
  traceLaser(start, direction, entities, wallCollisionCallback) {
    return this.laserCollisionDetector.traceLaser(
      start,
      direction,
      entities,
      wallCollisionCallback
    );
  }

  /**
   * Oyuncu vs lazer çarpışmasını kontrol et
   * @param {Player} player - Oyuncu varlığı
   * @param {Array} beams - Lazer çizgileri
   * @returns {boolean} Oyuncu çarpışması
   */
  checkPlayerLaserCollision(player, beams) {
    return this.laserCollisionDetector.checkPlayerLaserCollision(player, beams);
  }
}
