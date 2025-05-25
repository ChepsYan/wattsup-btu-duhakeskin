# AI Kullanım Dokümantasyonu

**Proje:** Wattsup - BTÜ - 2D Lazer Puzzle Oyunu  
**Öğrenci:** Duha KESKİN (22360859003)  
**Ders:** Web Tabanlı Programlama  
**Tarih:** Mayıs 2025

## Yapay Zeka Araçları Kullanımı

Bu projede geliştirme sürecinde çeşitli yapay zeka araçları kullanılmıştır. Aşağıda kullanılan araçlar, prompt'lar ve alınan cevaplar detaylı olarak belgelenmiştir.

---

## 1. Claude AI (Anthropic) - Ana Geliştirme Yardımcısı

### Kullanım Alanları:

- JavaScript ES6+ modül yapısı tasarımı
- Canvas 2D rendering optimizasyonu
- Oyun döngüsü ve state management
- Lazer fizik sistemi geliştirme
- Collision detection algoritmaları
- Procedural dungeon generation
- CSS/HTML UI tasarımı
- Kod refactoring ve optimization

### Örnek Prompt ve Cevaplar:

#### Prompt 1: Lazer Sistemi Geliştirme

**Prompt:**

```
HTML5 Canvas kullanarak 2D oyun için lazer sistemi geliştirmek istiyorum. Lazerler:
1. Belirli yönlere ışın çıkarmalı
2. Duvarlarda yansımalı (maksimum 8 yansıma)
3. Enerji hücrelerini güçlendirmeli
4. Oyuncuya değerse ölümcül olmalı
5. Performanslı olmalı (60 FPS)
JavaScript ES6 modül yapısında nasıl tasarlarım?
```

**Claude'un Cevabı:**

```javascript
// Lazer sistemi için modüler yapı önerisi
export class LaserSystem {
  constructor() {
    this.activeBeams = [];
    this.beamPool = [];
    this.maxBounces = 8;
    this.collisionDetector = new LaserCollisionDetector();
  }

  calculateBeamPath(startPos, direction, entities) {
    const beam = {
      points: [startPos],
      bounces: 0,
      intensity: 1.0,
    };

    let currentPos = startPos.clone();
    let currentDir = direction.clone();

    while (beam.bounces < this.maxBounces && beam.intensity > 0.1) {
      const collision = this.collisionDetector.raycast(
        currentPos,
        currentDir,
        entities
      );

      if (collision) {
        beam.points.push(collision.point);

        if (collision.type === "reflective") {
          currentDir = this.calculateReflection(currentDir, collision.normal);
          currentPos = collision.point;
          beam.bounces++;
          beam.intensity *= 0.9; // Yansıma sonrası güç kaybı
        } else {
          break;
        }
      } else {
        // Ekran sınırlarına kadar devam et
        const edgePoint = this.calculateScreenEdgeIntersection(
          currentPos,
          currentDir
        );
        beam.points.push(edgePoint);
        break;
      }
    }

    return beam;
  }

  render(ctx, beams) {
    beams.forEach((beam) => {
      this.renderBeam(ctx, beam);
    });
  }

  renderBeam(ctx, beam) {
    if (beam.points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 255, 65, ${beam.intensity})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ff41";
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(beam.points[0].x, beam.points[0].y);

    for (let i = 1; i < beam.points.length; i++) {
      ctx.lineTo(beam.points[i].x, beam.points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }
}
```

Bu yapı size modüler, performanslı ve genişletilebilir bir lazer sistemi sağlar.

#### Prompt 2: Procedural Level Generation

**Prompt:**

```
2D tile-based oyun için Wave Function Collapse benzeri algoritma ile seviye üretmek istiyorum. Her tile JSON formatında olsun ve bağlantı kuralları olsun. Nasıl tasarlarım?
```

**Claude'un Cevabı:**

```javascript
export class DungeonGenerator {
  constructor() {
    this.tileLibrary = new Map();
    this.placedTiles = new Map();
    this.constraints = new Map();
  }

  async loadTiles() {
    const tileFiles = [
      "start.json",
      "corner.json",
      "straight.json",
      "exit.json",
    ];

    for (const filename of tileFiles) {
      try {
        const response = await fetch(`./assets/tiles/${filename}`);
        const tileData = await response.json();
        this.tileLibrary.set(tileData.id, tileData);
      } catch (error) {
        console.error(`Failed to load tile: ${filename}`, error);
      }
    }
  }

  generateLevel(gridWidth, gridHeight, seed) {
    const rng = new SeededRandom(seed);
    const grid = Array(gridHeight)
      .fill()
      .map(() => Array(gridWidth).fill(null));

    // 1. Başlangıç tile'ını yerleştir
    const startTile = this.getTilesByProperty("start", true)[0];
    const startX = Math.floor(gridWidth / 2);
    const startY = Math.floor(gridHeight / 2);

    grid[startY][startX] = {
      tile: startTile,
      rotation: 0,
      position: { x: startX, y: startY },
    };

    // 2. WFC algoritması ile doldur
    const queue = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = this.getNeighbors(
        current.x,
        current.y,
        gridWidth,
        gridHeight
      );

      for (const neighbor of neighbors) {
        if (grid[neighbor.y][neighbor.x] !== null) continue;

        const possibleTiles = this.getPossibleTiles(neighbor, grid);
        if (possibleTiles.length === 0) continue;

        const selectedTile = rng.choice(possibleTiles);
        grid[neighbor.y][neighbor.x] = selectedTile;
        queue.push(neighbor);
      }
    }

    return this.convertGridToWorldSpace(grid);
  }

  getPossibleTiles(position, grid) {
    const constraints = this.getConstraintsAt(position, grid);
    return this.tileLibrary
      .values()
      .filter((tile) => this.satisfiesConstraints(tile, constraints));
  }

  satisfiesConstraints(tile, constraints) {
    for (const [direction, requirement] of constraints) {
      const tileExit = tile.exits[direction];
      if (!tileExit && requirement.needsExit) return false;
      if (tileExit && requirement.forbidsExit) return false;
    }
    return true;
  }
}
```

Bu yaklaşım size esnek ve tekrarlanabilir seviye üretimi sağlar.

---

## 2. GitHub Copilot - Kod Tamamlama

### Kullanım Alanları:

- Fonksiyon implementasyonu
- JSDoc kommentleri
- Utility fonksiyonları
- Event handler'lar
- CSS animasyonları

### Örnek Kullanımlar:

#### Kod Tamamlama 1: Player Movement

**Yazdığım başlangıç:**

```javascript
class Player {
  handleMovement(inputState, deltaTime) {
    // WASD hareket sistemi
```

**Copilot'un Önerisi:**

```javascript
class Player {
  handleMovement(inputState, deltaTime) {
    // WASD hareket sistemi
    const movement = new Vector2(0, 0);

    if (inputState.left) movement.x -= 1;
    if (inputState.right) movement.x += 1;
    if (inputState.up) movement.y -= 1;
    if (inputState.down) movement.y += 1;

    if (movement.length() > 0) {
      movement.normalize();
      movement.multiplyScalar(this.speed * deltaTime);

      const newPos = this.position.clone().add(movement);
      if (!this.checkCollision(newPos)) {
        this.position = newPos;
      }
    }
  }
}
```

#### Kod Tamamlama 2: CSS Animations

**Yazdığım başlangıç:**

```css
.loading-spinner {
  width: 60px;
  height: 60px;
  border: 5px solid #16213e;
```

**Copilot'un Önerisi:**

```css
.loading-spinner {
  width: 60px;
  height: 60px;
  border: 5px solid #16213e;
  border-top: 5px solid #00ff41;
  border-right: 5px solid #74b9ff;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

---

## 3. ChatGPT-4 - Problem Çözme

### Kullanım Alanları:

- Debug yardımı
- Performance optimization
- Algorithm seçimi
- Architecture decisions

### Örnek Prompt ve Cevaplar:

#### Prompt 1: Performance Optimization

**Prompt:**

```
Canvas 2D oyunumda 60 FPS'yi korumakta zorlanıyorum. Çok sayıda lazer ışını ve entity render ediyorum. Nasıl optimize edebilirim?
```

**ChatGPT'nin Cevabı:**

```
Canvas 2D performansını artırmak için şu teknikler önerilir:

1. **Object Pooling**: Sürekli yeni objeler yaratmak yerine pool kullanın
2. **Culling**: Görünür alan dışındaki objeleri render etmeyin
3. **Batch Rendering**: Benzer objeleri gruplandırarak render edin
4. **RAF Optimization**: RequestAnimationFrame'i doğru kullanın

Örnek Object Pool implementasyonu:

class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.createFn();
  }

  release(obj) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// Lazer beam için kullanım
const beamPool = new ObjectPool(
  () => ({ points: [], intensity: 1.0 }),
  (beam) => { beam.points.length = 0; beam.intensity = 1.0; }
);
```

#### Prompt 2: Collision Detection

**Prompt:**

```
Grid-based oyunumda efficient collision detection nasıl implement ederim? Hem AABB hem de grid-based yaklaşımlar lazım.
```

**ChatGPT'nin Cevabı:**

```
Hybrid yaklaşım önerim:

1. **Spatial Hashing**: Geniş alan için
2. **AABB**: Kesin collision için
3. **Grid Cells**: Tile-based movement için

class SpatialHashGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  hash(x, y) {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(entity) {
    const bounds = entity.getBounds();
    const minHash = this.hash(bounds.left, bounds.top);
    const maxHash = this.hash(bounds.right, bounds.bottom);

    // Entity'yi span ettiği tüm hücrelere ekle
    for (let y = bounds.top; y <= bounds.bottom; y += this.cellSize) {
      for (let x = bounds.left; x <= bounds.right; x += this.cellSize) {
        const key = this.hash(x, y);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(entity);
      }
    }
  }

  query(bounds) {
    const candidates = new Set();

    for (let y = bounds.top; y <= bounds.bottom; y += this.cellSize) {
      for (let x = bounds.left; x <= bounds.right; x += this.cellSize) {
        const key = this.hash(x, y);
        const entities = this.grid.get(key) || [];
        entities.forEach(e => candidates.add(e));
      }
    }

    return Array.from(candidates);
  }
}
```

---

## 4. Diğer AI Araçları

### 4.1 VS Code IntelliSense + AI Extensions

- **Kullanım:** Kod tamamlama, syntax highlighting
- **Fayda:** Hızlı geliştirme, hata önleme

### 4.2 Online AI Code Generators

- **Kullanım:** Utility fonksiyonları, matematiik işlemleri
- **Örnek:** Vector2 math operations, easing functions

### 4.3 AI-Powered Documentation Tools

- **Kullanım:** JSDoc comment generation
- **Örnek:**

```javascript
/**
 * Calculate reflection vector for laser bouncing
 * @param {Vector2} incident - Incoming ray direction
 * @param {Vector2} normal - Surface normal vector
 * @returns {Vector2} Reflected ray direction
 */
calculateReflection(incident, normal) {
  return incident.subtract(normal.multiplyScalar(2 * incident.dot(normal)));
}
```

---

## 5. AI Kullanım İstatistikleri

### Geliştirme Sürecindeki AI Yardımı:

- **%40** - Kod yapısı ve architecture tasarımı
- **%25** - Algorithm implementation
- **%20** - Debug ve problem solving
- **%10** - CSS/HTML styling
- **%5** - Documentation ve comments

### En Çok Yardım Alınan Konular:

1. Canvas 2D rendering optimization
2. JavaScript ES6 module system
3. Game loop ve state management
4. Collision detection algorithms
5. Procedural content generation

### AI Araçlarının Katkısı:

- **Geliştirme Hızı:** ~3x artış
- **Kod Kalitesi:** Daha clean ve maintainable
- **Bug Azalması:** Early detection sayesinde
- **Learning:** Yeni teknikler öğrenme

---

## 6. Önemli Notlar

### AI Kullanımında Dikkat Edilen Noktalar:

1. **Kod Ownership:** Her AI önerisini anlayıp modifiye ettim
2. **Testing:** AI kodlarını mutlaka test ettim
3. **Integration:** Mevcut architecture'a uygun hale getirdim
4. **Performance:** AI önerilerini performance açısından optimize ettim

### AI'dan Alınmayan Kararlar:

- Oyun tasarımı ve game mechanics
- Proje yapısı ve dosya organizasyonu
- UI/UX design kararları
- Business logic ve game rules

---

## 7. Sonuç

Bu projede AI araçları **yardımcı** rol oynadı, **ana karar verici** değil. AI'ın sağladığı hızlı prototyping, algoritma önerileri ve debugging yardımı ile:

- Daha hızlı geliştirme süreci
- Daha stabil ve performanslı kod
- Yeni teknikleri öğrenme fırsatı
- Clean code practices

elde ettim. Tüm AI önerileri kritik bir yaklaşımla değerlendirildi ve projeye entegre edildi.

---

**Geliştirici:** Duha KESKİN - 22360859003
