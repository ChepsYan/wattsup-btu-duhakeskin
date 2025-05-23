/**
 * Dynamic Level System - Infinite dungeon level management
 * Integrates WorldManager and Camera for seamless room-based gameplay
 */

import {
  Entity,
  Door,
  AutoDoor,
  LaserEmitter,
  Button,
  PowerCell,
} from "./entity.js";
import { Player } from "./player.js";
import { TileLoader } from "./dungeonGen.js";
import { WorldManager } from "./world.js";
import { Camera } from "./camera.js";
import { Vector2 } from "./utils.js";
import {
  TILE_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  DOOR_ANIMATION_FRAMES,
} from "./constants.js";

/**
 * Dynamic Level Manager - Handles infinite world with camera
 */
export class DynamicLevelManager {
  constructor() {
    this.tileLoader = new TileLoader();
    this.worldManager = null;
    this.camera = new Camera();

    // Entities
    this.entities = [];
    this.player = null;

    // Laser system reference
    this.laserSystem = null;

    // Level state
    this.levelNumber = 1;
    this.isLoading = false;

    // Entity factory mapping
    this.entityFactories = {
      Player: (data, worldPos) => {
        const player = new Player(worldPos.x, worldPos.y);
        this.player = player;
        // Set up collision callback for the centralized player system
        player.setCollisionCallback((pos) => this.hasCollisionAt(pos));
        return player;
      },
      Door: (data, worldPos) =>
        new Door(worldPos.x, worldPos.y, data.dir, data.id),
      AutoDoor: (data, worldPos) =>
        new AutoDoor(worldPos.x, worldPos.y, data.dir, data.id),
      LaserEmitter: (data, worldPos) =>
        new LaserEmitter(worldPos.x, worldPos.y, data.dir, data.id),
      Button: (data, worldPos) =>
        new Button(worldPos.x, worldPos.y, data.id, data.targets),
      PowerCell: (data, worldPos) =>
        new PowerCell(worldPos.x, worldPos.y, data.id),
      AdvancedWall: (data, worldPos) =>
        new AdvancedWall(worldPos.x, worldPos.y),
    };

    // Rendered background cache
    this.backgroundCache = new Map();

    // Solid objects array for collision detection
    this.solidObjects = [];
  }

  /**
   * Initialize system
   * @returns {Promise<boolean>} Success
   */
  async initialize() {
    try {
      this.isLoading = true;
      await this.tileLoader.loadTiles();
      this.worldManager = new WorldManager(this.tileLoader);
      console.log("Dynamic level system initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize dynamic level system:", error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generate new level with finite constraints
   * @param {number} levelNumber - Level number
   * @param {number} seed - World seed
   * @returns {Promise<boolean>} Success
   */
  async generateLevel(levelNumber = null, seed = null) {
    if (levelNumber !== null) {
      this.levelNumber = levelNumber;
    }

    if (seed === null) {
      seed = this.levelNumber * 12345 + (Date.now() % 10000);
    }

    try {
      this.isLoading = true;

      // Clear existing level
      this.clearLevel();

      // Initialize world with level constraints
      this.worldManager.initialize(seed, this.levelNumber);

      // Create initial entities for the start room
      this.createEntitiesForRoom(this.worldManager.startRoom);

      // Create entities for all generated rooms
      const allRooms = this.worldManager.getLoadedRooms();
      for (const room of allRooms) {
        if (room !== this.worldManager.startRoom) {
          this.createEntitiesForRoom(room);
        }
      }

      // Position player at start
      if (this.player && this.worldManager.startRoom) {
        const startPos = this.findPlayerStartPosition(
          this.worldManager.startRoom
        );
        this.player.setPosition(startPos.x, startPos.y, true);
        this.camera.snapTo(startPos);
      }

      console.log(
        `Finite level ${this.levelNumber} generated with seed ${seed}`
      );
      console.log(
        `Level contains ${allRooms.length} rooms with constraints:`,
        this.worldManager.levelConstraints
      );
      return true;
    } catch (error) {
      console.error("Failed to generate finite level:", error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Check if room has complex layout already
   * @param {WorldRoom} room - Room to check
   * @returns {boolean} Has complex layout
   */
  hasComplexLayout(room) {
    let wallCount = 0;
    let interiorWalls = 0;

    for (let y = 1; y < room.tileHeight - 1; y++) {
      for (let x = 1; x < room.tileWidth - 1; x++) {
        if (room.collisionMap[y][x]) {
          wallCount++;
          if (
            x > 1 &&
            x < room.tileWidth - 2 &&
            y > 1 &&
            y < room.tileHeight - 2
          ) {
            interiorWalls++;
          }
        }
      }
    }

    // Consider complex if more than 20% interior walls
    return interiorWalls > wallCount * 0.2;
  }

  /**
   * Find player start position in a room - IMPROVED VERSION
   * @param {WorldRoom} room - Room to search in
   * @returns {Vector2} Player start position
   */
  findPlayerStartPosition(room) {
    // Look for player prefab in room data first
    const playerPrefab = room.roomData.prefabs?.find(
      (p) => p.type === "Player"
    );
    if (playerPrefab) {
      const localPos = new Vector2(playerPrefab.pos[0], playerPrefab.pos[1]);
      // Verify the position is still clear after procedural generation
      if (!room.collisionMap[playerPrefab.pos[1]][playerPrefab.pos[0]]) {
        return room.localToWorld(localPos);
      }
    }

    // Find safe spawn positions (open areas with enough space)
    const safePositions = [];
    const minClearRadius = 2; // Minimum 2-tile radius of clear space

    for (let y = minClearRadius; y < room.tileHeight - minClearRadius; y++) {
      for (let x = minClearRadius; x < room.tileWidth - minClearRadius; x++) {
        if (!room.collisionMap[y][x]) {
          // Check if there's enough clear space around this position
          let clearSpace = true;
          for (
            let dy = -minClearRadius;
            dy <= minClearRadius && clearSpace;
            dy++
          ) {
            for (
              let dx = -minClearRadius;
              dx <= minClearRadius && clearSpace;
              dx++
            ) {
              const checkX = x + dx;
              const checkY = y + dy;
              if (
                checkX >= 0 &&
                checkX < room.tileWidth &&
                checkY >= 0 &&
                checkY < room.tileHeight
              ) {
                if (room.collisionMap[checkY][checkX]) {
                  clearSpace = false;
                }
              }
            }
          }

          if (clearSpace) {
            safePositions.push(new Vector2(x, y));
          }
        }
      }
    }

    if (safePositions.length > 0) {
      // Choose a safe position, preferably center-ish
      const centerX = room.tileWidth / 2;
      const centerY = room.tileHeight / 2;

      let bestPosition = safePositions[0];
      let bestDistance = Number.MAX_SAFE_INTEGER;

      for (const pos of safePositions) {
        const distance = Math.sqrt(
          (pos.x - centerX) ** 2 + (pos.y - centerY) ** 2
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPosition = pos;
        }
      }

      return room.localToWorld(bestPosition);
    }

    // Last resort: try room center
    const centerX = Math.floor(room.tileWidth / 2);
    const centerY = Math.floor(room.tileHeight / 2);

    // Force clear a space at room center if needed
    if (room.collisionMap[centerY][centerX]) {
      console.warn("Forcing clear space at room center for player spawn");
      room.collisionMap[centerY][centerX] = false;
      // Clear surrounding area too
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const clearX = centerX + dx;
          const clearY = centerY + dy;
          if (
            clearX >= 0 &&
            clearX < room.tileWidth &&
            clearY >= 0 &&
            clearY < room.tileHeight
          ) {
            room.collisionMap[clearY][clearX] = false;
          }
        }
      }
    }

    return room.localToWorld(new Vector2(centerX, centerY));
  }

  /**
   * Create entities for a room
   * @param {WorldRoom} room - Room to create entities for
   */
  createEntitiesForRoom(room) {
    console.log(
      `Creating entities for room (${room.roomX}, ${room.roomY}) at world (${room.worldX}, ${room.worldY}) with size ${room.tileWidth}x${room.tileHeight}`
    );

    // First, enhance the room layout with procedural generation
    this.generateProceduralWallLayout(room);

    // Create advanced wall entities from enhanced collision map
    this.createWallEntitiesFromRoom(room);

    // Create AutoDoor entities at room exits
    this.createAutoDoorsFromExits(room);

    // Find and wall overlap tiles between rooms (except autodoors)
    this.createWallsForRoomOverlaps(room);

    // Create prefab entities
    if (!room.roomData.prefabs) {
      console.log(`No prefabs found in room (${room.roomX}, ${room.roomY})`);
      return;
    }

    console.log(
      `Processing ${room.roomData.prefabs.length} prefabs for room (${room.roomX}, ${room.roomY})`
    );

    for (const prefabData of room.roomData.prefabs) {
      // Convert local position to world position
      const localPos = new Vector2(prefabData.pos[0], prefabData.pos[1]);
      const worldPos = room.localToWorld(localPos);

      console.log(
        `Entity ${prefabData.type} (${prefabData.id || "unnamed"}): local (${
          prefabData.pos[0]
        }, ${prefabData.pos[1]}) -> world (${worldPos.x}, ${worldPos.y})`
      );

      // Validate local position is within room bounds
      if (
        localPos.x < 0 ||
        localPos.x >= room.tileWidth ||
        localPos.y < 0 ||
        localPos.y >= room.tileHeight
      ) {
        console.warn(
          `Entity ${prefabData.type} at local (${localPos.x}, ${localPos.y}) is outside room bounds (${room.tileWidth}x${room.tileHeight}), skipping`
        );
        continue;
      }

      // Skip creating entities that would be inside walls after procedural generation
      if (
        room.collisionMap[prefabData.pos[1]] &&
        room.collisionMap[prefabData.pos[1]][prefabData.pos[0]]
      ) {
        console.log(
          `Skipping entity ${prefabData.type} at local (${prefabData.pos[0]}, ${prefabData.pos[1]}) - inside wall`
        );
        continue;
      }

      // Create entity
      const entity = this.createEntity(prefabData, worldPos);
      if (entity) {
        this.entities.push(entity);
        room.entities.push(entity);

        // Add to solid objects if it's solid
        if (entity.solid) {
          this.solidObjects.push(entity);
        }

        console.log(
          `Successfully created entity ${prefabData.type} (${entity.id}) at world (${entity.position.x}, ${entity.position.y})`
        );
      } else {
        console.warn(
          `Failed to create entity ${prefabData.type} at world (${worldPos.x}, ${worldPos.y})`
        );
      }
    }

    console.log(
      `Completed entity creation for room (${room.roomX}, ${room.roomY}). Total entities in room: ${room.entities.length}`
    );
  }

  /**
   * Create walls for room edges, except where autodoors exist
   * @param {WorldRoom} room - Room to process
   */
  createWallsForRoomOverlaps(room) {
    if (!this.worldManager) return;

    console.log(`Creating edge walls for room (${room.roomX}, ${room.roomY})`);

    // Create walls along all room edges, except where autodoors exist
    this.createWallsForRoomEdges(room);
  }

  /**
   * Create walls along room edges/perimeter, except where autodoors exist
   * @param {WorldRoom} room - Room to create edge walls for
   */
  createWallsForRoomEdges(room) {
    const edgeTiles = this.getRoomEdgeTiles(room);

    console.log(
      `Found ${edgeTiles.length} edge tiles for room (${room.roomX}, ${room.roomY})`
    );

    for (const edgeTile of edgeTiles) {
      // Check if this edge tile is in a shared/overlapping area with an adjacent room
      if (this.isSharedEdgeTile(room, edgeTile)) {
        console.log(
          `Skipping shared edge tile at (${edgeTile.worldPos.x}, ${edgeTile.worldPos.y})`
        );
        continue;
      }

      // Check if there's an autodoor at this edge position
      if (this.hasAutoDoorAtPosition(edgeTile.worldPos)) {
        console.log(
          `Skipping edge wall at (${edgeTile.worldPos.x}, ${edgeTile.worldPos.y}) - autodoor present`
        );
        continue;
      }

      // Check if there's already a wall at this position
      if (this.hasWallAtPosition(edgeTile.worldPos)) {
        console.log(
          `Wall already exists at edge (${edgeTile.worldPos.x}, ${edgeTile.worldPos.y})`
        );
        continue;
      }

      // Check if this edge position is already a collision tile in the room
      if (
        room.collisionMap[edgeTile.localPos.y] &&
        room.collisionMap[edgeTile.localPos.y][edgeTile.localPos.x]
      ) {
        console.log(
          `Edge position (${edgeTile.localPos.x}, ${edgeTile.localPos.y}) already has collision in room`
        );
        continue;
      }

      // Create wall at edge position
      this.createEdgeWall(edgeTile.worldPos, edgeTile.edge);

      // Update room collision map at this edge position
      room.collisionMap[edgeTile.localPos.y][edgeTile.localPos.x] = true;
    }
  }

  /**
   * Check if an edge tile is in a shared/overlapping area with an adjacent room
   * @param {WorldRoom} room - Current room
   * @param {Object} edgeTile - Edge tile data
   * @returns {boolean} True if tile is in shared area
   */
  isSharedEdgeTile(room, edgeTile) {
    const adjacentDirections = [
      { dx: 0, dy: -1, dir: "N", edge: "top" }, // North
      { dx: 0, dy: 1, dir: "S", edge: "bottom" }, // South
      { dx: 1, dy: 0, dir: "E", edge: "right" }, // East
      { dx: -1, dy: 0, dir: "W", edge: "left" }, // West
    ];

    for (const direction of adjacentDirections) {
      const adjacentRoom = this.worldManager.getRoom(
        room.roomX + direction.dx,
        room.roomY + direction.dy
      );

      if (adjacentRoom && edgeTile.edge === direction.edge) {
        // Check if this edge tile's world position is within the adjacent room's bounds
        if (adjacentRoom.containsWorldPosition(edgeTile.worldPos)) {
          console.log(
            `Edge tile at (${edgeTile.worldPos.x}, ${edgeTile.worldPos.y}) is shared with adjacent room (${adjacentRoom.roomX}, ${adjacentRoom.roomY})`
          );

          // Let the room with lower coordinates handle the shared wall
          const shouldThisRoomCreateWall =
            room.roomX < adjacentRoom.roomX ||
            (room.roomX === adjacentRoom.roomX &&
              room.roomY < adjacentRoom.roomY);

          return !shouldThisRoomCreateWall; // Return true to skip if this room shouldn't create the wall
        }
      }
    }

    return false; // Not a shared edge tile
  }

  /**
   * Get all edge/perimeter tiles for a room
   * @param {WorldRoom} room - Room to analyze
   * @returns {Array} Array of edge tile data
   */
  getRoomEdgeTiles(room) {
    const edgeTiles = [];

    // Top edge (y = 0)
    for (let x = 0; x < room.tileWidth; x++) {
      const localPos = new Vector2(x, 0);
      const worldPos = room.localToWorld(localPos);
      edgeTiles.push({
        localPos: localPos,
        worldPos: worldPos,
        edge: "top",
      });
    }

    // Bottom edge (y = height - 1)
    for (let x = 0; x < room.tileWidth; x++) {
      const localPos = new Vector2(x, room.tileHeight - 1);
      const worldPos = room.localToWorld(localPos);
      edgeTiles.push({
        localPos: localPos,
        worldPos: worldPos,
        edge: "bottom",
      });
    }

    // Left edge (x = 0)
    for (let y = 1; y < room.tileHeight - 1; y++) {
      // Skip corners already covered
      const localPos = new Vector2(0, y);
      const worldPos = room.localToWorld(localPos);
      edgeTiles.push({
        localPos: localPos,
        worldPos: worldPos,
        edge: "left",
      });
    }

    // Right edge (x = width - 1)
    for (let y = 1; y < room.tileHeight - 1; y++) {
      // Skip corners already covered
      const localPos = new Vector2(room.tileWidth - 1, y);
      const worldPos = room.localToWorld(localPos);
      edgeTiles.push({
        localPos: localPos,
        worldPos: worldPos,
        edge: "right",
      });
    }

    return edgeTiles;
  }

  /**
   * Create a wall at room edge position
   * @param {Vector2} worldPos - World position for wall
   * @param {string} edge - Edge type (top, bottom, left, right)
   */
  createEdgeWall(worldPos, edge) {
    // Determine wall orientation based on edge
    let wallType = "straight";
    let connections = {
      N: false,
      S: false,
      E: false,
      W: false,
      NE: false,
      NW: false,
      SE: false,
      SW: false,
    };

    // Set connections based on edge orientation
    switch (edge) {
      case "top":
      case "bottom":
        connections.E = true;
        connections.W = true;
        break;
      case "left":
      case "right":
        connections.N = true;
        connections.S = true;
        break;
    }

    const wall = new AdvancedWall(
      worldPos.x,
      worldPos.y,
      wallType,
      { connections },
      "standard"
    );

    this.entities.push(wall);
    this.solidObjects.push(wall);

    console.log(
      `Created edge wall at (${worldPos.x}, ${worldPos.y}) on ${edge} edge`
    );
  }

  /**
   * Create walls for overlap tiles between two specific rooms
   * @param {WorldRoom} room1 - First room
   * @param {WorldRoom} room2 - Second room
   * @param {string} direction - Direction from room1 to room2
   */
  createWallsForRoomPairOverlap(room1, room2, direction) {
    // This method is no longer used with the edge-based approach
    // Keeping it for compatibility but it does nothing now
    console.log(
      `Edge-based wall system active - skipping overlap processing between rooms`
    );
  }

  /**
   * Find overlap tiles between two adjacent rooms
   * @param {WorldRoom} room1 - First room
   * @param {WorldRoom} room2 - Second room
   * @returns {Array} Array of overlap tile data
   */
  findOverlapTilesBetweenRooms(room1, room2) {
    // This method is no longer used with the edge-based approach
    // Return empty array
    return [];
  }

  /**
   * Check if there's an autodoor at the specified position
   * @param {Vector2} worldPos - World position to check
   * @returns {boolean} True if autodoor exists at position
   */
  hasAutoDoorAtPosition(worldPos) {
    const tolerance = TILE_SIZE * 0.4; // Reduced tolerance for more precise checking

    for (const entity of this.entities) {
      if (
        entity.constructor.name === "AutoDoor" &&
        !entity.destroyed &&
        entity.active
      ) {
        const dx = Math.abs(entity.position.x - worldPos.x);
        const dy = Math.abs(entity.position.y - worldPos.y);

        if (dx < tolerance && dy < tolerance) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if there's already a wall at the specified position
   * @param {Vector2} worldPos - World position to check
   * @returns {boolean} True if wall exists at position
   */
  hasWallAtPosition(worldPos) {
    const tolerance = TILE_SIZE * 0.4; // Reduced tolerance for more precise checking

    for (const entity of this.entities) {
      if (
        (entity.constructor.name === "AdvancedWall" ||
          entity.constructor.name === "Wall") &&
        !entity.destroyed &&
        entity.active
      ) {
        const dx = Math.abs(entity.position.x - worldPos.x);
        const dy = Math.abs(entity.position.y - worldPos.y);

        if (dx < tolerance && dy < tolerance) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Create a wall at overlap position
   * @param {Vector2} worldPos - World position for wall
   * @param {string} direction - Direction hint for wall orientation
   */
  createOverlapWall(worldPos, direction) {
    // This method is no longer used with the edge-based approach
    console.log(
      `Edge-based wall system active - createOverlapWall method deprecated`
    );
  }

  /**
   * Update room collision map for overlap position
   * @param {WorldRoom} room - Room to update
   * @param {Vector2} worldPos - World position
   */
  updateRoomCollisionForOverlap(room, worldPos) {
    // This method is no longer used with the edge-based approach
    console.log(
      `Edge-based wall system active - updateRoomCollisionForOverlap method deprecated`
    );
  }

  /**
   * Create advanced wall system from room collision map
   * @param {WorldRoom} room - Room to create walls for
   */
  createWallEntitiesFromRoom(room) {
    const wallPositions = this.analyzeWallLayout(room);

    for (const wallData of wallPositions) {
      const worldPos = room.localToWorld(new Vector2(wallData.x, wallData.y));
      const wall = new AdvancedWall(
        worldPos.x,
        worldPos.y,
        wallData.type,
        wallData.connections,
        wallData.variant
      );

      this.entities.push(wall);
      room.entities.push(wall);
      this.solidObjects.push(wall);
    }
  }

  /**
   * Analyze wall layout to determine wall types and connections
   * @param {WorldRoom} room - Room to analyze
   * @returns {Array} Array of wall data objects
   */
  analyzeWallLayout(room) {
    const wallPositions = [];

    // First pass: find all wall positions
    const wallMap = new Map();
    for (let y = 0; y < room.tileHeight; y++) {
      for (let x = 0; x < room.tileWidth; x++) {
        if (room.collisionMap[y][x]) {
          wallMap.set(`${x},${y}`, { x, y });
        }
      }
    }

    // Second pass: analyze each wall's connectivity and determine type
    for (const [key, pos] of wallMap) {
      const connections = this.getWallConnections(pos.x, pos.y, wallMap, room);
      const wallType = this.determineWallType(connections);
      const variant = this.selectWallVariant(wallType, pos.x, pos.y);

      wallPositions.push({
        x: pos.x,
        y: pos.y,
        type: wallType,
        connections: connections,
        variant: variant,
      });
    }

    return wallPositions;
  }

  /**
   * Get wall connections for a position
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @param {Map} wallMap - Map of wall positions
   * @param {WorldRoom} room - Room data
   * @returns {Object} Connection data
   */
  getWallConnections(x, y, wallMap, room) {
    const directions = {
      N: { dx: 0, dy: -1 },
      S: { dx: 0, dy: 1 },
      E: { dx: 1, dy: 0 },
      W: { dx: -1, dy: 0 },
      NE: { dx: 1, dy: -1 },
      NW: { dx: -1, dy: -1 },
      SE: { dx: 1, dy: 1 },
      SW: { dx: -1, dy: 1 },
    };

    const connections = {};
    const neighbors = {};

    for (const [dir, offset] of Object.entries(directions)) {
      const checkX = x + offset.dx;
      const checkY = y + offset.dy;

      // Check if there's a wall at this position
      const hasWall = wallMap.has(`${checkX},${checkY}`);
      connections[dir] = hasWall;

      // Also check if it's a room boundary
      const isOutOfBounds =
        checkX < 0 ||
        checkX >= room.tileWidth ||
        checkY < 0 ||
        checkY >= room.tileHeight;
      neighbors[dir] = { hasWall, isOutOfBounds };
    }

    return { connections, neighbors };
  }

  /**
   * Determine wall type based on connections
   * @param {Object} connectionData - Connection analysis data
   * @returns {string} Wall type
   */
  determineWallType(connectionData) {
    const { connections } = connectionData;
    const cardinalConnections = [
      connections.N,
      connections.S,
      connections.E,
      connections.W,
    ].filter(Boolean).length;

    // Determine wall type based on connectivity patterns
    if (cardinalConnections === 0) {
      return "pillar"; // Isolated wall
    } else if (cardinalConnections === 1) {
      return "endcap"; // Wall end
    } else if (cardinalConnections === 2) {
      // Check if it's a corner or straight wall
      if (
        (connections.N && connections.S) ||
        (connections.E && connections.W)
      ) {
        return "straight";
      } else {
        return "corner";
      }
    } else if (cardinalConnections === 3) {
      return "junction_t"; // T-junction
    } else if (cardinalConnections === 4) {
      return "junction_cross"; // Cross junction
    }

    return "basic"; // Fallback
  }

  /**
   * Select wall variant for visual variety
   * @param {string} wallType - Type of wall
   * @param {number} x - X position for seeding
   * @param {number} y - Y position for seeding
   * @returns {string} Wall variant
   */
  selectWallVariant(wallType, x, y) {
    // Use position-based seeding for consistent variants
    const seed = (x * 31 + y * 17) % 100;

    const variants = {
      basic: ["standard", "reinforced", "damaged"],
      straight: ["standard", "paneled", "riveted"],
      corner: ["standard", "rounded", "beveled"],
      junction_t: ["standard", "heavy"],
      junction_cross: ["standard", "reinforced"],
      endcap: ["standard", "capped", "tapered"],
      pillar: ["standard", "decorative", "support"],
    };

    const availableVariants = variants[wallType] || ["standard"];
    return availableVariants[seed % availableVariants.length];
  }

  /**
   * Create AutoDoor entities at room exits
   * @param {WorldRoom} room - Room to create doors for
   */
  createAutoDoorsFromExits(room) {
    if (!this.worldManager) return;

    console.log(`Creating autodoors for room (${room.roomX}, ${room.roomY})`);

    // Create autodoors for all adjacent rooms, not just exits
    this.createAutoDoorsForAllAdjacentRooms(room);

    // Also handle traditional exit-based doors if they exist
    if (room.exits) {
      this.createAutoDoorsFromRoomExits(room);
    }
  }

  /**
   * Create autodoors for all adjacent rooms to ensure connectivity
   * @param {WorldRoom} room - Room to create doors for
   */
  createAutoDoorsForAllAdjacentRooms(room) {
    const adjacentDirections = [
      { dx: 0, dy: -1, dir: "N", opposite: "S" }, // North
      { dx: 0, dy: 1, dir: "S", opposite: "N" }, // South
      { dx: 1, dy: 0, dir: "E", opposite: "W" }, // East
      { dx: -1, dy: 0, dir: "W", opposite: "E" }, // West
    ];

    for (const direction of adjacentDirections) {
      const adjacentRoom = this.worldManager.getRoom(
        room.roomX + direction.dx,
        room.roomY + direction.dy
      );

      if (adjacentRoom) {
        console.log(
          `Found adjacent room (${adjacentRoom.roomX}, ${adjacentRoom.roomY}) to the ${direction.dir} of room (${room.roomX}, ${room.roomY})`
        );

        // Only create door if this room has lower coordinates (to avoid duplicates)
        const shouldCreateDoor =
          room.roomX < adjacentRoom.roomX ||
          (room.roomX === adjacentRoom.roomX &&
            room.roomY < adjacentRoom.roomY);

        if (shouldCreateDoor) {
          this.createAutoDoorBetweenRooms(room, adjacentRoom, direction.dir);
        } else {
          console.log(`Skipping door creation - adjacent room will handle it`);
        }
      }
    }
  }

  /**
   * Create an autodoor between two adjacent rooms
   * @param {WorldRoom} room1 - First room (creating the door)
   * @param {WorldRoom} room2 - Adjacent room
   * @param {string} direction - Direction from room1 to room2
   */
  createAutoDoorBetweenRooms(room1, room2, direction) {
    // Find the shared/overlapping area between the two rooms
    const sharedPosition = this.findSharedPositionBetweenRooms(
      room1,
      room2,
      direction
    );

    if (!sharedPosition) {
      console.warn(
        `No shared position found between rooms (${room1.roomX}, ${room1.roomY}) and (${room2.roomX}, ${room2.roomY})`
      );
      return;
    }

    console.log(
      `Creating autodoor at shared position (${sharedPosition.x}, ${sharedPosition.y}) between rooms`
    );

    // Check if there's already an autodoor nearby
    if (this.hasAutoDoorAtPosition(sharedPosition)) {
      console.log(
        `Autodoor already exists at (${sharedPosition.x}, ${sharedPosition.y})`
      );
      return;
    }

    // Clear any existing walls at this position
    this.removeAllWallsAtPosition(sharedPosition, room1);

    // Clear collision in both rooms at this position
    const room1LocalPos = room1.worldToLocal(sharedPosition);
    const room2LocalPos = room2.worldToLocal(sharedPosition);

    if (
      room1LocalPos.x >= 0 &&
      room1LocalPos.x < room1.tileWidth &&
      room1LocalPos.y >= 0 &&
      room1LocalPos.y < room1.tileHeight
    ) {
      room1.collisionMap[room1LocalPos.y][room1LocalPos.x] = false;
    }

    if (
      room2LocalPos.x >= 0 &&
      room2LocalPos.x < room2.tileWidth &&
      room2LocalPos.y >= 0 &&
      room2LocalPos.y < room2.tileHeight
    ) {
      room2.collisionMap[room2LocalPos.y][room2LocalPos.x] = false;
    }

    // Create AutoDoor entity
    const autoDoor = new AutoDoor(
      sharedPosition.x,
      sharedPosition.y,
      direction,
      `autodoor_${room1.roomX}_${room1.roomY}_${direction}`
    );

    autoDoor.activationDistance = TILE_SIZE * 3.5; // Increased from 2.5 to ensure detection from both sides

    // Set up callback for solid state changes
    autoDoor.setSolidStateChangeCallback((door, isSolid) => {
      this.handleDoorSolidStateChange(door, isSolid);
    });

    this.entities.push(autoDoor);
    room1.entities.push(autoDoor);

    // Add to solidObjects since doors start closed (solid)
    this.solidObjects.push(autoDoor);

    console.log(
      `✅ Created AutoDoor between rooms (${room1.roomX}, ${room1.roomY}) and (${room2.roomX}, ${room2.roomY}) at (${sharedPosition.x}, ${sharedPosition.y})`
    );
  }

  /**
   * Find the shared position between two adjacent rooms for door placement
   * @param {WorldRoom} room1 - First room
   * @param {WorldRoom} room2 - Adjacent room
   * @param {string} direction - Direction from room1 to room2
   * @returns {Vector2|null} Shared position or null
   */
  findSharedPositionBetweenRooms(room1, room2, direction) {
    const room1Bounds = room1.getBounds();
    const room2Bounds = room2.getBounds();

    // Find the overlapping region
    const overlapLeft = Math.max(room1Bounds.left, room2Bounds.left);
    const overlapRight = Math.min(room1Bounds.right, room2Bounds.right);
    const overlapTop = Math.max(room1Bounds.top, room2Bounds.top);
    const overlapBottom = Math.min(room1Bounds.bottom, room2Bounds.bottom);

    // Check if there's actually an overlap
    if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
      console.warn(
        `No overlap found between adjacent rooms, attempting to find closest adjacency point`
      );

      // If no overlap, find the closest adjacency point between the rooms
      return this.findClosestAdjacencyPoint(room1, room2, direction);
    }

    // Find a suitable position in the overlapping area
    let doorX, doorY;

    switch (direction) {
      case "N": // North - door should be in the top part of the overlap
        doorX =
          Math.floor((overlapLeft + overlapRight) / 2 / TILE_SIZE) * TILE_SIZE;
        doorY = overlapTop;
        break;
      case "S": // South - door should be in the bottom part of the overlap
        doorX =
          Math.floor((overlapLeft + overlapRight) / 2 / TILE_SIZE) * TILE_SIZE;
        doorY = overlapBottom - TILE_SIZE;
        break;
      case "E": // East - door should be in the right part of the overlap
        doorX = overlapRight - TILE_SIZE;
        doorY =
          Math.floor((overlapTop + overlapBottom) / 2 / TILE_SIZE) * TILE_SIZE;
        break;
      case "W": // West - door should be in the left part of the overlap
        doorX = overlapLeft;
        doorY =
          Math.floor((overlapTop + overlapBottom) / 2 / TILE_SIZE) * TILE_SIZE;
        break;
      default:
        // Default to center of overlap
        doorX =
          Math.floor((overlapLeft + overlapRight) / 2 / TILE_SIZE) * TILE_SIZE;
        doorY =
          Math.floor((overlapTop + overlapBottom) / 2 / TILE_SIZE) * TILE_SIZE;
    }

    return new Vector2(doorX, doorY);
  }

  /**
   * Find the closest adjacency point between two rooms when they don't overlap
   * @param {WorldRoom} room1 - First room
   * @param {WorldRoom} room2 - Adjacent room
   * @param {string} direction - Direction from room1 to room2
   * @returns {Vector2|null} Closest adjacency point or null
   */
  findClosestAdjacencyPoint(room1, room2, direction) {
    const room1Bounds = room1.getBounds();
    const room2Bounds = room2.getBounds();

    let doorX, doorY;

    switch (direction) {
      case "N": // North - find point on room1's top edge closest to room2
        doorX =
          Math.floor((room1Bounds.left + room1Bounds.right) / 2 / TILE_SIZE) *
          TILE_SIZE;
        doorY = room1Bounds.top;
        break;
      case "S": // South - find point on room1's bottom edge closest to room2
        doorX =
          Math.floor((room1Bounds.left + room1Bounds.right) / 2 / TILE_SIZE) *
          TILE_SIZE;
        doorY = room1Bounds.bottom - TILE_SIZE;
        break;
      case "E": // East - find point on room1's right edge closest to room2
        doorX = room1Bounds.right - TILE_SIZE;
        doorY =
          Math.floor((room1Bounds.top + room1Bounds.bottom) / 2 / TILE_SIZE) *
          TILE_SIZE;
        break;
      case "W": // West - find point on room1's left edge closest to room2
        doorX = room1Bounds.left;
        doorY =
          Math.floor((room1Bounds.top + room1Bounds.bottom) / 2 / TILE_SIZE) *
          TILE_SIZE;
        break;
      default:
        console.warn(
          `Unknown direction ${direction} in findClosestAdjacencyPoint`
        );
        return null;
    }

    // Ensure the point is valid and on a tile boundary
    doorX = Math.floor(doorX / TILE_SIZE) * TILE_SIZE;
    doorY = Math.floor(doorY / TILE_SIZE) * TILE_SIZE;

    console.log(
      `Found closest adjacency point at (${doorX}, ${doorY}) for direction ${direction}`
    );
    return new Vector2(doorX, doorY);
  }

  /**
   * Create autodoors from traditional room exits (legacy support)
   * @param {WorldRoom} room - Room to create doors for
   */
  createAutoDoorsFromRoomExits(room) {
    for (const [direction, exitPos] of Object.entries(room.exits)) {
      // Check if there's an adjacent room in this direction
      const adjacentRoom = this.getAdjacentRoom(room, direction);
      if (adjacentRoom) {
        // Convert exit position to world coordinates
        const localPos = new Vector2(exitPos[0], exitPos[1]);
        const worldPos = room.localToWorld(localPos);

        console.log(
          `Processing traditional exit at ${direction} (${exitPos[0]}, ${exitPos[1]}) -> world (${worldPos.x}, ${worldPos.y})`
        );

        // Check if there's already a door nearby to prevent clustering
        if (this.hasNearbyDoor(worldPos)) {
          console.log(
            `⏭️  Skipping traditional exit door at ${direction} - nearby door detected`
          );
          continue;
        }

        // Create door using traditional method (for compatibility)
        this.createTraditionalAutoDoor(room, worldPos, direction, exitPos);
      }
    }
  }

  /**
   * Create traditional autodoor (legacy method)
   * @param {WorldRoom} room - Room
   * @param {Vector2} worldPos - World position
   * @param {string} direction - Direction
   * @param {Array} exitPos - Exit position
   */
  createTraditionalAutoDoor(room, worldPos, direction, exitPos) {
    // STEP 1: Aggressively remove ALL walls at this position and surrounding area
    this.removeAllWallsAtPosition(worldPos, room);

    // STEP 2: Clear collision data in room's collision map at exit position
    if (
      exitPos[0] >= 0 &&
      exitPos[0] < room.tileWidth &&
      exitPos[1] >= 0 &&
      exitPos[1] < room.tileHeight
    ) {
      room.collisionMap[exitPos[1]][exitPos[0]] = false;
      console.log(`Cleared collision map at (${exitPos[0]}, ${exitPos[1]})`);
    }

    // STEP 3: Verify no walls remain at this position
    const remainingWalls = this.getWallsAtPosition(worldPos);
    if (remainingWalls.length > 0) {
      console.warn(
        `${remainingWalls.length} walls still remain at door position, force removing...`
      );
      remainingWalls.forEach((wall) => this.safeRemoveEntity(wall));
    }

    // STEP 4: Create AutoDoor entity (start as closed and solid)
    const autoDoor = new AutoDoor(
      worldPos.x,
      worldPos.y,
      direction,
      `autodoor_traditional_${room.roomX}_${room.roomY}_${direction}`
    );

    // Doors start closed by default in constructor
    autoDoor.activationDistance = TILE_SIZE * 3.5; // Increased from 2.5 to ensure detection from both sides

    // Set up callback for solid state changes
    autoDoor.setSolidStateChangeCallback((door, isSolid) => {
      this.handleDoorSolidStateChange(door, isSolid);
    });

    this.entities.push(autoDoor);
    room.entities.push(autoDoor);

    // Add to solidObjects since doors start closed (solid)
    this.solidObjects.push(autoDoor);

    console.log(
      `✅ Placed traditional AutoDoor at ${direction} (${exitPos}) - Open: ${autoDoor.isOpen}, Solid: ${autoDoor.solid}, Range: ${autoDoor.activationDistance}`
    );
  }

  /**
   * Check if there's already a door nearby to prevent clustering
   * @param {Vector2} worldPos - Position to check around
   * @returns {boolean} True if there's a door nearby
   */
  hasNearbyDoor(worldPos) {
    const minDistance = TILE_SIZE * 1.5; // Minimum distance between doors

    for (const entity of this.entities) {
      if (
        entity.constructor.name === "AutoDoor" ||
        entity.constructor.name === "Door"
      ) {
        const dx = entity.position.x - worldPos.x;
        const dy = entity.position.y - worldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          console.log(
            `Found nearby door ${entity.id} at distance ${Math.floor(
              distance
            )} (min: ${minDistance})`
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Aggressively remove all walls at and around a position - SAFE VERSION
   * @param {Vector2} worldPos - World position to clear
   * @param {WorldRoom} room - The room containing this position
   */
  removeAllWallsAtPosition(worldPos, room) {
    const tolerance = TILE_SIZE * 0.6; // Reduced tolerance to be more precise
    const wallsToRemove = [];

    // Find walls in the immediate area only
    for (const entity of this.entities) {
      if (entity.constructor.name === "AdvancedWall" && !entity.destroyed) {
        const dx = entity.position.x - worldPos.x;
        const dy = entity.position.y - worldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < tolerance) {
          wallsToRemove.push(entity);
        }
      }
    }

    console.log(
      `Found ${wallsToRemove.length} walls to remove at position (${Math.floor(
        worldPos.x
      )}, ${Math.floor(worldPos.y)})`
    );

    // Remove all found walls using explicit removal
    wallsToRemove.forEach((wall) => {
      this.requestExplicitRemoval(wall);
      console.log(
        `Requested removal of wall at (${wall.position.x}, ${wall.position.y})`
      );
    });
  }

  /**
   * Safely remove an entity from all arrays and room entities - ULTRA SAFE VERSION
   * @param {Entity} entityToRemove - Entity to remove
   */
  safeRemoveEntity(entityToRemove) {
    if (!entityToRemove || entityToRemove.destroyed) {
      return; // Already destroyed or invalid
    }

    // Additional safety check - NEVER remove player or critical entities during movement
    if (entityToRemove.constructor.name === "Player") {
      console.warn(
        "❌ BLOCKED: Attempted to remove player entity - this is forbidden!"
      );
      return;
    }

    // Additional safety check - don't remove doors unless explicitly requested
    if (
      (entityToRemove.constructor.name === "AutoDoor" ||
        entityToRemove.constructor.name === "Door") &&
      !entityToRemove.explicitRemovalRequested
    ) {
      console.warn(
        "❌ BLOCKED: Attempted to remove door without explicit request - this might be accidental!"
      );
      return;
    }

    // Additional safety check - don't remove walls unless explicitly requested
    if (
      entityToRemove.constructor.name === "AdvancedWall" &&
      !entityToRemove.explicitRemovalRequested
    ) {
      console.warn(
        "❌ BLOCKED: Attempted to remove wall without explicit request - this might be accidental!"
      );
      return;
    }

    console.log(
      `🚮 Safe removal requested for: ${entityToRemove.constructor.name} (ID: ${entityToRemove.id})`
    );

    // Mark as destroyed and request explicit removal
    entityToRemove.destroyed = true;
    entityToRemove.active = false;
    entityToRemove.shouldRemove = true; // Explicit removal flag

    // Log the removal for debugging
    console.log(
      `📝 Entity marked for removal: ${entityToRemove.constructor.name} at (${entityToRemove.position?.x}, ${entityToRemove.position?.y})`
    );

    // Request cleanup on next frame instead of immediate removal
    this.requestManualCleanup();
  }

  /**
   * Request explicit removal of an entity (for intentional removals like wall clearing)
   * @param {Entity} entityToRemove - Entity to remove
   */
  requestExplicitRemoval(entityToRemove) {
    if (!entityToRemove) return;

    console.log(
      `🎯 Explicit removal requested for: ${entityToRemove.constructor.name}`
    );
    entityToRemove.explicitRemovalRequested = true;
    this.safeRemoveEntity(entityToRemove);
  }

  /**
   * Force remove an entity from all arrays and room entities
   * @param {Entity} entityToRemove - Entity to remove
   */
  forceRemoveEntity(entityToRemove) {
    console.warn(`Force removing entity: ${entityToRemove?.constructor?.name}`);
    // Use the safer removal method even for force removal
    this.safeRemoveEntity(entityToRemove);
  }

  /**
   * Handle door solid state changes to maintain solidObjects array
   * @param {AutoDoor} door - The door that changed state
   * @param {boolean} isSolid - New solid state
   */
  handleDoorSolidStateChange(door, isSolid) {
    const isInSolidObjects = this.solidObjects.includes(door);

    if (isSolid && !isInSolidObjects) {
      // Door became solid, add to solidObjects
      this.solidObjects.push(door);
      console.log(`Door ${door.id} became solid, added to solidObjects`);
    } else if (!isSolid && isInSolidObjects) {
      // Door became non-solid, remove from solidObjects
      const index = this.solidObjects.indexOf(door);
      if (index !== -1) {
        this.solidObjects.splice(index, 1);
        console.log(
          `Door ${door.id} became non-solid, removed from solidObjects`
        );
      }
    }
  }

  /**
   * Get adjacent room in specified direction
   * @param {WorldRoom} room - Source room
   * @param {string} direction - Direction (N, S, E, W)
   * @returns {WorldRoom|null} Adjacent room or null
   */
  getAdjacentRoom(room, direction) {
    const offsets = {
      N: { dx: 0, dy: -1 },
      S: { dx: 0, dy: 1 },
      E: { dx: 1, dy: 0 },
      W: { dx: -1, dy: 0 },
    };

    const offset = offsets[direction];
    if (!offset) return null;

    const adjRoomX = room.roomX + offset.dx;
    const adjRoomY = room.roomY + offset.dy;

    return this.worldManager
      ? this.worldManager.getRoom(adjRoomX, adjRoomY)
      : null;
  }

  /**
   * Create entity from prefab data
   * @param {Object} data - Prefab data
   * @param {Vector2} worldPos - World position
   * @returns {Entity|null} Created entity
   */
  createEntity(data, worldPos) {
    const factory = this.entityFactories[data.type];
    if (!factory) {
      console.warn(`Unknown entity type: ${data.type}`);
      return null;
    }

    // Validate world position to prevent invalid coordinates
    if (worldPos.x < 0 || worldPos.y < 0) {
      console.warn(
        `Entity ${data.type} (${
          data.id || "unnamed"
        }) would be created at invalid coordinates: (${Math.floor(
          worldPos.x
        )}, ${Math.floor(worldPos.y)}). Adjusting to safe position.`
      );

      // Adjust to safe coordinates
      worldPos.x = Math.max(0, worldPos.x);
      worldPos.y = Math.max(0, worldPos.y);

      console.log(
        `Entity ${data.type} (${
          data.id || "unnamed"
        }) position corrected to: (${Math.floor(worldPos.x)}, ${Math.floor(
          worldPos.y
        )})`
      );
    }

    try {
      const entity = factory(data, worldPos);

      // Set additional properties
      if (data.id) entity.id = data.id;
      if (data.targets) entity.targets = data.targets;
      if (data.exit !== undefined) entity.isExit = data.exit;

      // Special setup for Button entities
      if (entity.constructor.name === "Button") {
        // Set room manager reference so button can control lasers
        entity.setRoomManager(this);
        console.log(
          `Button ${entity.id} set up with room manager for laser control`
        );
      }

      return entity;
    } catch (error) {
      console.error(`Failed to create entity ${data.type}:`, error);
      return null;
    }
  }

  /**
   * Clear current level
   */
  clearLevel() {
    // Clear entities
    for (const entity of this.entities) {
      entity.destroy();
    }
    this.entities = [];
    this.solidObjects = [];
    this.player = null;

    // Clear background cache
    this.backgroundCache.clear();
  }

  /**
   * Update level state
   * @param {number} deltaTime - Frame time
   */
  update(deltaTime) {
    if (this.isLoading) return;

    // Monitor entity health for debugging
    this.monitorEntityHealth();

    // Update camera to follow player
    if (this.player && this.camera) {
      const playerVelocity = this.player.velocity || new Vector2(0, 0);
      this.camera.update(this.player.getCenter(), playerVelocity, deltaTime);
    }

    // Update world streaming (now disabled for finite levels)
    if (this.worldManager && this.player) {
      this.worldManager.update(this.player.getCenter());
    }

    // Check for level completion
    this.checkLevelCompletion();

    // Update room-specific entities
    this.updateRoomEntities(deltaTime);

    // Handle player interactions with objects
    this.updatePlayerInteractions();

    // Update interaction feedbacks
    if (this.interactionFeedbacks) {
      for (let i = this.interactionFeedbacks.length - 1; i >= 0; i--) {
        const feedback = this.interactionFeedbacks[i];
        feedback.life--;
        feedback.position = feedback.position.add(feedback.velocity);
        feedback.velocity = feedback.velocity.multiply(0.95);

        if (feedback.life <= 0) {
          this.interactionFeedbacks.splice(i, 1);
        }
      }
    }
  }

  /**
   * Check if player has reached the exit room and all power cells are activated
   */
  checkLevelCompletion() {
    if (!this.player || !this.worldManager || this.worldManager.levelComplete)
      return;

    const playerPos = this.player.getCenter();
    const currentRoom = this.worldManager.getRoomAtWorldPosition(playerPos);

    if (currentRoom && currentRoom.isExit) {
      // Check if all power cells are activated
      const powerCells = this.entities.filter(
        (e) => e.constructor.name === "PowerCell"
      );
      const poweredCells = powerCells.filter((cell) => cell.isPowered);

      if (powerCells.length === 0) {
        // No power cells in level, allow progression (edge case)
        this.completeLevelWithMessage(
          "Level completed! No power cells to activate."
        );
      } else if (poweredCells.length === powerCells.length) {
        // All power cells are powered - allow level completion
        this.completeLevelWithMessage(
          `Level completed! All ${powerCells.length} power cells activated and exit reached!`
        );
      } else {
        // Not all power cells are powered - show requirement message
        const remaining = powerCells.length - poweredCells.length;
        console.log(
          `Cannot complete level: ${remaining} power cell(s) still need to be activated (${poweredCells.length}/${powerCells.length} powered)`
        );

        // Show notification to player if available
        if (this.uiManager) {
          this.uiManager.showNotification(
            `Devam etmek için tüm güç hücrelerini aktif et! (${poweredCells.length}/${powerCells.length})`,
            "warning",
            3000
          );
        }
      }
    }
  }

  /**
   * Complete the level with a success message
   * @param {string} message - Completion message
   */
  completeLevelWithMessage(message) {
    this.worldManager.levelComplete = true;
    console.log(message);

    // Trigger level completion event (can be caught by main game)
    if (this.onLevelComplete) {
      this.onLevelComplete(this.levelNumber);
    } else {
      // Default behavior - notify via global event
      window.dispatchEvent(
        new CustomEvent("levelComplete", {
          detail: { level: this.levelNumber },
        })
      );
    }
  }

  /**
   * Set level completion callback
   * @param {Function} callback - Level completion callback
   */
  setLevelCompleteCallback(callback) {
    this.onLevelComplete = callback;
  }

  /**
   * Update room entities - optimized to only update visible rooms
   * @param {number} deltaTime - Frame time (ms)
   */
  updateRoomEntities(deltaTime) {
    if (!this.worldManager || !this.player) return;

    // Get player position for AutoDoor updates
    const playerPos = new Vector2(
      this.player.position.x,
      this.player.position.y
    );

    // IMPORTANT: Always update ALL autodoors first, regardless of player location
    // This ensures doors detect players even when they're outside room boundaries
    this.updateAllAutoDoors(deltaTime, playerPos);

    // Get player's current room (may be null if player is outside all rooms)
    const playerRoom = this.worldManager.getRoomAtWorldPosition(playerPos);

    // If player is outside all rooms, we still want to update some entities
    // but we can't determine which rooms to focus on, so we'll use a fallback approach
    if (!playerRoom) {
      // Player is outside all room boundaries - update entities in all loaded rooms
      // but with reduced frequency to avoid performance issues
      this.updateEntitiesWhenPlayerOutsideRooms(deltaTime);
      return;
    }

    // Normal case: player is inside a room
    // Update entities in current room and adjacent rooms (optimization)
    const roomsToUpdate = new Set([playerRoom]);

    // Add adjacent rooms
    const adjacent = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ];

    for (const adj of adjacent) {
      const adjRoom = this.worldManager.getRoom(
        playerRoom.roomX + adj.dx,
        playerRoom.roomY + adj.dy
      );
      if (adjRoom) {
        roomsToUpdate.add(adjRoom);
      }
    }

    // Update entities in relevant rooms (excluding autodoors since they're handled above)
    for (const room of roomsToUpdate) {
      for (const entity of room.entities) {
        if (entity && entity.active) {
          try {
            // Skip AutoDoors since they're handled globally above
            if (entity.constructor.name === "AutoDoor") {
              continue; // Skip - already handled globally
            } else if (entity.update) {
              entity.update(deltaTime);
            }
          } catch (error) {
            console.error("Error updating entity:", error, entity);
          }
        }
      }
    }

    // Clean up destroyed entities periodically
    this.cleanupDestroyedEntities();
  }

  /**
   * Update entities when player is outside all room boundaries
   * @param {number} deltaTime - Frame time (ms)
   */
  updateEntitiesWhenPlayerOutsideRooms(deltaTime) {
    // When player is outside rooms, update all entities with reduced frequency
    // Use a simple frame counter to update different entity types at different intervals
    if (!this.outsideRoomsUpdateCounter) {
      this.outsideRoomsUpdateCounter = 0;
    }
    this.outsideRoomsUpdateCounter++;

    // Update different entity types at different intervals to spread the load
    const allRooms = this.worldManager.getLoadedRooms();
    for (const room of allRooms) {
      for (const entity of room.entities) {
        if (entity && entity.active) {
          try {
            // Skip AutoDoors since they're handled globally
            if (entity.constructor.name === "AutoDoor") {
              continue; // Skip - already handled globally
            }

            // Update other entities with reduced frequency based on type
            let shouldUpdate = false;
            if (
              entity.constructor.name === "Button" &&
              this.outsideRoomsUpdateCounter % 2 === 0
            ) {
              shouldUpdate = true; // Update buttons every 2 frames
            } else if (
              entity.constructor.name === "LaserEmitter" &&
              this.outsideRoomsUpdateCounter % 3 === 0
            ) {
              shouldUpdate = true; // Update laser emitters every 3 frames
            } else if (
              entity.constructor.name === "PowerCell" &&
              this.outsideRoomsUpdateCounter % 4 === 0
            ) {
              shouldUpdate = true; // Update power cells every 4 frames
            } else if (this.outsideRoomsUpdateCounter % 5 === 0) {
              shouldUpdate = true; // Update other entities every 5 frames
            }

            if (shouldUpdate && entity.update) {
              entity.update(deltaTime);
            }
          } catch (error) {
            console.error(
              "Error updating entity when player outside rooms:",
              error,
              entity
            );
          }
        }
      }
    }

    // Clean up destroyed entities periodically
    this.cleanupDestroyedEntities();
  }

  updateAllAutoDoors(deltaTime, playerPos) {
    for (const entity of this.entities) {
      if (entity && entity.active && entity.constructor.name === "AutoDoor") {
        try {
          const wasInRange = entity.playerInRange;
          entity.updateWithPlayer(deltaTime, playerPos);

          if (entity.playerInRange) {
            doorsInRange++;
          }
        } catch (error) {
          console.error("Error updating AutoDoor:", error, entity);
        }
      }
    }
  }

  cleanupDestroyedEntities() {
    if (!this.manualCleanupRequested) return;
    this.manualCleanupRequested = false;

    console.log(
      "🧹 Manual cleanup requested - checking for truly destroyed entities"
    );

    const beforeCount = this.entities.length;

    const entitiesToKeep = [];
    const entitiesToRemove = [];

    for (const entity of this.entities) {
      if (!entity) {
        console.warn("Found null entity, removing");
        continue; // Skip null entities
      }

      if (entity.constructor.name === "Player") {
        entitiesToKeep.push(entity);
        continue;
      }

      if (
        !entity.hasOwnProperty("destroyed") ||
        !entity.hasOwnProperty("active")
      ) {
        entitiesToKeep.push(entity);
        continue;
      }

      if (entity.active === true) {
        entitiesToKeep.push(entity);
        continue;
      }

      if (entity.destroyed !== true) {
        entitiesToKeep.push(entity);
        continue;
      }

      if (
        entity.destroyed === true &&
        entity.active === false &&
        entity.shouldRemove === true
      ) {
        console.log(
          `🗑️  Removing entity: ${entity.constructor.name} (ID: ${entity.id})`
        );
        entitiesToRemove.push(entity);
      } else {
        // When in doubt, keep the entity
        entitiesToKeep.push(entity);
      }
    }

    this.entities = entitiesToKeep;

    if (entitiesToRemove.length > 0) {
      console.log(
        `🧹 Cleaned up ${entitiesToRemove.length} entities (ultra-conservative cleanup)`
      );
      this.rebuildSolidObjectsArray();

      const rooms = this.worldManager ? this.worldManager.getLoadedRooms() : [];
      for (const room of rooms) {
        const roomBeforeCount = room.entities.length;
        room.entities = room.entities.filter((entity) => {
          return entitiesToKeep.includes(entity);
        });

        if (room.entities.length !== roomBeforeCount) {
          console.log(
            `🧹 Cleaned ${
              roomBeforeCount - room.entities.length
            } entities from room (${room.roomX}, ${room.roomY})`
          );
        }
      }
    } else {
      console.log("🧹 No entities needed cleanup");
    }
  }

  requestManualCleanup() {
    console.log("🧹 Manual cleanup requested");
    this.manualCleanupRequested = true;
  }

  rebuildSolidObjectsArray() {
    this.solidObjects = this.entities.filter((entity) => {
      if (!entity) return false;
      if (entity.destroyed === true) return false;
      if (entity.active === false) return false;
      if (!entity.solid) return false;

      if (
        entity.constructor.name === "AutoDoor" ||
        entity.constructor.name === "Door"
      ) {
        return !entity.isOpen;
      }

      return true;
    });

    console.log(
      `Rebuilt solid objects array: ${this.solidObjects.length} solid entities`
    );
  }

  hasCollisionAt(position) {
    if (!position) {
      console.warn("hasCollisionAt called with null/undefined position");
      return true;
    }

    try {
      for (const solidObject of this.solidObjects) {
        if (!solidObject.active || !solidObject.solid) {
          continue;
        }

        if (
          (solidObject.constructor.name === "AutoDoor" ||
            solidObject.constructor.name === "Door") &&
          solidObject.isOpen
        ) {
          continue;
        }

        const bounds = solidObject.getBounds();
        if (
          position.x >= bounds.x &&
          position.x < bounds.x + bounds.width &&
          position.y >= bounds.y &&
          position.y < bounds.y + bounds.height
        ) {
          return true;
        }
      }

      if (this.worldManager) {
        const room = this.worldManager.getRoomAtWorldPosition(position);
        if (room) {
          const localPos = room.worldToLocal(position);
          if (
            localPos.x >= 0 &&
            localPos.x < room.tileWidth &&
            localPos.y >= 0 &&
            localPos.y < room.tileHeight
          ) {
            const hasDoorAtPosition = this.entities.some((entity) => {
              if (
                entity.constructor.name === "AutoDoor" ||
                entity.constructor.name === "Door"
              ) {
                const entityGridX = Math.floor(entity.position.x / TILE_SIZE);
                const entityGridY = Math.floor(entity.position.y / TILE_SIZE);
                const posGridX = Math.floor(position.x / TILE_SIZE);
                const posGridY = Math.floor(position.y / TILE_SIZE);
                return entityGridX === posGridX && entityGridY === posGridY;
              }
              return false;
            });

            if (
              !hasDoorAtPosition &&
              room.collisionMap[localPos.y][localPos.x]
            ) {
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error("Error in collision detection:", error);
      return true;
    }
  }

  render(ctx) {
    if (this.isLoading) {
      this.renderLoadingScreen(ctx);
      return;
    }

    this.camera.applyTransform(ctx);

    const viewportBounds = this.camera.getViewportBounds();
    const visibleRooms = this.worldManager.getVisibleRooms(viewportBounds);

    for (const room of visibleRooms) {
      this.renderRoomBackground(ctx, room);
    }

    const visibleEntities = this.entities.filter((entity) => {
      if (!entity) {
        console.warn("⚠️ Found null entity in render filter");
        return false;
      }

      if (!entity.position) {
        console.warn(
          `⚠️ Entity ${
            entity.constructor?.name || "Unknown"
          } missing position property`
        );
        return false;
      }

      if (entity.active === false) {
        return false;
      }

      if (entity.destroyed === true) {
        return false;
      }

      try {
        return this.camera.isVisible(
          new Vector2(entity.position.x, entity.position.y),
          Math.max(
            TILE_SIZE,
            entity.width || TILE_SIZE,
            entity.height || TILE_SIZE
          )
        );
      } catch (error) {
        console.warn(
          `⚠️ Error checking visibility for entity ${entity.constructor?.name}:`,
          error
        );
        return true;
      }
    });

    const sortedEntities = visibleEntities.sort((a, b) => a.layer - b.layer);

    for (const entity of sortedEntities) {
      if (entity.visible) {
        entity.render(ctx);
      }
    }

    if (this.laserSystem) {
      this.laserSystem.render(ctx);
    }

    this.updateInteractionFeedbacks(ctx);

    this.camera.removeTransform(ctx);

    this.renderUI(ctx);
  }

  renderRoomBackground(ctx, room) {
    const roomBounds = room.getBounds();

    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(
      roomBounds.left,
      roomBounds.top,
      roomBounds.width,
      roomBounds.height
    );

    this.renderRoomFloor(ctx, room);

    this.renderRoomExits(ctx, room);
  }

  renderRoomFloor(ctx, room) {
    ctx.save();

    const gradient = ctx.createRadialGradient(
      room.worldX + room.width / 2,
      room.worldY + room.height / 2,
      0,
      room.worldX + room.width / 2,
      room.worldY + room.height / 2,
      Math.max(room.width, room.height)
    );
    gradient.addColorStop(0, "#3b4252");
    gradient.addColorStop(0.5, "#2e3440");
    gradient.addColorStop(1, "#1a1a2e");

    ctx.fillStyle = gradient;
    ctx.fillRect(room.worldX, room.worldY, room.width, room.height);

    for (let x = 0; x < room.tileWidth; x++) {
      for (let y = 0; y < room.tileHeight; y++) {
        if (!room.collisionMap[y][x]) {
          const worldX = room.worldX + x * TILE_SIZE;
          const worldY = room.worldY + y * TILE_SIZE;
          this.renderEnhancedFloorTile(ctx, worldX, worldY, x, y, room);
        }
      }
    }

    ctx.restore();
  }

  renderEnhancedFloorTile(ctx, worldX, worldY, gridX, gridY, room) {
    const nearbyWalls = this.getNearbyWallInfo(gridX, gridY, room);

    ctx.strokeStyle = nearbyWalls.count > 2 ? "#6c7b7f" : "#5e6772";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

    if (nearbyWalls.count > 0) {
      ctx.fillStyle = `rgba(46, 52, 64, ${(0.1 * nearbyWalls.count) / 8})`;
      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
    }

    const detailSeed = (gridX * 31 + gridY * 17) % 100;

    if (detailSeed < 15) {
      if (detailSeed < 5) {
        ctx.fillStyle = "#495057";
        const size = 6;
        ctx.fillRect(
          worldX + TILE_SIZE / 2 - size / 2,
          worldY + TILE_SIZE / 2 - size / 2,
          size,
          size
        );
      } else if (detailSeed < 10) {
        if (nearbyWalls.directions.length > 0) {
          ctx.strokeStyle = "#4a5568";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";

          const direction = nearbyWalls.directions[0];
          const centerX = worldX + TILE_SIZE / 2;
          const centerY = worldY + TILE_SIZE / 2;
          const arrowLength = 8;

          let endX, endY;
          switch (direction) {
            case "N":
              endX = centerX;
              endY = centerY + arrowLength;
              break;
            case "S":
              endX = centerX;
              endY = centerY - arrowLength;
              break;
            case "E":
              endX = centerX - arrowLength;
              endY = centerY;
              break;
            case "W":
              endX = centerX + arrowLength;
              endY = centerY;
              break;
            default:
              endX = centerX;
              endY = centerY + arrowLength;
          }

          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = "#6a7d8a";
        ctx.lineWidth = 1;
        ctx.strokeRect(worldX + 4, worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);

        ctx.fillStyle = "#4a5568";
        ctx.fillRect(worldX + 8, worldY + 8, TILE_SIZE - 16, TILE_SIZE - 16);
      }
    }

    if (nearbyWalls.count < 3) {
      const wearSeed = (gridX * 13 + gridY * 23) % 100;
      if (wearSeed < 8) {
        ctx.fillStyle = "rgba(95, 103, 114, 0.3)";
        ctx.beginPath();
        ctx.arc(
          worldX + TILE_SIZE / 2 + (wearSeed - 4) * 2,
          worldY + TILE_SIZE / 2 + (wearSeed - 4) * 1.5,
          2 + (wearSeed % 3),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  getNearbyWallInfo(x, y, room) {
    const directions = [
      { dx: 0, dy: -1, name: "N" },
      { dx: 0, dy: 1, name: "S" },
      { dx: 1, dy: 0, name: "E" },
      { dx: -1, dy: 0, name: "W" },
      { dx: 1, dy: -1, name: "NE" },
      { dx: -1, dy: -1, name: "NW" },
      { dx: 1, dy: 1, name: "SE" },
      { dx: -1, dy: 1, name: "SW" },
    ];

    let count = 0;
    const wallDirections = [];

    for (const dir of directions) {
      const checkX = x + dir.dx;
      const checkY = y + dir.dy;

      if (
        checkX < 0 ||
        checkX >= room.tileWidth ||
        checkY < 0 ||
        checkY >= room.tileHeight ||
        room.collisionMap[checkY][checkX]
      ) {
        count++;
        wallDirections.push(dir.name);
      }
    }

    return { count, directions: wallDirections };
  }

  renderRoomExits(ctx, room) {
    ctx.fillStyle = "#88c0d0";
    ctx.globalAlpha = 0.3;

    for (const [direction, exitPos] of Object.entries(room.exits)) {
      const worldX = room.worldX + exitPos[0] * TILE_SIZE;
      const worldY = room.worldY + exitPos[1] * TILE_SIZE;

      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
    }

    ctx.globalAlpha = 1.0;

    if (room.isExit) {
      const center = {
        x: room.worldX + room.width / 2,
        y: room.worldY + room.height / 2,
      };

      const time = Date.now() * 0.003;
      const pulseIntensity = 0.7 + 0.3 * Math.sin(time * 2);
      const portalRadius = Math.min(room.width, room.height) * 0.3;

      const portalGradient = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        portalRadius * pulseIntensity
      );
      portalGradient.addColorStop(0, `rgba(0, 255, 150, ${pulseIntensity})`);
      portalGradient.addColorStop(
        0.5,
        `rgba(0, 200, 120, ${pulseIntensity * 0.7})`
      );
      portalGradient.addColorStop(
        1,
        `rgba(0, 150, 90, ${pulseIntensity * 0.5})`
      );

      ctx.fillStyle = portalGradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, portalRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(0, 255, 150, ${pulseIntensity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(center.x, center.y, portalRadius * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "#00ff96";
      ctx.shadowBlur = 8;
      ctx.fillText("EXIT", center.x, center.y + 6);
      ctx.shadowBlur = 0;

      for (let i = 0; i < 8; i++) {
        const angle = (time + (i * Math.PI) / 4) % (Math.PI * 2);
        const particleRadius = portalRadius * 1.2;
        const particleX = center.x + Math.cos(angle) * particleRadius;
        const particleY = center.y + Math.sin(angle) * particleRadius;

        ctx.fillStyle = `rgba(0, 255, 150, ${0.8 * Math.sin(time * 3 + i)})`;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderUI(ctx) {
    if (this.worldManager.currentRoom) {
      ctx.save();
      ctx.fillStyle = COLORS.UI_TEXT;
      ctx.font = "8px Arial";
      ctx.textAlign = "left";

      const roomInfo = `Room: (${this.worldManager.currentRoom.roomX}, ${this.worldManager.currentRoom.roomY})`;
      const roomName =
        this.worldManager.currentRoom.roomData.name ||
        this.worldManager.currentRoom.roomData.id;

      ctx.fillText(roomInfo, 10, CANVAS_HEIGHT - 20);
      ctx.fillText(roomName, 10, CANVAS_HEIGHT - 10);

      ctx.restore();
    }
  }

  renderLoadingScreen(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.UI_TEXT;
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Loading Dynamic World...",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2
    );

    ctx.restore();
  }

  updatePlayerInteractions() {
    if (!this.player) return;

    const playerPos = this.player.getCenter();
    let interactionAvailable = false;

    const nearbyEntities = this.entities.filter((entity) => {
      if (!entity.active || entity.destroyed) return false;

      const entityCenter = entity.getCenter();
      const distance = playerPos.subtract(entityCenter).magnitude();
      return distance <= TILE_SIZE * 2;
    });

    for (const entity of nearbyEntities) {
      if (entity.constructor.name === "LaserEmitter") {
        const wasInRange = entity.canInteract;
        const isInRange = entity.checkPlayerInRange(this.player);

        if (isInRange) {
          interactionAvailable = true;

          if (this.player.inputState && this.player.inputState.interact) {
            const success = entity.tryInteract(this.player);
            if (success) {
              console.log(
                `Player rotated laser ${entity.id} to direction ${entity.direction}`
              );
              this.createInteractionFeedback(
                entity.getCenter(),
                "ROTATED",
                "#00bcd4"
              );
            }
          }
        }
      }
    }

    for (const entity of nearbyEntities) {
      if (entity.constructor.name === "Button") {
        const wasInRange = entity.canInteract;
        const isInRange = entity.checkPlayerInRange(this.player);

        if (isInRange) {
          interactionAvailable = true;

          if (this.player.inputState && this.player.inputState.interact) {
            const success = entity.tryInteract(this.player);
            if (success) {
              console.log(
                `Player ${entity.isOn ? "activated" : "deactivated"} button ${
                  entity.id
                }`
              );
              this.createInteractionFeedback(
                entity.getCenter(),
                entity.isOn ? "ON" : "OFF",
                entity.isOn ? "#4caf50" : "#f44336"
              );
            }
          }
        }
      }
    }

    if (this.player.setInteractionAvailable) {
      this.player.setInteractionAvailable(interactionAvailable);
    }
  }

  createInteractionFeedback(position, text, color) {
    const feedback = {
      position: position.clone(),
      text: text,
      color: color,
      life: 60,
      maxLife: 60,
      velocity: new Vector2(0, -1),
    };

    if (!this.interactionFeedbacks) {
      this.interactionFeedbacks = [];
    }

    this.interactionFeedbacks.push(feedback);
  }

  updateInteractionFeedbacks(ctx) {
    if (!this.interactionFeedbacks || this.interactionFeedbacks.length === 0)
      return;

    for (let i = this.interactionFeedbacks.length - 1; i >= 0; i--) {
      const feedback = this.interactionFeedbacks[i];

      feedback.life--;
      feedback.position = feedback.position.add(feedback.velocity);
      feedback.velocity = feedback.velocity.multiply(0.95);

      if (feedback.life <= 0) {
        this.interactionFeedbacks.splice(i, 1);
      }
    }

    ctx.save();

    for (const feedback of this.interactionFeedbacks) {
      const alpha = feedback.life / feedback.maxLife;
      ctx.fillStyle = feedback.color
        .replace(")", `, ${alpha})`)
        .replace("rgb(", "rgba(");
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = feedback.color;
      ctx.shadowBlur = 5;

      ctx.fillText(feedback.text, feedback.position.x, feedback.position.y);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  getDebugInfo() {
    const worldDebug = this.worldManager
      ? this.worldManager.getDebugInfo()
      : {};
    const constraints = this.worldManager
      ? this.worldManager.levelConstraints
      : {};

    const entityCounts = {};
    for (const entity of this.entities) {
      const type = entity.constructor.name;
      entityCounts[type] = (entityCounts[type] || 0) + 1;
    }

    return {
      level: this.levelNumber,
      entities: this.entities.length,
      entityTypes: entityCounts,
      solidObjects: this.solidObjects.length,
      walls: this.solidObjects.filter(
        (obj) => obj.constructor.name === "AdvancedWall"
      ).length,
      doors: this.solidObjects.filter((obj) => obj.constructor.name === "Door")
        .length,
      autoDoors: this.solidObjects.filter(
        (obj) => obj.constructor.name === "AutoDoor"
      ).length,
      player: this.player
        ? `${Math.floor(this.player.position.x)}, ${Math.floor(
            this.player.position.y
          )}`
        : "None",
      loading: this.isLoading,
      camera: {
        position: this.camera
          ? `${Math.floor(this.camera.position.x)}, ${Math.floor(
              this.camera.position.y
            )}`
          : "None",
        zoom: this.camera ? this.camera.zoom.toFixed(2) : "1.00",
      },
      world: {
        ...worldDebug,
        constraints: `${constraints.minRooms || 0}-${
          constraints.maxRooms || 0
        } rooms, ${constraints.maxExits || 0} exits`,
        bounds: this.worldManager
          ? `${this.worldManager.levelBounds.minX},${this.worldManager.levelBounds.minY} to ${this.worldManager.levelBounds.maxX},${this.worldManager.levelBounds.maxY}`
          : "None",
      },
    };
  }

  getPlayerPosition() {
    return this.player ? new Vector2(this.player.x, this.player.y) : null;
  }

  getCamera() {
    return this.camera;
  }

  restartLevel() {
    const currentSeed = this.worldManager ? this.worldManager.seed : null;
    this.generateLevel(
      this.levelNumber,
      currentSeed + Math.floor(Math.random() * 10000)
    );
  }

  nextLevel() {
    this.generateLevel(this.levelNumber + Math.floor(Math.random() * 10000));
  }

  generateProceduralWallLayout(room) {
    if (this.hasComplexLayout(room)) {
      return;
    }

    const layoutType = this.selectLayoutType(room);

    switch (layoutType) {
      case "pillared":
        this.generateSafePillaredLayout(room);
        break;
      case "alcoves":
        this.generateAlcoveLayout(room);
        break;
      case "corners":
        this.generateCornerEnhancements(room);
        break;
      default:
        this.addSafeWallDetails(room);
    }
  }

  selectLayoutType(room) {
    const roomSize = room.tileWidth * room.tileHeight;
    const seed = (room.roomX * 31 + room.roomY * 17) % 100;

    if (roomSize > 64) {
      const types = ["pillared", "alcoves", "corners"];
      return types[seed % types.length];
    } else {
      return "details";
    }
  }

  generateSafePillaredLayout(room) {
    const minDistanceFromEdge = 3;
    const minDistanceBetweenPillars = 5;

    const pillarPositions = [];

    for (let attempts = 0; attempts < 8; attempts++) {
      const x =
        minDistanceFromEdge +
        Math.floor(Math.random() * (room.tileWidth - 2 * minDistanceFromEdge));
      const y =
        minDistanceFromEdge +
        Math.floor(Math.random() * (room.tileHeight - 2 * minDistanceFromEdge));

      let isSafe = true;

      for (const pillar of pillarPositions) {
        const distance = Math.sqrt((x - pillar.x) ** 2 + (y - pillar.y) ** 2);
        if (distance < minDistanceBetweenPillars) {
          isSafe = false;
          break;
        }
      }

      if (room.exits) {
        for (const [direction, exitPos] of Object.entries(room.exits)) {
          const exitDistance = Math.sqrt(
            (x - exitPos[0]) ** 2 + (y - exitPos[1]) ** 2
          );
          if (exitDistance < 3) {
            isSafe = false;
            break;
          }
        }
      }

      if (isSafe && !room.collisionMap[y][x]) {
        room.collisionMap[y][x] = true;
        pillarPositions.push({ x, y });

        if (pillarPositions.length >= 3) break;
      }
    }
  }

  generateAlcoveLayout(room) {
    for (let x = 1; x < room.tileWidth - 1; x++) {
      for (let y = 1; y < room.tileHeight - 1; y++) {
        if (room.collisionMap[y][x] && this.isPerimeterWall(x, y, room)) {
          if (Math.random() > 0.85) {
            if (this.canSafelyRemoveWall(x, y, room)) {
              room.collisionMap[y][x] = false;
            }
          }
        }
      }
    }
  }

  generateCornerEnhancements(room) {
    const corners = [
      { x: 1, y: 1 },
      { x: room.tileWidth - 2, y: 1 },
      { x: 1, y: room.tileHeight - 2 },
      { x: room.tileWidth - 2, y: room.tileHeight - 2 },
    ];

    for (const corner of corners) {
      if (!room.collisionMap[corner.y][corner.x] && Math.random() > 0.6) {
        const surroundingClearSpace = this.checkClearSpace(
          corner.x,
          corner.y,
          room,
          2
        );
        if (surroundingClearSpace > 6) {
          room.collisionMap[corner.y][corner.x] = true;
        }
      }
    }
  }

  isPerimeterWall(x, y, room) {
    return (
      x === 0 ||
      x === room.tileWidth - 1 ||
      y === 0 ||
      y === room.tileHeight - 1
    );
  }

  canSafelyRemoveWall(x, y, room) {
    if (
      (x <= 1 || x >= room.tileWidth - 2) &&
      (y <= 1 || y >= room.tileHeight - 2)
    ) {
      return false;
    }

    if (room.exits) {
      for (const [direction, exitPos] of Object.entries(room.exits)) {
        const distance = Math.sqrt(
          (x - exitPos[0]) ** 2 + (y - exitPos[1]) ** 2
        );
        if (distance < 2) {
          return false;
        }
      }
    }

    return true;
  }

  checkClearSpace(x, y, room, radius) {
    let clearCount = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const checkX = x + dx;
        const checkY = y + dy;
        if (
          checkX >= 0 &&
          checkX < room.tileWidth &&
          checkY >= 0 &&
          checkY < room.tileHeight &&
          !room.collisionMap[checkY][checkX]
        ) {
          clearCount++;
        }
      }
    }
    return clearCount;
  }

  addSafeWallDetails(room) {
    for (let y = 0; y < room.tileHeight; y++) {
      for (let x = 0; x < room.tileWidth; x++) {
        if (room.collisionMap[y][x]) {
        }
      }
    }
  }

  getWallsAtPosition(worldPos) {
    const tolerance = TILE_SIZE * 0.4;

    return this.entities.filter((entity) => {
      if (
        entity.constructor.name === "AdvancedWall" &&
        !entity.destroyed &&
        entity.active
      ) {
        const dx = Math.abs(entity.position.x - worldPos.x);
        const dy = Math.abs(entity.position.y - worldPos.y);
        return dx < tolerance && dy < tolerance;
      }
      return false;
    });
  }

  setLaserSystem(laserSystem) {
    this.laserSystem = laserSystem;
  }

  monitorEntityHealth() {
    if (!this.entityHealthMonitor) {
      this.entityHealthMonitor = {
        lastEntityCount: this.entities.length,
        lastCheck: Date.now(),
      };
      return;
    }

    const currentEntityCount = this.entities.length;
    const now = Date.now();
    const timeSinceLastCheck = now - this.entityHealthMonitor.lastCheck;

    if (
      currentEntityCount < this.entityHealthMonitor.lastEntityCount &&
      timeSinceLastCheck < 5000
    ) {
      const entitiesLost =
        this.entityHealthMonitor.lastEntityCount - currentEntityCount;
      console.warn(
        `⚠️ WARNING: Lost ${entitiesLost} entities in ${timeSinceLastCheck}ms - this might be unexpected!`
      );

      const entityTypes = {};
      for (const entity of this.entities) {
        const type = entity.constructor.name;
        entityTypes[type] = (entityTypes[type] || 0) + 1;
      }
      console.log("📊 Current entity types:", entityTypes);
    }

    this.entityHealthMonitor.lastEntityCount = currentEntityCount;
    this.entityHealthMonitor.lastCheck = now;
  }

  setUIManager(uiManager) {
    this.uiManager = uiManager;
  }
}

class AdvancedWall extends Entity {
  constructor(
    x,
    y,
    wallType = "basic",
    connections = {},
    variant = "standard"
  ) {
    super(x, y, TILE_SIZE, TILE_SIZE);
    this.solid = true;
    this.layer = 0;
    this.wallType = wallType;
    this.connections = connections;
    this.variant = variant;
    this.animationTimer = Math.random() * 1000; // For subtle animations
  }

  getWallConfig() {
    const configs = {
      basic: { thickness: 1.0, height: 1.0, detail: "simple" },
      straight: { thickness: 1.0, height: 1.0, detail: "lined" },
      corner: { thickness: 1.2, height: 1.0, detail: "beveled" },
      junction_t: { thickness: 1.3, height: 1.1, detail: "reinforced" },
      junction_cross: { thickness: 1.4, height: 1.2, detail: "heavy" },
      endcap: { thickness: 0.9, height: 1.0, detail: "capped" },
      pillar: { thickness: 0.8, height: 1.3, detail: "decorative" },
    };

    return configs[this.wallType] || configs.basic;
  }

  getVariantStyle() {
    const styles = {
      standard: {
        primaryColor: "#0f3460",
        secondaryColor: "#1e5f8b",
        accentColor: "#2d8bb8",
        pattern: "solid",
      },
      reinforced: {
        primaryColor: "#2c3e50",
        secondaryColor: "#34495e",
        accentColor: "#5d6d7e",
        pattern: "plated",
      },
      damaged: {
        primaryColor: "#5d4e75",
        secondaryColor: "#85677b",
        accentColor: "#a08193",
        pattern: "cracked",
      },
      paneled: {
        primaryColor: "#34495e",
        secondaryColor: "#566573",
        accentColor: "#798292",
        pattern: "panels",
      },
      riveted: {
        primaryColor: "#212f3d",
        secondaryColor: "#2e4053",
        accentColor: "#455a64",
        pattern: "rivets",
      },
      rounded: {
        primaryColor: "#283747",
        secondaryColor: "#3e515f",
        accentColor: "#5a6c77",
        pattern: "smooth",
      },
      beveled: {
        primaryColor: "#1b2631",
        secondaryColor: "#2c3e50",
        accentColor: "#3e515f",
        pattern: "angled",
      },
      heavy: {
        primaryColor: "#17202a",
        secondaryColor: "#212f3d",
        accentColor: "#2c3e50",
        pattern: "thick",
      },
      capped: {
        primaryColor: "#2e4053",
        secondaryColor: "#3e515f",
        accentColor: "#5a6c77",
        pattern: "capped",
      },
      tapered: {
        primaryColor: "#34495e",
        secondaryColor: "#455a64",
        accentColor: "#607d8b",
        pattern: "tapered",
      },
      decorative: {
        primaryColor: "#1a237e",
        secondaryColor: "#3949ab",
        accentColor: "#5c6bc0",
        pattern: "ornate",
      },
      support: {
        primaryColor: "#263238",
        secondaryColor: "#37474f",
        accentColor: "#546e7a",
        pattern: "structural",
      },
    };

    return styles[this.variant] || styles.standard;
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();

    const config = this.getWallConfig();
    const style = this.getVariantStyle();

    this.animationTimer += 0.01;
    const pulseIntensity = 0.95 + 0.05 * Math.sin(this.animationTimer);

    const wallWidth = this.width * config.thickness;
    const wallHeight = this.height * config.height;
    const offsetX = (this.width - wallWidth) / 2;
    const offsetY = (this.height - wallHeight) / 2;

    const wallX = this.position.x + offsetX;
    const wallY = this.position.y + offsetY;

    const gradient = ctx.createLinearGradient(
      wallX,
      wallY,
      wallX + wallWidth,
      wallY + wallHeight
    );
    gradient.addColorStop(
      0,
      this.adjustColorBrightness(style.primaryColor, pulseIntensity)
    );
    gradient.addColorStop(0.5, style.secondaryColor);
    gradient.addColorStop(1, style.accentColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(wallX, wallY, wallWidth, wallHeight);

    this.renderWallPattern(ctx, wallX, wallY, wallWidth, wallHeight, style);

    this.renderConnections(ctx, style);

    const borderWidth =
      config.detail === "heavy" ? 3 : config.detail === "reinforced" ? 2 : 1;
    ctx.strokeStyle = style.accentColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(wallX, wallY, wallWidth, wallHeight);

    if (config.thickness > 1.0) {
      ctx.strokeStyle = this.adjustColorBrightness(style.secondaryColor, 1.2);
      ctx.lineWidth = 1;
      ctx.strokeRect(wallX + 2, wallY + 2, wallWidth - 4, wallHeight - 4);
    }

    this.renderTypeSpecificDetails(
      ctx,
      wallX,
      wallY,
      wallWidth,
      wallHeight,
      config,
      style
    );

    ctx.restore();
  }

  renderWallPattern(ctx, x, y, w, h, style) {
    ctx.save();

    switch (style.pattern) {
      case "plated":
        for (let py = 0; py < Math.floor(h / 16); py++) {
          for (let px = 0; px < Math.floor(w / 16); px++) {
            const plateX = x + px * 16 + 2;
            const plateY = y + py * 16 + 2;
            ctx.strokeStyle = style.accentColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(plateX, plateY, 12, 12);
          }
        }
        break;

      case "cracked":
        ctx.strokeStyle = this.adjustColorBrightness(style.primaryColor, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const startX = x + (w / 4) * (i + 1);
          const startY = y + Math.random() * h;
          const endX = startX + (Math.random() - 0.5) * 20;
          const endY = startY + (Math.random() - 0.5) * 20;
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
        }
        ctx.stroke();
        break;

      case "panels":
        const panelWidth = w / 3;
        const panelHeight = h / 2;
        for (let py = 0; py < 2; py++) {
          for (let px = 0; px < 3; px++) {
            const panelX = x + px * panelWidth + 1;
            const panelY = y + py * panelHeight + 1;
            ctx.fillStyle = this.adjustColorBrightness(
              style.secondaryColor,
              0.9
            );
            ctx.fillRect(panelX, panelY, panelWidth - 2, panelHeight - 2);
          }
        }
        break;

      case "rivets":
        ctx.fillStyle = style.accentColor;
        const rivetPositions = [
          { x: x + 8, y: y + 8 },
          { x: x + w - 8, y: y + 8 },
          { x: x + 8, y: y + h - 8 },
          { x: x + w - 8, y: y + h - 8 },
          { x: x + w / 2, y: y + h / 2 },
        ];
        rivetPositions.forEach((pos) => {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
        break;

      case "ornate":
        ctx.strokeStyle = style.accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w / 4, y + h / 4);
        ctx.lineTo(x + (3 * w) / 4, y + h / 4);
        ctx.lineTo(x + (3 * w) / 4, y + (3 * h) / 4);
        ctx.lineTo(x + w / 4, y + (3 * h) / 4);
        ctx.closePath();
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  renderConnections(ctx, style) {
    if (!this.connections || !this.connections.connections) return;

    const { connections } = this.connections;
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    ctx.strokeStyle = style.accentColor;
    ctx.lineWidth = 2;

    const connectionLines = {
      N: { x1: centerX, y1: this.position.y, x2: centerX, y2: centerY },
      S: {
        x1: centerX,
        y1: centerY,
        x2: centerX,
        y2: this.position.y + this.height,
      },
      E: {
        x1: centerX,
        y1: centerY,
        x2: this.position.x + this.width,
        y2: centerY,
      },
      W: { x1: this.position.x, y1: centerY, x2: centerX, y2: centerY },
    };

    for (const [dir, hasConnection] of Object.entries(connections)) {
      if (hasConnection && connectionLines[dir]) {
        const line = connectionLines[dir];
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }
    }
  }

  renderTypeSpecificDetails(ctx, x, y, w, h, config, style) {
    switch (this.wallType) {
      case "pillar":
        ctx.fillStyle = style.accentColor;
        ctx.fillRect(x + w / 4, y, w / 2, 4);
        ctx.fillRect(x + w / 4, y + h - 4, w / 2, 4);
        break;

      case "junction_cross":
        ctx.fillStyle = style.accentColor;
        ctx.fillRect(x + w / 2 - 2, y + h / 4, 4, h / 2);
        ctx.fillRect(x + w / 4, y + h / 2 - 2, w / 2, 4);
        break;

      case "endcap":
        ctx.fillStyle = this.adjustColorBrightness(style.accentColor, 1.2);
        const capSize = Math.min(w, h) / 4;
        ctx.fillRect(
          x + w / 2 - capSize / 2,
          y + h / 2 - capSize / 2,
          capSize,
          capSize
        );
        break;
    }
  }

  adjustColorBrightness(color, factor) {
    const hex = color.replace("#", "");
    const r = Math.min(
      255,
      Math.floor(parseInt(hex.substr(0, 2), 16) * factor)
    );
    const g = Math.min(
      255,
      Math.floor(parseInt(hex.substr(2, 2), 16) * factor)
    );
    const b = Math.min(
      255,
      Math.floor(parseInt(hex.substr(4, 2), 16) * factor)
    );
    return `rgb(${r}, ${g}, ${b})`;
  }
}
