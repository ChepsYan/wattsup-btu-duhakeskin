/**
 * Yardımcı fonksiyonlar - Vektör aritmetiği, RNG seed'li helper'lar
 * Oyunun matematiksel hesaplamaları için gerekli utility'ler
 */

// ===== VEKTÖR ARİTMETİĞİ =====

/**
 * 2D Vektör sınıfı - Pozisyon, yön ve matematiksel işlemler için
 */
export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Vektör toplama
   * @param {Vector2} other - Toplanacak vektör
   * @returns {Vector2} Yeni vektör
   */
  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  /**
   * Vektör çıkarma
   * @param {Vector2} other - Çıkarılacak vektör
   * @returns {Vector2} Yeni vektör
   */
  subtract(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  /**
   * Skalar çarpma
   * @param {number} scalar - Çarpan
   * @returns {Vector2} Yeni vektör
   */
  multiply(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /**
   * Vektör uzunluğu
   * @returns {number} Uzunluk
   */
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Normalize edilmiş vektör (birim vektör)
   * @returns {Vector2} Birim vektör
   */
  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2(0, 0);
    return new Vector2(this.x / mag, this.y / mag);
  }

  /**
   * İki vektör arası nokta çarpımı
   * @param {Vector2} other - Diğer vektör
   * @returns {number} Nokta çarpım sonucu
   */
  dot(other) {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Manhattan mesafesi hesaplama
   * @param {Vector2} other - Hedef vektör
   * @returns {number} Manhattan mesafesi
   */
  manhattanDistance(other) {
    return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
  }

  /**
   * Euclidean mesafesi hesaplama
   * @param {Vector2} other - Hedef vektör
   * @returns {number} Euclidean mesafesi
   */
  distance(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Vektör kopyalama
   * @returns {Vector2} Kopya vektör
   */
  clone() {
    return new Vector2(this.x, this.y);
  }

  /**
   * String temsilî
   * @returns {string} Vektör string hali
   */
  toString() {
    return `Vector2(${this.x}, ${this.y})`;
  }
}

// ===== RNG (RANDOM NUMBER GENERATOR) - SEEDLI =====

/**
 * Seedli rastgele sayı üreticisi (Linear Congruential Generator)
 * Tekrarlanabilir rastgele seviyeler için
 */
export class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * 0-1 arası rastgele sayı
   * @returns {number} Rastgele float [0, 1)
   */
  random() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Min-max arası rastgele integer
   * @param {number} min - Minimum değer (dahil)
   * @param {number} max - Maksimum değer (hariç)
   * @returns {number} Rastgele integer
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Min-max arası rastgele float
   * @param {number} min - Minimum değer
   * @param {number} max - Maksimum değer
   * @returns {number} Rastgele float
   */
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /**
   * Array'den rastgele eleman seçimi
   * @param {Array} array - Seçilecek array
   * @returns {*} Rastgele eleman
   */
  choice(array) {
    if (array.length === 0) return undefined;
    return array[this.randomInt(0, array.length)];
  }

  /**
   * Array karıştırma (Fisher-Yates shuffle)
   * @param {Array} array - Karıştırılacak array
   * @returns {Array} Karıştırılmış array (orijinal değişmez)
   */
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ===== MATEMATİKSEL HELPER FONKSIYONLARI =====

/**
 * Değeri min-max arasında sınırla
 * @param {number} value - Sınırlanacak değer
 * @param {number} min - Minimum değer
 * @param {number} max - Maksimum değer
 * @returns {number} Sınırlanmış değer
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * A'dan B'ye linear interpolation
 * @param {number} a - Başlangıç değeri
 * @param {number} b - Bitiş değeri
 * @param {number} t - İnterpolasyon faktörü [0, 1]
 * @returns {number} İnterpolasyon sonucu
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Açı normalizasyonu (-PI, PI arası)
 * @param {number} angle - Radyan cinsinden açı
 * @returns {number} Normalize edilmiş açı
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * İki açı arasındaki en kısa fark
 * @param {number} angle1 - İlk açı (radyan)
 * @param {number} angle2 - İkinci açı (radyan)
 * @returns {number} Açı farkı
 */
export function angleDifference(angle1, angle2) {
  return normalizeAngle(angle2 - angle1);
}

/**
 * Grid koordinatını piksel koordinatına çevir
 * @param {number} gridX - Grid X koordinatı
 * @param {number} gridY - Grid Y koordinatı
 * @param {number} tileSize - Tile boyutu
 * @returns {Vector2} Piksel koordinatı
 */
export function gridToPixel(gridX, gridY, tileSize = 64) {
  return new Vector2(gridX * tileSize, gridY * tileSize);
}

/**
 * Piksel koordinatını grid koordinatına çevir
 * @param {number} pixelX - Piksel X koordinatı
 * @param {number} pixelY - Piksel Y koordinatı
 * @param {number} tileSize - Tile boyutu
 * @returns {Vector2} Grid koordinatı
 */
export function pixelToGrid(pixelX, pixelY, tileSize = 64) {
  return new Vector2(
    Math.floor(pixelX / tileSize),
    Math.floor(pixelY / tileSize)
  );
}

// ===== ARRAY VE OBJECT HELPER'LARI =====

/**
 * Derin kopya oluşturma (JSON serialize/deserialize)
 * @param {*} obj - Kopyalanacak obje
 * @returns {*} Derin kopya
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Array'ı gruplara böl
 * @param {Array} array - Bölünecek array
 * @param {number} size - Grup boyutu
 * @returns {Array} Gruplanmış array
 */
export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Benzersiz ID üretici
 * @returns {string} Benzersiz ID
 */
export function generateUID() {
  return Math.random().toString(36).substr(2, 9);
}

export class PerfTimer {
  constructor() {
    this.timers = new Map();
  }

  start(name) {
    this.timers.set(name, performance.now());
  }

  end(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const elapsed = performance.now() - startTime;
      this.timers.delete(name);
      return elapsed;
    }
    return 0;
  }
}

/**
 * FPS sayacı
 */
export class FPSCounter {
  constructor() {
    this.frames = 0;
    this.startTime = performance.now();
    this.fps = 0;
  }

  update() {
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.startTime;

    if (elapsed >= 1000) {
      // Her saniye güncelle
      this.fps = Math.round((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.startTime = now;
    }
  }

  getFPS() {
    return this.fps;
  }
}
