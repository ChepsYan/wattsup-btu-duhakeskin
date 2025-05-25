export const POWER_EVENTS = {
  LASER_ACTIVATED: "laser_activated",
  LASER_DEACTIVATED: "laser_deactivated",
  LASER_ROTATED: "laser_rotated",
  LASER_HIT_CELL: "laser_hit_cell",
  LASER_LOST_CELL: "laser_lost_cell",
  CELL_POWERED: "cell_powered",
  CELL_UNPOWERED: "cell_unpowered",
};

class LaserPowerState {
  constructor(laserId, powerCellId) {
    this.laserId = laserId;
    this.powerCellId = powerCellId;
    this.isConnected = false;
    this.lastConnectedTime = 0;
    this.totalPowerTime = 0;
    this.connectionCount = 0;
  }

  connect() {
    if (!this.isConnected) {
      this.isConnected = true;
      this.lastConnectedTime = Date.now();
      this.connectionCount++;
    }
  }

  disconnect() {
    if (this.isConnected) {
      this.isConnected = false;
      this.totalPowerTime += Date.now() - this.lastConnectedTime;
    }
  }

  updateTotalTime() {
    if (this.isConnected) {
      this.totalPowerTime += Date.now() - this.lastConnectedTime;
      this.lastConnectedTime = Date.now();
    }
  }
}

export class PowerManagementSystem {
  constructor() {
    this.powerStates = new Map();
    this.laserStates = new Map();
    this.cellStates = new Map();
    this.eventListeners = new Map();
    this.lastUpdate = 0;
    this.debugMode = false;

    this.stats = {
      totalCellPowerings: 0,
      totalPowerTime: 0,
    };
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  removeEventListener(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emitEvent(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.warn("Error in power management event listener:", error);
        }
      });
    }

    if (this.debugMode) {
      console.log(`[PowerManagement] Event: ${event}`, data);
    }
  }

  initialize(entities) {
    this.clearStates();

    const lasers = entities.filter(
      (e) => e.constructor.name === "LaserEmitter"
    );
    const powerCells = entities.filter(
      (e) => e.constructor.name === "PowerCell"
    );

    lasers.forEach((laser) => {
      this.laserStates.set(laser.id, {
        id: laser.id,
        isActive: laser.isActive,
        direction: laser.direction,
        position: laser.getCenter(),
        lastRotation: 0,
        activationCount: 0,
      });
    });

    powerCells.forEach((cell) => {
      this.cellStates.set(cell.id, {
        id: cell.id,
        isPowered: cell.isPowered,
        laserPowered: cell.laserPowered,
        position: cell.getCenter(),
        poweringLasers: [],
        lastPowerChange: 0,
      });
    });

    if (this.debugMode) {
      console.log(
        `[PowerManagement] Initialized with ${lasers.length} lasers and ${powerCells.length} power cells`
      );
    }
  }

  update(entities, laserBeams = []) {
    const now = Date.now();
    this.lastUpdate = now;

    this.updateLaserStates(entities);

    this.updatePowerCellStates(entities, laserBeams);

    this.updateConnectionStates();

    this.updateStatistics();
  }

  updateLaserStates(entities) {
    const lasers = entities.filter(
      (e) => e.constructor.name === "LaserEmitter"
    );

    lasers.forEach((laser) => {
      const currentState = this.laserStates.get(laser.id);
      if (!currentState) return;

      const wasActive = currentState.isActive;
      const oldDirection = currentState.direction;

      if (laser.isActive !== wasActive) {
        currentState.isActive = laser.isActive;

        if (laser.isActive) {
          currentState.activationCount++;
          this.emitEvent(POWER_EVENTS.LASER_ACTIVATED, {
            laserId: laser.id,
            position: laser.getCenter(),
            direction: laser.direction,
          });
        } else {
          this.emitEvent(POWER_EVENTS.LASER_DEACTIVATED, {
            laserId: laser.id,
            position: laser.getCenter(),
          });
        }
      }

      if (laser.direction !== oldDirection) {
        currentState.direction = laser.direction;
        currentState.lastRotation = Date.now();

        this.emitEvent(POWER_EVENTS.LASER_ROTATED, {
          laserId: laser.id,
          oldDirection: oldDirection,
          newDirection: laser.direction,
          position: laser.getCenter(),
        });
      }

      // Update position
      currentState.position = laser.getCenter();
    });
  }

  updatePowerCellStates(entities, laserBeams) {
    const powerCells = entities.filter(
      (e) => e.constructor.name === "PowerCell"
    );
    const lasers = entities.filter(
      (e) => e.constructor.name === "LaserEmitter"
    );

    powerCells.forEach((cell) => {
      const cellState = this.cellStates.get(cell.id);
      if (cellState) {
        cellState.poweringLasers = [];
      }
    });

    powerCells.forEach((cell) => {
      const cellState = this.cellStates.get(cell.id);
      if (!cellState) return;

      const cellCenter = cell.getCenter();
      const cellRadius = Math.max(cell.width, cell.height) / 2;

      laserBeams.forEach((beam) => {
        if (!beam.start || !beam.end) return;

        const hitLaser = this.findLaserForBeam(beam, lasers);
        if (!hitLaser) return;

        const distanceToBeam = this.pointToLineDistance(
          cellCenter,
          beam.start,
          beam.end
        );

        if (distanceToBeam <= cellRadius + 5) {
          cellState.poweringLasers.push(hitLaser.id);

          const connectionKey = `${hitLaser.id}_${cell.id}`;
          if (!this.powerStates.has(connectionKey)) {
            this.powerStates.set(
              connectionKey,
              new LaserPowerState(hitLaser.id, cell.id)
            );
          }

          const powerState = this.powerStates.get(connectionKey);
          if (!powerState.isConnected) {
            powerState.connect();
            this.emitEvent(POWER_EVENTS.LASER_HIT_CELL, {
              laserId: hitLaser.id,
              cellId: cell.id,
              laserPosition: hitLaser.getCenter(),
              cellPosition: cellCenter,
            });
          }
        }
      });

      const wasPowered = cellState.isPowered;
      const wasLaserPowered = cellState.laserPowered;
      const isPowered = cellState.poweringLasers.length > 0;

      if (isPowered !== wasPowered) {
        cellState.isPowered = isPowered;
        cellState.laserPowered = isPowered;
        cellState.lastPowerChange = Date.now();

        cell.setPowered(isPowered);
        cell.laserPowered = isPowered;

        if (isPowered) {
          this.stats.totalCellPowerings++;
          this.emitEvent(POWER_EVENTS.CELL_POWERED, {
            cellId: cell.id,
            position: cellCenter,
            poweringLasers: cellState.poweringLasers,
          });
        } else {
          this.emitEvent(POWER_EVENTS.CELL_UNPOWERED, {
            cellId: cell.id,
            position: cellCenter,
          });
        }
      }
    });

    this.powerStates.forEach((powerState, connectionKey) => {
      if (powerState.isConnected) {
        const [laserId, cellId] = connectionKey.split("_");
        const cellState = this.cellStates.get(cellId);

        if (!cellState || !cellState.poweringLasers.includes(laserId)) {
          powerState.disconnect();
          this.emitEvent(POWER_EVENTS.LASER_LOST_CELL, {
            laserId: laserId,
            cellId: cellId,
          });
        }
      }
    });
  }

  findLaserForBeam(beam, lasers) {
    let closestLaser = null;
    let closestDistance = Infinity;

    lasers.forEach((laser) => {
      if (!laser.isActive) return;

      const laserStart = laser.getLaserStart();
      if (!laserStart) return;

      const distance = laserStart.distance(beam.start);
      if (distance < closestDistance && distance < 50) {
        closestDistance = distance;
        closestLaser = laser;
      }
    });

    return closestLaser;
  }

  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return point.distance(lineStart);
    }

    let param = dot / lenSq;

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

  updateConnectionStates() {
    this.powerStates.forEach((powerState) => {
      powerState.updateTotalTime();
    });
  }

  updateStatistics() {
    this.stats.totalPowerTime = 0;
    this.powerStates.forEach((powerState) => {
      this.stats.totalPowerTime += powerState.totalPowerTime;
    });
  }

  onLaserRotated(laser) {
    if (!laser || !laser.id) return;

    const laserState = this.laserStates.get(laser.id);
    if (laserState) {
      laserState.direction = laser.direction;
      laserState.lastRotation = Date.now();
    }

    this.powerStates.forEach((powerState, connectionKey) => {
      if (connectionKey.startsWith(laser.id + "_")) {
        if (powerState.isConnected) {
          powerState.disconnect();
          this.emitEvent(POWER_EVENTS.LASER_LOST_CELL, {
            laserId: laser.id,
            cellId: powerState.powerCellId,
          });
        }
      }
    });

    this.emitEvent(POWER_EVENTS.LASER_ROTATED, {
      laserId: laser.id,
      newDirection: laser.direction,
      position: laser.getCenter(),
    });
  }

  onLaserToggled(laser) {
    if (!laser || !laser.id) return;

    const laserState = this.laserStates.get(laser.id);
    if (laserState) {
      if (laserState.isActive !== laser.isActive) {
        laserState.isActive = laser.isActive;
        if (laser.isActive) {
          laserState.activationCount++;
        }
      } else {
        return;
      }
    }

    if (laser.isActive) {
      this.emitEvent(POWER_EVENTS.LASER_ACTIVATED, {
        laserId: laser.id,
        position: laser.getCenter(),
        direction: laser.direction,
      });
    } else {
      this.powerStates.forEach((powerState, connectionKey) => {
        if (connectionKey.startsWith(laser.id + "_")) {
          if (powerState.isConnected) {
            powerState.disconnect();
            this.emitEvent(POWER_EVENTS.LASER_LOST_CELL, {
              laserId: laser.id,
              cellId: powerState.powerCellId,
            });
          }
        }
      });

      this.emitEvent(POWER_EVENTS.LASER_DEACTIVATED, {
        laserId: laser.id,
        position: laser.getCenter(),
      });
    }
  }

  clearStates() {
    this.powerStates.clear();
    this.laserStates.clear();
    this.cellStates.clear();
  }

  getStatistics() {
    const connectedCount = Array.from(this.powerStates.values()).filter(
      (state) => state.isConnected
    ).length;

    const poweredCells = Array.from(this.cellStates.values()).filter(
      (state) => state.isPowered
    ).length;

    return {
      ...this.stats,
      activeLasers: Array.from(this.laserStates.values()).filter(
        (state) => state.isActive
      ).length,
      totalLasers: this.laserStates.size,
      poweredCells: poweredCells,
      totalCells: this.cellStates.size,
      activeConnections: connectedCount,
      totalConnections: this.powerStates.size,
    };
  }

  getDebugInfo() {
    return {
      powerStates: Array.from(this.powerStates.entries()),
      laserStates: Array.from(this.laserStates.entries()),
      cellStates: Array.from(this.cellStates.entries()),
      statistics: this.getStatistics(),
    };
  }

  resetStatistics() {
    this.stats = {
      totalCellPowerings: 0,
      totalPowerTime: 0,
    };
  }

  rotateLaserEmitter(laser) {
    this.onLaserRotated(laser);
  }

  toggleLaserEmitter(laser) {
    this.onLaserToggled(laser);
  }

  setLaserEmitterActive(laser) {
    this.onLaserToggled(laser);
  }
}

export const powerManager = new PowerManagementSystem();

export function setupPowerManagement(game, debugMode = false) {
  powerManager.setDebugMode(debugMode);

  return powerManager;
}
