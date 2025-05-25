import { Vector2, SeededRandom, deepClone } from "./utils.js";
import { TILE_SIZE } from "./constants.js";

/**
 * Kordinat ve Oda sistemi
 */
export class WorldPosition {
  constructor(roomX = 0, roomY = 0, localX = 0, localY = 0) {
    this.roomX = roomX; // Room grid coordinate
    this.roomY = roomY; // Room grid coordinate
    this.localX = localX; // Local position within room (in tiles)
    this.localY = localY; // Local position within room (in tiles)
  }

  /**
   * Dünya piksel koordinatlarına dönüştür
   * @param {WorldManager} worldManager - Dünya manager referansı
   * @returns {Vector2} Dünya pixel konumu
   */
  toWorldPixels(worldManager) {
    const room = worldManager.getRoom(this.roomX, this.roomY);
    if (!room) return new Vector2(0, 0);

    return new Vector2(
      room.worldX + this.localX * TILE_SIZE,
      room.worldY + this.localY * TILE_SIZE
    );
  }

  clone() {
    return new WorldPosition(this.roomX, this.roomY, this.localX, this.localY);
  }

  toString() {
    return `WorldPos(${this.roomX},${this.roomY})[${this.localX},${this.localY}]`;
  }
}

/**
 * Room instance in the world
 */
export class WorldRoom {
  constructor(roomData, worldX, worldY, roomX, roomY) {
    this.roomData = deepClone(roomData); // Tile template data
    this.worldX = worldX; // Dünya pixel konumu
    this.worldY = worldY; // Dünya pixel konumu
    this.roomX = roomX; // Oda kare konumu
    this.roomY = roomY; // Oda kare konumu

    // Oda için collision haritası
    this.collisionMap = this.createCollisionMap();

    // Oda özellikleri
    this.width = this.tileWidth * TILE_SIZE; // Pixel genişliği
    this.height = this.tileHeight * TILE_SIZE; // Pixel yüksekliği

    // Bağlantı bilgileri
    this.exits = this.normalizeExits(roomData.exits || {});
    this.connections = new Map(); // Yön -> bağlı oda

    this.entities = [];

    this.isLoaded = false;
    this.isVisible = false;
  }

  /**
   * Create collision map from room data
   * @returns {Array} 2D collision array
   */
  createCollisionMap() {
    const collision = this.roomData.collision || [];
    const map = [];

    const actualHeight = collision.length;
    const actualWidth =
      collision.length > 0
        ? collision[0].length
        : this.roomData.size
        ? this.roomData.size[0]
        : 4;

    this.tileHeight =
      actualHeight || (this.roomData.size ? this.roomData.size[1] : 4);
    this.tileWidth =
      actualWidth || (this.roomData.size ? this.roomData.size[0] : 4);

    for (let y = 0; y < this.tileHeight; y++) {
      const row = [];
      for (let x = 0; x < this.tileWidth; x++) {
        if (y < collision.length && x < collision[y].length) {
          row.push(collision[y][x] === "#");
        } else {
          row.push(false);
        }
      }
      map.push(row);
    }

    return map;
  }

  normalizeExits(exits) {
    const normalizedExits = {};

    for (const [direction, position] of Object.entries(exits)) {
      // Clamp positions to room bounds
      const x = Math.max(0, Math.min(position[0], this.tileWidth - 1));
      const y = Math.max(0, Math.min(position[1], this.tileHeight - 1));
      normalizedExits[direction] = [x, y];
    }

    return normalizedExits;
  }

  getBounds() {
    return {
      left: this.worldX,
      right: this.worldX + this.width,
      top: this.worldY,
      bottom: this.worldY + this.height,
      width: this.width,
      height: this.height,
    };
  }

  containsWorldPosition(worldPos) {
    const bounds = this.getBounds();
    return (
      worldPos.x >= bounds.left &&
      worldPos.x < bounds.right &&
      worldPos.y >= bounds.top &&
      worldPos.y < bounds.bottom
    );
  }

  worldToLocal(worldPos) {
    return new Vector2(
      Math.floor((worldPos.x - this.worldX) / TILE_SIZE),
      Math.floor((worldPos.y - this.worldY) / TILE_SIZE)
    );
  }

  localToWorld(localPos) {
    return new Vector2(
      this.worldX + localPos.x * TILE_SIZE,
      this.worldY + localPos.y * TILE_SIZE
    );
  }

  hasCollisionAt(localPos) {
    if (
      localPos.x < 0 ||
      localPos.x >= this.tileWidth ||
      localPos.y < 0 ||
      localPos.y >= this.tileHeight
    ) {
      return true;
    }

    return this.collisionMap[localPos.y][localPos.x];
  }
}

export class WorldManager {
  constructor(tileLoader) {
    this.tileLoader = tileLoader;
    this.rng = new SeededRandom();

    this.rooms = new Map();
    this.roomGrid = new Map();
    this.loadedRooms = new Set();

    this.seed = 0;
    this.startRoom = null;
    this.currentRoom = null;

    this.levelConstraints = {
      maxRooms: 10,
      maxExits: 1,
      maxWidth: 4,
      maxHeight: 4,
      minRooms: 5,
    };

    this.generatedRooms = 0;
    this.exitRoomsGenerated = 0;
    this.levelBounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    this.levelComplete = false;

    this.roomSpacing = 64;
    this.maxLoadedRooms = 25;
    this.loadRadius = 2;
  }

  initialize(seed, levelNumber = 1) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);

    this.adjustConstraintsForLevel(levelNumber);

    this.rooms.clear();
    this.roomGrid.clear();
    this.loadedRooms.clear();

    this.generatedRooms = 0;
    this.exitRoomsGenerated = 0;
    this.levelComplete = false;

    this.generateFiniteLevel();
  }

  adjustConstraintsForLevel(levelNumber) {
    const baseConstraints = {
      maxRooms: Math.min(6 + Math.floor(levelNumber / 2), 15),
      maxExits: 1,
      maxWidth: Math.min(3 + Math.floor(levelNumber / 3), 5),
      maxHeight: Math.min(3 + Math.floor(levelNumber / 3), 5),
      minRooms: Math.min(4 + Math.floor(levelNumber / 4), 8),
    };

    this.levelConstraints = { ...baseConstraints };

    this.levelBounds = {
      minX: 0,
      maxX: this.levelConstraints.maxWidth - 1,
      minY: 0,
      maxY: this.levelConstraints.maxHeight - 1,
    };

    console.log(`Level ${levelNumber} constraints:`, this.levelConstraints);
    console.log(`Level bounds:`, this.levelBounds);
  }

  generateFiniteLevel() {
    this.generateStartRoom();

    const roomsToGenerate = this.levelConstraints.maxRooms - 1;
    const generationQueue = [{ x: 0, y: 0 }];
    const generatedPositions = new Set(["0,0"]);

    while (
      this.generatedRooms < roomsToGenerate &&
      generationQueue.length > 0
    ) {
      const currentPos = generationQueue.shift();
      const adjacentPositions = this.getValidAdjacentPositions(
        currentPos,
        generatedPositions
      );

      const roomsToAdd = Math.min(
        this.rng.randomInt(1, 3),
        roomsToGenerate - this.generatedRooms,
        adjacentPositions.length
      );

      for (let i = 0; i < roomsToAdd && adjacentPositions.length > 0; i++) {
        const posIndex = this.rng.randomInt(0, adjacentPositions.length);
        const newPos = adjacentPositions.splice(posIndex, 1)[0];

        if (this.generateRoomAt(newPos.x, newPos.y)) {
          generationQueue.push(newPos);
          generatedPositions.add(`${newPos.x},${newPos.y}`);
        }
      }
    }

    this.ensureMinimumRooms();

    this.generateExitRoom();
  }

  getValidAdjacentPositions(currentPos, generatedPositions) {
    const adjacent = [
      { x: currentPos.x, y: currentPos.y - 1 }, // North
      { x: currentPos.x, y: currentPos.y + 1 }, // South
      { x: currentPos.x + 1, y: currentPos.y }, // East
      { x: currentPos.x - 1, y: currentPos.y }, // West
    ];

    return adjacent.filter((pos) => {
      const posKey = `${pos.x},${pos.y}`;
      return (
        !generatedPositions.has(posKey) &&
        this.isWithinLevelBounds(pos.x, pos.y) &&
        !this.getRoom(pos.x, pos.y)
      );
    });
  }

  isWithinLevelBounds(roomX, roomY) {
    return (
      roomX >= this.levelBounds.minX &&
      roomX <= this.levelBounds.maxX &&
      roomY >= this.levelBounds.minY &&
      roomY <= this.levelBounds.maxY
    );
  }

  ensureMinimumRooms() {
    const totalRooms = this.generatedRooms + 1; // +1 for start room
    if (totalRooms < this.levelConstraints.minRooms) {
      const roomsNeeded = this.levelConstraints.minRooms - totalRooms;
      console.log(`Generating ${roomsNeeded} additional rooms to meet minimum`);

      const availablePositions = [];
      for (let x = this.levelBounds.minX; x <= this.levelBounds.maxX; x++) {
        for (let y = this.levelBounds.minY; y <= this.levelBounds.maxY; y++) {
          if (!this.getRoom(x, y) && this.hasAdjacentRoom(x, y)) {
            availablePositions.push({ x, y });
          }
        }
      }

      for (let i = 0; i < roomsNeeded && availablePositions.length > 0; i++) {
        const posIndex = this.rng.randomInt(0, availablePositions.length);
        const pos = availablePositions.splice(posIndex, 1)[0];
        this.generateRoomAt(pos.x, pos.y);
      }
    }
  }

  hasAdjacentRoom(roomX, roomY) {
    const adjacent = [
      { x: roomX, y: roomY - 1 },
      { x: roomX, y: roomY + 1 },
      { x: roomX + 1, y: roomY },
      { x: roomX - 1, y: roomY },
    ];

    return adjacent.some((pos) => this.getRoom(pos.x, pos.y) !== null);
  }

  generateExitRoom() {
    if (this.exitRoomsGenerated >= this.levelConstraints.maxExits) return;

    const allRooms = Array.from(this.rooms.values());
    if (allRooms.length === 0) return;

    let exitRoom = null;
    let maxDistance = -1;

    for (const room of allRooms) {
      const distance = Math.abs(room.roomX) + Math.abs(room.roomY);
      if (distance > maxDistance) {
        maxDistance = distance;
        exitRoom = room;
      }
    }

    if (exitRoom) {
      exitRoom.isExit = true;
      exitRoom.roomData.exit = true;
      this.exitRoomsGenerated++;
      console.log(
        `Exit room created at (${exitRoom.roomX}, ${exitRoom.roomY})`
      );
    }
  }

  generateStartRoom() {
    const startTiles = this.tileLoader.filterTiles((tile) => tile.start);
    if (startTiles.length === 0) {
      return;
    }

    const startTile = this.rng.choice(startTiles);
    this.startRoom = this.createRoom(startTile, 0, 0, 0, 0);
    this.currentRoom = this.startRoom;
  }

  createRoom(roomData, worldX, worldY, roomX, roomY) {
    const room = new WorldRoom(roomData, worldX, worldY, roomX, roomY);
    const roomKey = this.getRoomKey(roomX, roomY);

    this.rooms.set(roomKey, room);
    this.roomGrid.set(`${roomX},${roomY}`, room);

    return room;
  }

  getRoomKey(roomX, roomY) {
    return `${roomX},${roomY}`;
  }

  getRoom(roomX, roomY) {
    return this.roomGrid.get(`${roomX},${roomY}`) || null;
  }

  getRoomAtWorldPosition(worldPos) {
    for (const room of this.rooms.values()) {
      if (room.containsWorldPosition(worldPos)) {
        return room;
      }
    }
    return null;
  }

  update(playerWorldPos) {
    const currentRoom = this.getRoomAtWorldPosition(playerWorldPos);
    if (currentRoom && currentRoom !== this.currentRoom) {
      this.currentRoom = currentRoom;
      console.log(
        `Player entered room at (${currentRoom.roomX}, ${currentRoom.roomY})`
      );
    }
  }

  streamRoomsAroundPosition(centerRoomX, centerRoomY) {
    console.log("Room streaming disabled");
  }

  generateRoomAt(roomX, roomY) {
    // Oda zaten mevcut ise oluşturma
    if (this.getRoom(roomX, roomY)) return false;

    // Seviyeye göre kısıtlamaları kontrol et
    if (!this.isWithinLevelBounds(roomX, roomY)) {
      console.log(`Oda (${roomX}, ${roomY}) seviye sınırları dışında`);
      return false;
    }

    if (this.generatedRooms >= this.levelConstraints.maxRooms - 1) {
      // -1 for start room
      console.log(
        `Maksimum oda sayısına ulaşıldı (${this.levelConstraints.maxRooms})`
      );
      return false;
    }

    // Bu konum için gerekli bağlantıları bul
    const requiredConnections = this.getRequiredConnections(roomX, roomY);

    // Uygun tile şablonlarını bul
    const suitableTiles = this.findSuitableTiles(requiredConnections, false);
    if (suitableTiles.length === 0) {
      console.warn(`Bu konum için uygun tile yok: (${roomX}, ${roomY})`);
      return false;
    }

    // Rastgele uygun tile seç
    const chosenTile = this.rng.choice(suitableTiles);

    // Komşu odaların konumuna göre dünya konumunu hesapla
    const { worldX, worldY } = this.calculateOptimalRoomPosition(
      roomX,
      roomY,
      chosenTile
    );

    // Oda oluştur
    const room = this.createRoom(chosenTile, worldX, worldY, roomX, roomY);
    this.generatedRooms++;

    console.log(
      `Oda "${chosenTile.id}" (${roomX}, ${roomY}) -> dünya (${worldX}, ${worldY}) [${this.generatedRooms}/${this.levelConstraints.maxRooms}]`
    );
    return true;
  }

  /**
   * Komşu mevcut odaların konumuna göre optimal oda konumunu hesapla
   * @param {number} roomX - Oda kare konumu X
   * @param {number} roomY - Oda kare konumu Y
   * @param {Object} roomData - Oda şablon verisi
   * @returns {Object} Dünya konumu {worldX, worldY}
   */
  calculateOptimalRoomPosition(roomX, roomY, roomData) {
    // Oda boyutlarını şablon verisinden hesapla
    const roomWidth = (roomData.size ? roomData.size[0] : 6) * TILE_SIZE;
    const roomHeight = (roomData.size ? roomData.size[1] : 6) * TILE_SIZE;

    // Komşu odaların konumuna göre konumunu hesapla
    const adjacentRooms = {
      west: this.getRoom(roomX - 1, roomY), // Sol
      east: this.getRoom(roomX + 1, roomY), // Sağ
      north: this.getRoom(roomX, roomY - 1), // Üst
      south: this.getRoom(roomX, roomY + 1), // Alt
    };

    let worldX = 0;
    let worldY = 0;

    // Komşu odaların konumuna göre konumunu hesapla
    if (adjacentRooms.west) {
      // Sol odanın sağında, 1 piksel kaplama ile konumlandır
      worldX = adjacentRooms.west.worldX + adjacentRooms.west.width - TILE_SIZE;
    } else if (adjacentRooms.east) {
      // Sağ odanın solunda, 1 piksel kaplama ile konumlandır
      worldX = adjacentRooms.east.worldX + TILE_SIZE - roomWidth;
    } else {
      // Hiç yatay komşu yoksa, hesaplanan konumu kullan
      worldX = this.calculateRoomWorldPosition(roomX, roomY).worldX;
    }

    if (adjacentRooms.north) {
      // Üst odanın altında, 1 piksel kaplama ile konumlandır
      worldY =
        adjacentRooms.north.worldY + adjacentRooms.north.height - TILE_SIZE;
    } else if (adjacentRooms.south) {
      // Alt odanın üstünde, 1 piksel kaplama ile konumlandır
      worldY = adjacentRooms.south.worldY + TILE_SIZE - roomHeight;
    } else {
      // Hiç dikey komşu yoksa, hesaplanan konumu kullan
      worldY = this.calculateRoomWorldPosition(roomX, roomY).worldY;
    }

    // Koordinatların negatif olmayacağını kontrol et - gerekirse offset
    const minWorldX = 0;
    const minWorldY = 0;

    if (worldX < minWorldX) {
      const offsetX = minWorldX - worldX;
      worldX = minWorldX;
      this.adjustAllRoomsPosition(offsetX, 0);
    }

    if (worldY < minWorldY) {
      const offsetY = minWorldY - worldY;
      worldY = minWorldY;
      this.adjustAllRoomsPosition(0, offsetY);
    }

    // Pozisyonu doğrula - 1 piksel kaplama ile çakışma
    const validatedPosition = this.validateRoomPosition(
      worldX,
      worldY,
      roomWidth,
      roomHeight,
      roomX,
      roomY
    );

    return validatedPosition;
  }

  /**
   * Tüm mevcut odaların konumunu bir offset ile ayarla (negatif koordinatları önlemek için kullanılır)
   * @param {number} offsetX - Uygulanacak X offset
   * @param {number} offsetY - Uygulanacak Y offset
   */
  adjustAllRoomsPosition(offsetX, offsetY) {
    if (offsetX === 0 && offsetY === 0) return;

    console.log(
      `Tüm oda konumlarını offset ile ayarla (${offsetX}, ${offsetY})`
    );

    for (const room of this.rooms.values()) {
      room.worldX += offsetX;
      room.worldY += offsetY;

      // Also update any entities in the room
      for (const entity of room.entities || []) {
        if (entity && entity.position) {
          entity.position.x += offsetX;
          entity.position.y += offsetY;
        }
      }
    }
  }

  /**
   * Oda konumunu doğrula - 1 piksel kaplama ile çakışma
   * @param {number} worldX - Önerilen dünya X konumu
   * @param {number} worldY - Önerilen dünya Y konumu
   * @param {number} roomWidth - Oda genişliği piksel cinsinden
   * @param {number} roomHeight - Oda yüksekliği piksel cinsinden
   * @param {number} roomX - Oda kare konumu X (çıkarma için)
   * @param {number} roomY - Oda kare konumu Y (çıkarma için)
   * @returns {Object} Doğrulanmış dünya konumu {worldX, worldY}
   */
  validateRoomPosition(worldX, worldY, roomWidth, roomHeight, roomX, roomY) {
    const proposedBounds = {
      left: worldX,
      right: worldX + roomWidth,
      top: worldY,
      bottom: worldY + roomHeight,
    };

    // Tüm mevcut odaları kontrol et
    for (const room of this.rooms.values()) {
      // Konumlandırılacak olan odayı atla
      if (room.roomX === roomX && room.roomY === roomY) continue;

      const roomBounds = room.getBounds();

      // Çakışma miktarlarını hesapla
      const overlapLeft = Math.max(
        0,
        Math.min(proposedBounds.right, roomBounds.right) -
          Math.max(proposedBounds.left, roomBounds.left)
      );
      const overlapTop = Math.max(
        0,
        Math.min(proposedBounds.bottom, roomBounds.bottom) -
          Math.max(proposedBounds.top, roomBounds.top)
      );

      const hasOverlap = overlapLeft > 0 && overlapTop > 0;

      if (hasOverlap) {
        // Bu, tam olarak 1 piksel kaplama ile çakışan komşu bir oda mı?
        const isAdjacentHorizontally =
          Math.abs(room.roomX - roomX) === 1 && room.roomY === roomY;
        const isAdjacentVertically =
          Math.abs(room.roomY - roomY) === 1 && room.roomX === roomX;

        if (isAdjacentHorizontally || isAdjacentVertically) {
          // Komşu odalar için, tam olarak 1 piksel kaplama ile çakışma istiyoruz
          if (isAdjacentHorizontally && overlapLeft !== TILE_SIZE) {
            console.log(
              `Yatay çakışmayı 1 piksel ile ayarla (${roomX}, ${roomY})`
            );
            if (room.roomX < roomX) {
              // Oda sola doğru, oda konumunu tam olarak 1 piksel kaplama ile çakışacak şekilde ayarla
              worldX = roomBounds.right - TILE_SIZE;
            } else {
              // Oda sağa doğru, oda konumunu tam olarak 1 piksel kaplama ile çakışacak şekilde ayarla
              worldX = roomBounds.left + TILE_SIZE - roomWidth;
            }
          }

          if (isAdjacentVertically && overlapTop !== TILE_SIZE) {
            console.log(
              `Dikey çakışmayı 1 piksel ile ayarla (${roomX}, ${roomY})`
            );
            if (room.roomY < roomY) {
              // Oda yukarıda, oda konumunu tam olarak 1 piksel kaplama ile çakışacak şekilde ayarla
              worldY = roomBounds.bottom - TILE_SIZE;
            } else {
              // Oda aşağıda, oda konumunu tam olarak 1 piksel kaplama ile çakışacak şekilde ayarla
              worldY = roomBounds.top + TILE_SIZE - roomHeight;
            }
          }
        } else {
          // Komşu olmayan odalar için, çakışmayı önle
          console.warn(
            `Komşu olmayan oda çakışması tespit edildi (${worldX}, ${worldY}), konumu ayarla...`
          );

          // Çakışmayı tamamen önle
          if (
            proposedBounds.left < roomBounds.right &&
            proposedBounds.right > roomBounds.left
          ) {
            worldX = roomBounds.right;
          }

          if (
            proposedBounds.top < roomBounds.bottom &&
            proposedBounds.bottom > roomBounds.top
          ) {
            worldY = roomBounds.bottom;
          }

          console.log(`Oda konumunu (${worldX}, ${worldY}) ile ayarla`);
        }
      }
    }

    return { worldX, worldY };
  }

  /**
   * Oda konumuna göre gerekli bağlantıları al
   * @param {number} roomX - Oda X
   * @param {number} roomY - Oda Y
   * @returns {Array} Gerekli bağlantı yönleri
   */
  getRequiredConnections(roomX, roomY) {
    const connections = [];

    // Komşu odaları kontrol et
    const adjacent = [
      { dx: 0, dy: -1, dir: "N", opposite: "S" },
      { dx: 0, dy: 1, dir: "S", opposite: "N" },
      { dx: 1, dy: 0, dir: "E", opposite: "W" },
      { dx: -1, dy: 0, dir: "W", opposite: "E" },
    ];

    for (const adj of adjacent) {
      const adjRoom = this.getRoom(roomX + adj.dx, roomY + adj.dy);
      if (adjRoom && adjRoom.exits[adj.opposite]) {
        connections.push(adj.dir);
      }
    }

    return connections;
  }

  /**
   * Gerekli bağlantılar için uygun tile'ları bul
   * @param {Array} requiredConnections - Gerekli bağlantı yönleri
   * @param {boolean} allowExit - Çıkış tile'larını izin ver
   * @returns {Array} Uygun tile şablonları
   */
  findSuitableTiles(requiredConnections, allowExit = true) {
    return this.tileLoader.filterTiles((tile) => {
      // Bağlam göre özel tile'ları atla
      if (tile.start) return false; // Hiçbir zaman başlangıç tile'larını kullanma
      if (tile.exit && !allowExit) return false; // Çıkış tile'larını yalnızca istenildiğinde kullan

      // Tile'ın tüm gerekli bağlantıları var mı?
      const tileConnections = Object.keys(tile.exits || {});
      return requiredConnections.every((dir) => tileConnections.includes(dir));
    });
  }

  /**
   * Oda kare konumuna göre dünya konumunu hesapla
   * @param {number} roomX - Oda kare konumu X
   * @param {number} roomY - Oda kare konumu Y
   * @returns {Object} Dünya konumu {worldX, worldY}
   */
  calculateRoomWorldPosition(roomX, roomY) {
    let worldX = 0;
    let worldY = 0;

    // Sol taraf için dünya konumunu hesapla
    for (let x = 0; x < roomX; x++) {
      const leftRoom = this.getRoom(x, roomY);
      if (leftRoom) {
        worldX += leftRoom.width;
      } else {
        // Oda yoksa, ortalama oda boyutunu kullan
        worldX += this.getAverageRoomWidth();
      }
    }

    // Y ekseni için dünya konumunu hesapla
    for (let y = 0; y < roomY; y++) {
      const topRoom = this.getRoom(roomX, y);
      if (topRoom) {
        worldY += topRoom.height;
      } else {
        // Oda yoksa, ortalama oda boyutunu kullan
        worldY += this.getAverageRoomHeight();
      }
    }

    // Negatif kare konumları için - sonuç her zaman pozitif olacak
    if (roomX < 0) {
      let negativeOffsetX = 0;
      for (let x = -1; x >= roomX; x--) {
        const leftRoom = this.getRoom(x, roomY);
        if (leftRoom) {
          negativeOffsetX += leftRoom.width;
        } else {
          negativeOffsetX += this.getAverageRoomWidth();
        }
      }
      worldX = 0;
    }

    if (roomY < 0) {
      let negativeOffsetY = 0;
      for (let y = -1; y >= roomY; y--) {
        const topRoom = this.getRoom(roomX, y);
        if (topRoom) {
          negativeOffsetY += topRoom.height;
        } else {
          negativeOffsetY += this.getAverageRoomHeight();
        }
      }
      worldY = 0;
    }

    return { worldX: Math.max(0, worldX), worldY: Math.max(0, worldY) };
  }

  /**
   * Mevcut odaların ortalama genişliğini al ya da varsayılan değeri kullan
   * @returns {number} Ortalama oda genişliği piksel cinsinden
   */
  getAverageRoomWidth() {
    const existingRooms = Array.from(this.rooms.values());
    if (existingRooms.length === 0) {
      return 6 * TILE_SIZE; // Default room width
    }

    const totalWidth = existingRooms.reduce((sum, room) => sum + room.width, 0);
    return Math.floor(totalWidth / existingRooms.length);
  }

  /**
   * Mevcut odaların ortalama yüksekliğini al ya da varsayılan değeri kullan
   * @returns {number} Ortalama oda yüksekliği piksel cinsinden
   */
  getAverageRoomHeight() {
    const existingRooms = Array.from(this.rooms.values());
    if (existingRooms.length === 0) {
      return 6 * TILE_SIZE; // Default room height
    }

    const totalHeight = existingRooms.reduce(
      (sum, room) => sum + room.height,
      0
    );
    return Math.floor(totalHeight / existingRooms.length);
  }

  /**
   * Merkezden uzak olan odaları yükleme
   * @param {number} centerX - Merkez oda X
   * @param {number} centerY - Merkez oda Y
   */
  unloadDistantRooms(centerX, centerY) {
    const unloadRadius = this.loadRadius + 2;
    const roomsToUnload = [];

    for (const [key, room] of this.rooms.entries()) {
      const distance = Math.max(
        Math.abs(room.roomX - centerX),
        Math.abs(room.roomY - centerY)
      );

      if (distance > unloadRadius) {
        roomsToUnload.push(key);
      }
    }

    // Merkezden uzak olan odaları yükleme
    for (const key of roomsToUnload) {
      const room = this.rooms.get(key);
      if (room) {
        this.rooms.delete(key);
        this.roomGrid.delete(`${room.roomX},${room.roomY}`);
        this.loadedRooms.delete(key);
      }
    }

    if (roomsToUnload.length > 0) {
      console.log(`Unloaded ${roomsToUnload.length} distant rooms`);
    }
  }

  hasCollisionAtWorldPosition(worldPos) {
    const room = this.getRoomAtWorldPosition(worldPos);
    if (!room) {
      const roomGridPos = this.worldPosToRoomGrid(worldPos);
      if (!this.isWithinLevelBounds(roomGridPos.x, roomGridPos.y)) {
        return true;
      }
      return true;
    }

    const localPos = room.worldToLocal(worldPos);
    return room.hasCollisionAt(localPos);
  }

  getLoadedRooms() {
    return Array.from(this.rooms.values());
  }

  getVisibleRooms(viewportBounds) {
    return this.getLoadedRooms().filter((room) => {
      const roomBounds = room.getBounds();
      return !(
        roomBounds.right < viewportBounds.left ||
        roomBounds.left > viewportBounds.right ||
        roomBounds.bottom < viewportBounds.top ||
        roomBounds.top > viewportBounds.bottom
      );
    });
  }

  getDebugInfo() {
    return {
      seed: this.seed,
      loadedRooms: this.rooms.size,
      currentRoom: this.currentRoom
        ? `(${this.currentRoom.roomX}, ${this.currentRoom.roomY})`
        : "none",
      roomMemory: `${this.rooms.size}/${this.maxLoadedRooms}`,
    };
  }

  worldPosToRoomGrid(worldPos) {
    for (const room of this.rooms.values()) {
      if (room.containsWorldPosition(worldPos)) {
        return { x: room.roomX, y: room.roomY };
      }
    }

    const avgRoomWidth = this.getAverageRoomWidth();
    const avgRoomHeight = this.getAverageRoomHeight();

    return {
      x: Math.floor(worldPos.x / avgRoomWidth),
      y: Math.floor(worldPos.y / avgRoomHeight),
    };
  }
}
