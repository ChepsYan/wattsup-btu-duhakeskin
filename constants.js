/**
 * Oyun sabitleri - Grid boyutu, renk paleti, hızlar, anahtar kodları
 */

// ===== GRID VE BOYUTLAR =====
export const TILE_SIZE = 64; // Her grid hücresi 64x64 piksel
export const CANVAS_WIDTH = 1024; // Fixed canvas width for viewport
export const CANVAS_HEIGHT = 600; // Fixed canvas height for viewport

// ===== OYUNCU HAREKET SABITLERI =====
export const PLAYER_SPEED = 4; // Piksel/frame normal hareket
export const DASH_DISTANCE = TILE_SIZE * 2; // Space ile dash mesafesi
export const DASH_DURATION = 24; // Dash süresi (frame)

// ===== ANIMASYON SABITLERI =====
export const DOOR_ANIMATION_FRAMES = 30; // Kapı açılma/kapanma süresi
export const LASER_BOUNCE_LIMIT = 8; // Maksimum yansıma sayısı
export const TARGET_FPS = 60;

// ===== RENK PALETİ =====
export const COLORS = {
  // Arkaplan ve grid
  BACKGROUND: "#1a1a2e",
  GRID_LINE: "#16213e",
  WALL: "#0f3460",

  // Varlıklar
  PLAYER: "#e94560",
  DOOR_CLOSED: "#533483",
  DOOR_OPEN: "#7209b7",

  // Lazer sistemi
  LASER_BEAM: "#00ff41",
  LASER_EMITTER: "#ff6b35",
  LASER_HIT: "#ffff00",

  // İnteraktif objeler
  BUTTON_INACTIVE: "#6c5ce7",
  BUTTON_ACTIVE: "#00cec9",
  POWER_CELL_UNPOWERED: "#636e72",
  POWER_CELL_POWERED: "#00b894",

  // UI
  UI_BACKGROUND: "#2d3436",
  UI_TEXT: "#ddd",
  UI_BUTTON: "#74b9ff",
};

// ===== KLAVYE KONTROLLERI =====
export const KEYS = {
  // Hareket
  MOVE_LEFT: "KeyA",
  MOVE_RIGHT: "KeyD",
  MOVE_UP: "KeyW",
  MOVE_DOWN: "KeyS",

  // Aksiyon
  DASH: "Space",
  INTERACT: "KeyE",

  // Sistem
  RESTART: "KeyR",
  MENU: "Escape",
};

// ===== YÖN VEKTÖRLERİ =====
export const DIRECTIONS = {
  N: { x: 0, y: -1, name: "North" },
  S: { x: 0, y: 1, name: "South" },
  E: { x: 1, y: 0, name: "East" },
  W: { x: -1, y: 0, name: "West" },
};

// ===== VARLıK TİPLERİ =====
export const ENTITY_TYPES = {
  PLAYER: "Player",
  DOOR: "Door",
  LASER_EMITTER: "LaserEmitter",
  BUTTON: "Button",
  POWER_CELL: "PowerCell",
};

// ===== CANVAS KATMANLARI (Z-ORDER) =====
export const LAYERS = {
  BACKGROUND: 0, // Taban grid + statik döşeme
  ENTITIES: 1, // Dinamik objeler (kapı, emitter, düğme, hücre)
  LASERS: 2, // Lazer çizgileri
  PLAYER: 3, // Oyuncu sprite
  UI: 4, // UI üst-katman
};

// ===== DUNGEON GENERATION =====
export const DUNGEON = {
  MIN_GRID_SIZE: 4, // Minimum grid size (4x4)
  MAX_GRID_SIZE: 7, // Maximum grid size (7x7)
  MIN_ROOMS: 8, // Minimum oda sayısı
  MAX_ROOMS: 25, // Maksimum oda sayısı
  EXIT_MIN_DISTANCE: 3, // Çıkış kapısı minimum Manhattan mesafesi
  MAX_PLACEMENT_ATTEMPTS: 150, // Max attempts for tile placement
  ROTATION_CHANCE: 0.6, // Chance to rotate tiles (60%)
  EMPTY_SPACE_CHANCE: 0.15, // Chance to leave empty spaces (15%)
};

// ===== OYUN DURUMLARI =====
export const GAME_STATES = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "gameOver",
  LEVEL_COMPLETE: "levelComplete",
};

// ===== EASING FONKSİYONLARI =====
export const EASING = {
  // Cubic-out easing (kapı animasyonları için)
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),

  // Linear
  linear: (t) => t,

  // Quad-in-out
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
