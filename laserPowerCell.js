export class LaserPowerCellManager {
  constructor() {
    this.powerCells = [];
  }

  registerPowerCell(cell) {
    this.powerCells.push(cell);
  }

  processLaserHitOnPowerCell(entity) {
    if (
      entity &&
      entity.constructor.name === "PowerCell" &&
      typeof entity.setPowered === "function"
    ) {
      entity.setPowered(true);
      entity.laserPowered = true;
      return true;
    }
    return false;
  }

  update(entities, activeLaserBeams) {}
}
