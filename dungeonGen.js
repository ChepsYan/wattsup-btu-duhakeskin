/**
 * Dungeon Generator - Rastgele bölüm üretimi
 * Tile'ları WFC benzeri algoritma ile birleştirme
 */

import { SeededRandom, Vector2, deepClone } from "./utils.js";
import { DUNGEON, TILE_SIZE } from "./constants.js";

// ===== TILE LOADER =====

/**
 * Tile dosyalarını yükleyen sınıf
 */
export class TileLoader {
  constructor() {
    this.tiles = new Map();
    this.loadPromise = null;
  }

  /**
   * Tüm tile dosyalarını yükle
   * @returns {Promise} Yükleme promise'i
   */
  async loadTiles() {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoadTiles();
    return this.loadPromise;
  }

  /**
   * Tile dosyalarını gerçekten yükler
   * @returns {Promise} Yükleme promise'i
   */
  async doLoadTiles() {
    const tileFiles = [
      "straight.json",
      "corner.json",
      "start.json",
      "exit.json",
    ];

    const loadPromises = tileFiles.map(async (filename) => {
      try {
        const response = await fetch(`assets/tiles/${filename}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        const tileData = await response.json();

        // Validate and fix the tile before storing it
        const validatedTile = this.validateAndFixTile(tileData);
        this.tiles.set(validatedTile.id, validatedTile);
        return validatedTile;
      } catch (error) {
        console.warn(`Could not load tile ${filename}:`, error);
        return null;
      }
    });

    const results = await Promise.all(loadPromises);
    const loaded = results.filter((tile) => tile !== null);

    // Eğer hiç tile yüklenmediyse fallback tiles ekle
    if (loaded.length === 0) {
      console.warn("No tiles loaded, creating fallback tiles");
      this.createFallbackTiles();
    }

    return loaded;
  }

  /**
   * Fallback tile'ları oluştur
   */
  createFallbackTiles() {
    const fallbackTiles = [
      {
        id: "start",
        name: "Fallback Start",
        size: [4, 4],
        start: true,
        exits: { E: [3, 2] },
        prefabs: [
          {
            type: "Player",
            pos: [1, 2],
            id: "player_start",
          },
        ],
      },
      {
        id: "exit",
        name: "Fallback Exit",
        size: [4, 4],
        exit: true,
        exits: { W: [0, 2] },
        prefabs: [
          {
            type: "Door",
            pos: [2, 2],
            id: "exit_door",
            exit: true,
          },
        ],
      },
    ];

    for (const tile of fallbackTiles) {
      this.tiles.set(tile.id, tile);
    }
  }

  /**
   * Tile ID'sine göre tile al
   * @param {string} id - Tile ID'si
   * @returns {Object|null} Tile datası
   */
  getTile(id) {
    return this.tiles.get(id) || null;
  }

  /**
   * Tüm tile'ları al
   * @returns {Array} Tile listesi
   */
  getAllTiles() {
    return Array.from(this.tiles.values());
  }

  /**
   * Belirli kriterlere uyan tile'ları filtrele
   * @param {Function} predicate - Filtre fonksiyonu
   * @returns {Array} Filtrelenmiş tile'lar
   */
  filterTiles(predicate) {
    return this.getAllTiles().filter(predicate);
  }

  /**
   * Validate and fix tile before using it
   * @param {Object} tile - Tile to validate
   * @returns {Object} Validated and potentially fixed tile
   */
  validateAndFixTile(tile) {
    const fixedTile = JSON.parse(JSON.stringify(tile)); // Deep clone

    // Fix laser/power cell balance
    this.balanceLaserAndPowerCells(fixedTile);

    // Remove entities that spawn in walls
    this.removeEntitiesInWalls(fixedTile);

    return fixedTile;
  }

  /**
   * Ensure laser emitters and power cells have the same count and are aligned
   * @param {Object} tile - Tile to fix
   */
  balanceLaserAndPowerCells(tile) {
    if (!tile.prefabs) return;

    const lasers = tile.prefabs.filter((p) => p.type === "LaserEmitter");
    const powerCells = tile.prefabs.filter((p) => p.type === "PowerCell");

    // If counts don't match, balance them
    if (lasers.length !== powerCells.length) {
      if (lasers.length > powerCells.length) {
        // Add power cells to match laser count
        this.addPowerCellsToMatch(tile, lasers, powerCells);
      } else {
        // Add lasers to match power cell count
        this.addLasersToMatch(tile, lasers, powerCells);
      }
    }

    // Ensure alignment (same axis)
    this.alignLasersAndPowerCells(tile);
  }

  /**
   * Add power cells to match laser count
   * @param {Object} tile - Tile to modify
   * @param {Array} lasers - Existing lasers
   * @param {Array} powerCells - Existing power cells
   */
  addPowerCellsToMatch(tile, lasers, powerCells) {
    const needed = lasers.length - powerCells.length;
    const safePositions = this.findSafePositions(tile, needed);

    for (let i = 0; i < needed && i < safePositions.length; i++) {
      const pos = safePositions[i];
      const newPowerCell = {
        type: "PowerCell",
        pos: [pos.x, pos.y],
        id: `auto_cell_${tile.id}_${i + powerCells.length + 1}`,
      };
      tile.prefabs.push(newPowerCell);
      console.log(`Added PowerCell at (${pos.x}, ${pos.y}) to tile ${tile.id}`);
    }
  }

  /**
   * Add lasers to match power cell count
   * @param {Object} tile - Tile to modify
   * @param {Array} lasers - Existing lasers
   * @param {Array} powerCells - Existing power cells
   */
  addLasersToMatch(tile, lasers, powerCells) {
    const needed = powerCells.length - lasers.length;
    const safePositions = this.findSafePositions(tile, needed);

    for (let i = 0; i < needed && i < safePositions.length; i++) {
      const pos = safePositions[i];
      const direction = this.getBestLaserDirection(tile, pos);
      const newLaser = {
        type: "LaserEmitter",
        pos: [pos.x, pos.y],
        dir: direction,
        id: `auto_emitter_${tile.id}_${i + lasers.length + 1}`,
      };
      tile.prefabs.push(newLaser);
      console.log(
        `Added LaserEmitter at (${pos.x}, ${pos.y}) facing ${direction} to tile ${tile.id}`
      );
    }
  }

  /**
   * Find safe positions for placing entities (not in walls)
   * @param {Object} tile - Tile to check
   * @param {number} count - Number of positions needed
   * @returns {Array} Safe positions
   */
  findSafePositions(tile, count) {
    const safePositions = [];
    const collision = tile.collision || [];

    for (let y = 1; y < tile.size[1] - 1; y++) {
      // Avoid edges
      for (let x = 1; x < tile.size[0] - 1; x++) {
        // Avoid edges
        // Check if position is safe (not a wall)
        if (y < collision.length && x < collision[y].length) {
          if (collision[y][x] === ".") {
            // Also check if position is not occupied by existing prefabs
            const occupied = tile.prefabs.some(
              (p) => p.pos[0] === x && p.pos[1] === y
            );
            if (!occupied) {
              safePositions.push({ x, y });
            }
          }
        }
      }
    }

    return safePositions.slice(0, count); // Return only what we need
  }

  /**
   * Get best direction for laser based on tile layout
   * @param {Object} tile - Tile to check
   * @param {Object} pos - Position for laser
   * @returns {string} Best direction (N, E, S, W)
   */
  getBestLaserDirection(tile, pos) {
    // Simple heuristic: point towards center or towards exits
    const centerX = tile.size[0] / 2;
    const centerY = tile.size[1] / 2;

    const dx = centerX - pos.x;
    const dy = centerY - pos.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "E" : "W";
    } else {
      return dy > 0 ? "S" : "N";
    }
  }

  /**
   * Align lasers and power cells on the same axis when possible
   * @param {Object} tile - Tile to modify
   */
  alignLasersAndPowerCells(tile) {
    if (!tile.prefabs) return;

    const lasers = tile.prefabs.filter((p) => p.type === "LaserEmitter");
    const powerCells = tile.prefabs.filter((p) => p.type === "PowerCell");

    if (lasers.length === 0 || powerCells.length === 0) return;

    // Try to align them on the same row or column
    for (let i = 0; i < Math.min(lasers.length, powerCells.length); i++) {
      const laser = lasers[i];
      const powerCell = powerCells[i];

      // If laser is horizontal (E/W), try to align on same row
      if (laser.dir === "E" || laser.dir === "W") {
        const targetY = laser.pos[1];
        const safePos = this.findSafePositionNear(
          tile,
          powerCell.pos[0],
          targetY
        );
        if (safePos) {
          powerCell.pos[1] = safePos.y;
          console.log(`Aligned PowerCell ${powerCell.id} to row ${targetY}`);
        }
      }
      // If laser is vertical (N/S), try to align on same column
      else if (laser.dir === "N" || laser.dir === "S") {
        const targetX = laser.pos[0];
        const safePos = this.findSafePositionNear(
          tile,
          targetX,
          powerCell.pos[1]
        );
        if (safePos) {
          powerCell.pos[0] = safePos.x;
          console.log(`Aligned PowerCell ${powerCell.id} to column ${targetX}`);
        }
      }
    }
  }

  /**
   * Find a safe position near the target coordinates
   * @param {Object} tile - Tile to check
   * @param {number} targetX - Target X coordinate
   * @param {number} targetY - Target Y coordinate
   * @returns {Object|null} Safe position or null
   */
  findSafePositionNear(tile, targetX, targetY) {
    const collision = tile.collision || [];

    // Check if target position is safe
    if (targetY < collision.length && targetX < collision[targetY].length) {
      if (collision[targetY][targetX] === ".") {
        // Check if not occupied
        const occupied = tile.prefabs.some(
          (p) => p.pos[0] === targetX && p.pos[1] === targetY
        );
        if (!occupied) {
          return { x: targetX, y: targetY };
        }
      }
    }

    return null; // Could expand to search nearby positions
  }

  /**
   * Remove entities that would spawn in wall tiles
   * @param {Object} tile - Tile to fix
   */
  removeEntitiesInWalls(tile) {
    if (!tile.prefabs || !tile.collision) return;

    const originalCount = tile.prefabs.length;

    tile.prefabs = tile.prefabs.filter((prefab) => {
      const x = prefab.pos[0];
      const y = prefab.pos[1];

      // Check if position is within bounds
      if (y >= tile.collision.length || x >= tile.collision[y].length) {
        console.warn(
          `Entity ${prefab.id} at (${x}, ${y}) is outside tile bounds, removing`
        );
        return false;
      }

      // Check if position is a wall
      if (tile.collision[y][x] === "#") {
        console.warn(
          `Entity ${prefab.id} at (${x}, ${y}) is in a wall tile, removing`
        );
        return false;
      }

      return true;
    });

    if (tile.prefabs.length !== originalCount) {
      console.log(
        `Removed ${
          originalCount - tile.prefabs.length
        } entities from walls in tile ${tile.id}`
      );
    }
  }
}

// ===== DUNGEON GENERATOR =====

/**
 * WFC benzeri algoritma ile dungeon üretici - Enhanced with high randomization
 */
export class DungeonGenerator {
  constructor(tileLoader) {
    this.tileLoader = tileLoader;
    this.rng = new SeededRandom();
    this.grid = null;
    this.gridSize = 0; // Will be randomized
    this.levelShape = "rectangular"; // Will be randomized
    this.startPosition = null; // Will be randomized
    this.generationStyle = "balanced"; // Will be randomized
  }

  /**
   * Seed ayarla
   * @param {number} seed - RNG seed
   */
  setSeed(seed) {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Rastgele dungeon üret - Completely randomized approach
   * @param {number} seed - Opsiyonel seed
   * @returns {Object} Üretilen dungeon datası
   */
  generateDungeon(seed = null) {
    if (seed !== null) {
      this.setSeed(seed);
    }

    // Randomize generation parameters based on seed
    this.randomizeGenerationParameters();

    // Initialize random grid shape
    this.initializeRandomGrid();

    // Place start tile randomly
    this.placeRandomStartTile();

    // Fill grid with much more randomness
    this.fillGridRandomly();

    // Place exit tile with variety
    this.placeRandomExitTile();

    // Apply random post-processing
    this.applyRandomPostProcessing();

    // Build final dungeon
    return this.buildDungeon();
  }

  /**
   * Randomize generation parameters for variety
   */
  randomizeGenerationParameters() {
    // Random grid size
    this.gridSize = this.rng.randInt(
      DUNGEON.MIN_GRID_SIZE,
      DUNGEON.MAX_GRID_SIZE
    );

    // Random level shape
    const shapes = ["rectangular", "cross", "L_shape", "random_organic"];
    this.levelShape = this.rng.choice(shapes);

    // Random generation style
    const styles = ["balanced", "chaotic", "sparse", "dense", "maze_like"];
    this.generationStyle = this.rng.choice(styles);

    console.log(
      `Generation: ${this.gridSize}x${this.gridSize} ${this.levelShape} ${this.generationStyle}`
    );
  }

  /**
   * Initialize grid with random shape
   */
  initializeRandomGrid() {
    this.grid = Array(this.gridSize)
      .fill(null)
      .map(() => Array(this.gridSize).fill(null));

    // Apply shape constraints
    this.applyShapeConstraints();
  }

  /**
   * Apply different shape constraints to the grid
   */
  applyShapeConstraints() {
    const centerX = Math.floor(this.gridSize / 2);
    const centerY = Math.floor(this.gridSize / 2);

    switch (this.levelShape) {
      case "cross":
        // Create cross shape by blocking corners
        for (let y = 0; y < this.gridSize; y++) {
          for (let x = 0; x < this.gridSize; x++) {
            const distFromCenterX = Math.abs(x - centerX);
            const distFromCenterY = Math.abs(y - centerY);
            if (distFromCenterX > 1 && distFromCenterY > 1) {
              this.grid[y][x] = "BLOCKED"; // Mark as unusable
            }
          }
        }
        break;

      case "L_shape":
        // Create L shape by blocking one corner
        const corner = this.rng.choice(["NE", "NW", "SE", "SW"]);
        const blockSize = Math.floor(this.gridSize / 3);
        for (let y = 0; y < this.gridSize; y++) {
          for (let x = 0; x < this.gridSize; x++) {
            let shouldBlock = false;
            switch (corner) {
              case "NE":
                shouldBlock = x >= this.gridSize - blockSize && y < blockSize;
                break;
              case "NW":
                shouldBlock = x < blockSize && y < blockSize;
                break;
              case "SE":
                shouldBlock =
                  x >= this.gridSize - blockSize &&
                  y >= this.gridSize - blockSize;
                break;
              case "SW":
                shouldBlock = x < blockSize && y >= this.gridSize - blockSize;
                break;
            }
            if (shouldBlock) {
              this.grid[y][x] = "BLOCKED";
            }
          }
        }
        break;

      case "random_organic":
        // Random organic shape with cellular automata
        for (let y = 0; y < this.gridSize; y++) {
          for (let x = 0; x < this.gridSize; x++) {
            // Higher chance to block cells near edges
            const edgeDistance = Math.min(
              x,
              y,
              this.gridSize - 1 - x,
              this.gridSize - 1 - y
            );
            const blockChance =
              edgeDistance === 0 ? 0.7 : edgeDistance === 1 ? 0.3 : 0.1;
            if (this.rng.random() < blockChance) {
              this.grid[y][x] = "BLOCKED";
            }
          }
        }
        break;

      // "rectangular" - no constraints, keep as is
    }
  }

  /**
   * Place start tile randomly
   */
  placeRandomStartTile() {
    const startTiles = this.tileLoader.filterTiles(
      (tile) => tile.start === true
    );
    if (startTiles.length === 0) {
      console.warn("No start tile found, using random tile");
      return;
    }

    // Find all available positions (not blocked)
    const availablePositions = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.grid[y][x] === null) {
          availablePositions.push(new Vector2(x, y));
        }
      }
    }

    if (availablePositions.length === 0) {
      console.warn("No available positions for start tile");
      return;
    }

    // Randomly choose start position based on generation style
    let startPos;
    switch (this.generationStyle) {
      case "balanced":
        // Prefer edge positions
        const edgePositions = availablePositions.filter(
          (pos) =>
            pos.x === 0 ||
            pos.x === this.gridSize - 1 ||
            pos.y === 0 ||
            pos.y === this.gridSize - 1
        );
        startPos =
          edgePositions.length > 0
            ? this.rng.choice(edgePositions)
            : this.rng.choice(availablePositions);
        break;

      case "chaotic":
      case "dense":
        // Completely random position
        startPos = this.rng.choice(availablePositions);
        break;

      case "sparse":
        // Prefer corner positions
        const corners = availablePositions.filter(
          (pos) =>
            (pos.x === 0 || pos.x === this.gridSize - 1) &&
            (pos.y === 0 || pos.y === this.gridSize - 1)
        );
        startPos =
          corners.length > 0
            ? this.rng.choice(corners)
            : this.rng.choice(availablePositions);
        break;

      default:
        startPos = this.rng.choice(availablePositions);
    }

    this.startPosition = startPos;
    const startTile = this.rng.choice(startTiles);
    const rotation =
      this.rng.random() < DUNGEON.ROTATION_CHANCE ? this.rng.randInt(0, 4) : 0;

    this.grid[startPos.y][startPos.x] = {
      tile: startTile,
      position: startPos,
      rotation: rotation,
    };

    console.log(
      `Start tile placed at (${startPos.x}, ${startPos.y}) with rotation ${rotation}`
    );
  }

  /**
   * Fill grid with much more randomness
   */
  fillGridRandomly() {
    const maxAttempts = DUNGEON.MAX_PLACEMENT_ATTEMPTS;
    let attempts = 0;

    while (!this.isGridComplete() && attempts < maxAttempts) {
      const nextPos = this.findNextPositionRandomly();
      if (!nextPos) break;

      // Random chance to leave empty spaces based on generation style
      let emptyChance = DUNGEON.EMPTY_SPACE_CHANCE;
      switch (this.generationStyle) {
        case "sparse":
          emptyChance = 0.3;
          break;
        case "dense":
          emptyChance = 0.05;
          break;
        case "chaotic":
          emptyChance = 0.2;
          break;
        case "maze_like":
          emptyChance = 0.1;
          break;
      }

      if (this.rng.random() < emptyChance) {
        this.grid[nextPos.y][nextPos.x] = "EMPTY"; // Mark as intentionally empty
        attempts = 0;
        continue;
      }

      const validTiles = this.findValidTilesRandomly(nextPos);
      if (validTiles.length === 0) {
        attempts++;
        continue;
      }

      // Weight tile selection based on generation style
      const selectedTile = this.selectTileByStyle(validTiles);
      this.placeTile(selectedTile.tile, nextPos, selectedTile.rotation);
      attempts = 0; // Reset attempts on success
    }

    console.log(`Grid filling completed with ${attempts} final attempts`);
  }

  /**
   * Check if grid generation is complete based on style
   * @returns {boolean} Is grid complete?
   */
  isGridComplete() {
    const availableCells = this.getAvailableCells();

    // Different completion criteria based on style
    switch (this.generationStyle) {
      case "sparse":
        return availableCells.length <= this.gridSize; // Leave many empty
      case "dense":
        return availableCells.length === 0; // Fill everything
      case "balanced":
        return availableCells.length <= Math.floor(this.gridSize * 0.5); // Half full
      default:
        return availableCells.length <= Math.floor(this.gridSize * 0.3); // 70% full
    }
  }

  /**
   * Get available cells for placement
   * @returns {Array} Available cell positions
   */
  getAvailableCells() {
    const available = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.grid[y][x] === null) {
          available.push(new Vector2(x, y));
        }
      }
    }
    return available;
  }

  /**
   * Find next position to place tile with randomization
   * @returns {Vector2|null} Next position
   */
  findNextPositionRandomly() {
    const availableCells = this.getAvailableCells();
    if (availableCells.length === 0) return null;

    // Different strategies based on generation style
    switch (this.generationStyle) {
      case "chaotic":
        // Completely random
        return this.rng.choice(availableCells);

      case "balanced":
      case "maze_like":
        // Prefer positions with neighbors (connected growth)
        const connectedCells = availableCells.filter((pos) => {
          const neighbors = this.getNeighbors(pos);
          return neighbors.some((n) => n.tile !== null);
        });
        if (connectedCells.length > 0) {
          return this.rng.choice(connectedCells);
        }
        return this.rng.choice(availableCells);

      case "sparse":
        // Prefer isolated positions
        const isolatedCells = availableCells.filter((pos) => {
          const neighbors = this.getNeighbors(pos);
          const connectedNeighbors = neighbors.filter(
            (n) => n.tile !== null
          ).length;
          return connectedNeighbors <= 1; // At most one neighbor
        });
        if (isolatedCells.length > 0) {
          return this.rng.choice(isolatedCells);
        }
        return this.rng.choice(availableCells);

      default:
        // Mix of connected and random
        const candidates = availableCells.slice();
        const connectedCandidates = candidates.filter((pos) => {
          const neighbors = this.getNeighbors(pos);
          return neighbors.some((n) => n.tile !== null);
        });

        const useConnected = this.rng.random() < 0.7; // 70% chance for connected
        return useConnected && connectedCandidates.length > 0
          ? this.rng.choice(connectedCandidates)
          : this.rng.choice(candidates);
    }
  }

  /**
   * Select tile based on generation style
   * @param {Array} validTiles - Valid tile options
   * @returns {Object} Selected tile with rotation
   */
  selectTileByStyle(validTiles) {
    if (validTiles.length === 0) return null;

    switch (this.generationStyle) {
      case "chaotic":
        // Prefer higher rotation values for chaos
        const chaoticTiles = validTiles.filter((t) => t.rotation >= 2);
        return chaoticTiles.length > 0
          ? this.rng.choice(chaoticTiles)
          : this.rng.choice(validTiles);

      case "balanced":
        // Prefer 0 or 90 degree rotations
        const balancedTiles = validTiles.filter(
          (t) => t.rotation === 0 || t.rotation === 1
        );
        return balancedTiles.length > 0
          ? this.rng.choice(balancedTiles)
          : this.rng.choice(validTiles);

      case "maze_like":
        // Prefer corner and straight tiles
        const mazeTiles = validTiles.filter(
          (t) => t.tile.id === "corner" || t.tile.id === "straight"
        );
        return mazeTiles.length > 0
          ? this.rng.choice(mazeTiles)
          : this.rng.choice(validTiles);

      default:
        return this.rng.choice(validTiles);
    }
  }

  /**
   * Find valid tiles with enhanced randomization
   * @param {Vector2} pos - Position
   * @returns {Array} Valid tile options
   */
  findValidTilesRandomly(pos) {
    const allTiles = this.tileLoader.filterTiles(
      (tile) => !tile.start && !tile.exit
    );

    const validOptions = [];

    for (const tile of allTiles) {
      // Random rotation range based on style
      const maxRotations =
        this.generationStyle === "chaotic"
          ? 4
          : this.generationStyle === "balanced"
          ? 2
          : 4;

      for (let rotation = 0; rotation < maxRotations; rotation++) {
        // Random chance to try this rotation
        if (this.rng.random() < DUNGEON.ROTATION_CHANCE || rotation === 0) {
          if (this.canPlaceTileRandomly(tile, pos, rotation)) {
            validOptions.push({ tile, rotation });
          }
        }
      }
    }

    return validOptions;
  }

  /**
   * Enhanced tile placement validation with more flexibility
   * @param {Object} tile - Tile data
   * @param {Vector2} pos - Position
   * @param {number} rotation - Rotation
   * @returns {boolean} Can place?
   */
  canPlaceTileRandomly(tile, pos, rotation) {
    // In chaotic mode, be much more permissive
    if (this.generationStyle === "chaotic") {
      return this.rng.random() < 0.8; // 80% chance to allow any tile
    }

    // Standard validation for other modes
    const rotatedExits = this.rotateExits(tile.exits, rotation);
    const neighbors = this.getNeighbors(pos);

    let compatibleNeighbors = 0;
    let totalNeighbors = 0;

    for (const neighbor of neighbors) {
      if (neighbor.tile === null) continue;
      totalNeighbors++;

      const direction = neighbor.direction;
      const oppositeDir = this.getOppositeDirection(direction);

      const hasExit = rotatedExits[direction] !== undefined;
      const neighborRotatedExits = this.rotateExits(
        neighbor.tile.exits,
        neighbor.rotation
      );
      const neighborHasExit = neighborRotatedExits[oppositeDir] !== undefined;

      if (hasExit === neighborHasExit) {
        compatibleNeighbors++;
      }
    }

    // Different compatibility requirements based on style
    switch (this.generationStyle) {
      case "sparse":
        return compatibleNeighbors >= Math.floor(totalNeighbors * 0.5); // 50% compatibility
      case "dense":
      case "maze_like":
        return compatibleNeighbors === totalNeighbors; // 100% compatibility
      default:
        return compatibleNeighbors >= Math.floor(totalNeighbors * 0.7); // 70% compatibility
    }
  }

  /**
   * Place exit tile with variety
   */
  placeRandomExitTile() {
    const exitTiles = this.tileLoader.filterTiles((tile) => tile.exit === true);
    if (exitTiles.length === 0) return;

    const availableCells = this.getAvailableCells();
    if (availableCells.length === 0) return;

    let bestPositions = [];

    switch (this.generationStyle) {
      case "chaotic":
        // Random exit position
        bestPositions = availableCells;
        break;

      case "balanced":
        // Furthest from start
        if (this.startPosition) {
          let maxDistance = -1;
          for (const pos of availableCells) {
            const distance = pos.manhattanDistance(this.startPosition);
            if (distance > maxDistance) {
              maxDistance = distance;
              bestPositions = [pos];
            } else if (distance === maxDistance) {
              bestPositions.push(pos);
            }
          }
        }
        break;

      case "sparse":
        // Prefer edge positions
        bestPositions = availableCells.filter(
          (pos) =>
            pos.x === 0 ||
            pos.x === this.gridSize - 1 ||
            pos.y === 0 ||
            pos.y === this.gridSize - 1
        );
        break;

      default:
        // Mixed approach
        bestPositions = availableCells;
    }

    if (bestPositions.length === 0) {
      bestPositions = availableCells;
    }

    const exitPos = this.rng.choice(bestPositions);
    const exitTile = this.rng.choice(exitTiles);
    const rotation =
      this.rng.random() < DUNGEON.ROTATION_CHANCE ? this.rng.randInt(0, 4) : 0;

    this.placeTile(exitTile, exitPos, rotation);
    console.log(
      `Exit tile placed at (${exitPos.x}, ${exitPos.y}) with rotation ${rotation}`
    );
  }

  /**
   * Apply random post-processing effects
   */
  applyRandomPostProcessing() {
    // Random chance for various post-processing effects
    if (this.rng.random() < 0.3) {
      this.addRandomConnections();
    }

    if (this.rng.random() < 0.2) {
      this.removeRandomTiles();
    }

    if (this.rng.random() < 0.4) {
      this.addRandomRotations();
    }
  }

  /**
   * Add random connections between isolated areas
   */
  addRandomConnections() {
    const availableCells = this.getAvailableCells();
    const connectionsToAdd = Math.min(2, availableCells.length);

    for (let i = 0; i < connectionsToAdd; i++) {
      if (availableCells.length === 0) break;

      const pos = this.rng.choice(availableCells);
      const tiles = this.tileLoader.filterTiles(
        (tile) => !tile.start && !tile.exit
      );
      if (tiles.length > 0) {
        const tile = this.rng.choice(tiles);
        const rotation = this.rng.randInt(0, 4);
        this.placeTile(tile, pos, rotation);

        // Remove from available
        const index = availableCells.indexOf(pos);
        if (index > -1) availableCells.splice(index, 1);
      }
    }
  }

  /**
   * Remove some random tiles for variety
   */
  removeRandomTiles() {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.grid[y][x];
        if (
          cell &&
          typeof cell === "object" &&
          cell.tile &&
          !cell.tile.start &&
          !cell.tile.exit
        ) {
          if (this.rng.random() < 0.1) {
            // 10% chance to remove
            this.grid[y][x] = null;
          }
        }
      }
    }
  }

  /**
   * Add random rotations to existing tiles
   */
  addRandomRotations() {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.grid[y][x];
        if (cell && typeof cell === "object" && cell.tile) {
          if (this.rng.random() < 0.3) {
            // 30% chance to re-rotate
            cell.rotation = this.rng.randInt(0, 4);
          }
        }
      }
    }
  }

  /**
   * Exit'leri rotate et
   * @param {Object} exits - Orijinal exit'ler
   * @param {number} rotation - Rotasyon miktarı (0-3)
   * @returns {Object} Rotate edilmiş exit'ler
   */
  rotateExits(exits, rotation) {
    if (rotation === 0) return exits;

    const directions = ["N", "E", "S", "W"];
    const rotated = {};

    for (const [dir, pos] of Object.entries(exits)) {
      const dirIndex = directions.indexOf(dir);
      const newDirIndex = (dirIndex + rotation) % 4;
      const newDir = directions[newDirIndex];
      rotated[newDir] = pos;
    }

    return rotated;
  }

  /**
   * Komşu pozisyonları al
   * @param {Vector2} pos - Merkez pozisyon
   * @returns {Array} Komşu bilgileri
   */
  getNeighbors(pos) {
    const directions = [
      { dir: "N", offset: new Vector2(0, -1) },
      { dir: "E", offset: new Vector2(1, 0) },
      { dir: "S", offset: new Vector2(0, 1) },
      { dir: "W", offset: new Vector2(-1, 0) },
    ];

    return directions.map(({ dir, offset }) => {
      const neighborPos = pos.add(offset);
      const tile = this.isValidPosition(neighborPos)
        ? this.grid[neighborPos.y][neighborPos.x]
        : null;

      return {
        direction: dir,
        position: neighborPos,
        tile: tile?.tile || null,
        rotation: tile?.rotation || 0,
      };
    });
  }

  /**
   * Pozisyon geçerli mi kontrol et
   * @param {Vector2} pos - Pozisyon
   * @returns {boolean} Geçerli mi?
   */
  isValidPosition(pos) {
    return (
      pos.x >= 0 && pos.x < this.gridSize && pos.y >= 0 && pos.y < this.gridSize
    );
  }

  /**
   * Karşı yönü al
   * @param {string} direction - Yön
   * @returns {string} Karşı yön
   */
  getOppositeDirection(direction) {
    const opposites = { N: "S", S: "N", E: "W", W: "E" };
    return opposites[direction];
  }

  /**
   * Tile'ı yerleştir
   * @param {Object} tile - Tile datası
   * @param {Vector2} pos - Pozisyon
   * @param {number} rotation - Rotasyon
   */
  placeTile(tile, pos, rotation) {
    this.grid[pos.y][pos.x] = {
      tile: tile,
      position: pos,
      rotation: rotation,
    };
  }

  /**
   * Final dungeon'u oluştur
   * @returns {Object} Dungeon datası
   */
  buildDungeon() {
    const entities = [];
    const collisionMap = [];
    const metadata = {
      gridSize: this.gridSize,
      tileCount: 0,
      seed: this.rng.seed,
      levelShape: this.levelShape,
      generationStyle: this.generationStyle,
      emptyCells: 0,
      blockedCells: 0,
    };

    // Grid'i işle
    for (let gridY = 0; gridY < this.gridSize; gridY++) {
      for (let gridX = 0; gridX < this.gridSize; gridX++) {
        const cell = this.grid[gridY][gridX];

        // Handle different cell types
        if (!cell) {
          // Null cell - empty space
          continue;
        } else if (cell === "BLOCKED") {
          // Blocked cell - unusable space
          metadata.blockedCells++;
          continue;
        } else if (cell === "EMPTY") {
          // Intentionally empty cell
          metadata.emptyCells++;
          continue;
        } else if (typeof cell === "object" && cell.tile) {
          // Valid tile cell
          const { tile, rotation } = cell;
          const offsetX = gridX * tile.size[0] * TILE_SIZE;
          const offsetY = gridY * tile.size[1] * TILE_SIZE;

          // Prefab'ları işle
          if (tile.prefabs) {
            for (const prefab of tile.prefabs) {
              const entity = this.createEntityFromPrefab(
                prefab,
                offsetX,
                offsetY,
                rotation
              );
              if (entity) {
                entities.push(entity);
              }
            }
          }

          // Collision map'i işle
          if (tile.collision) {
            this.addCollisionToMap(
              tile.collision,
              collisionMap,
              offsetX,
              offsetY,
              rotation
            );
          }

          metadata.tileCount++;
        }
      }
    }

    console.log(
      `Dungeon built: ${metadata.tileCount} tiles, ${metadata.emptyCells} empty, ${metadata.blockedCells} blocked`
    );
    console.log(
      `Generation: ${metadata.levelShape} ${metadata.generationStyle} ${metadata.gridSize}x${metadata.gridSize}`
    );

    return {
      entities,
      collisionMap,
      metadata,
    };
  }

  /**
   * Prefab'dan entity oluştur
   * @param {Object} prefab - Prefab datası
   * @param {number} offsetX - X offset
   * @param {number} offsetY - Y offset
   * @param {number} rotation - Rotasyon
   * @returns {Object} Entity datası
   */
  createEntityFromPrefab(prefab, offsetX, offsetY, rotation) {
    const worldX = offsetX + prefab.pos[0] * TILE_SIZE;
    const worldY = offsetY + prefab.pos[1] * TILE_SIZE;

    return {
      type: prefab.type,
      id: prefab.id,
      x: worldX,
      y: worldY,
      direction: prefab.dir || "E",
      targets: prefab.targets || [],
      exit: prefab.exit || false,
    };
  }

  /**
   * Collision map'e tile collision'ını ekle
   * @param {Array} tileCollision - Tile collision datası
   * @param {Array} collisionMap - Ana collision map
   * @param {number} offsetX - X offset
   * @param {number} offsetY - Y offset
   * @param {number} rotation - Rotasyon
   */
  addCollisionToMap(tileCollision, collisionMap, offsetX, offsetY, rotation) {
    for (let y = 0; y < tileCollision.length; y++) {
      const row = tileCollision[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "#") {
          const worldX = Math.floor((offsetX + x * TILE_SIZE) / TILE_SIZE);
          const worldY = Math.floor((offsetY + y * TILE_SIZE) / TILE_SIZE);

          if (!collisionMap[worldY]) collisionMap[worldY] = [];
          collisionMap[worldY][worldX] = true;
        }
      }
    }
  }

  /**
   * Fallback dungeon oluştur (yükleme başarısız olursa)
   * @returns {Object} Basit dungeon
   */
  createFallbackDungeon() {
    console.warn("Creating fallback dungeon");

    return {
      entities: [
        {
          type: "Player",
          id: "player",
          x: TILE_SIZE * 2,
          y: TILE_SIZE * 2,
        },
        {
          type: "LaserEmitter",
          id: "emitter1",
          x: TILE_SIZE * 5,
          y: TILE_SIZE * 2,
          direction: "E",
        },
        {
          type: "PowerCell",
          id: "cell1",
          x: TILE_SIZE * 8,
          y: TILE_SIZE * 2,
        },
      ],
      collisionMap: [],
      metadata: {
        gridSize: 1,
        tileCount: 1,
        seed: 12345,
        fallback: true,
      },
    };
  }
}
