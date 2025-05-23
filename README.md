# Duha KESKİN 22360859003

Web Tabanlı Programlama Dersi Ödevi için hazırladığım 2D oyun projesi.
Örnek Alınan Oyun: Wattsup - https://bijoykochar.itch.io/wattsup
Oyun Linki: https://chepsyan.github.io/wattsup-btu-duhakeskin.io/
Oyun Bilgilendirme Linki:
https://youtu.be/yS-5G2AAH7I

## Başlangıç

### Sistem Gereksinimleri

- **Tarayıcı**: Chrome ≥ 114, Firefox ≥ 115, Edge ≥ 114
- **JavaScript**: ES2022 desteği gerekli
- **İnternet**: İlk yükleme için (tile dosyaları)

### Kurulum

1. Tüm dosyaları bir web server'da yayınlayın
2. `index.html` dosyasını tarayıcınızda açın
3. Oyun otomatik olarak yüklenecek ve başlayacaktır

## Nasıl Oynanır

### Kontroller

| Tuş             | Aksiyon                 |
| --------------- | ----------------------- |
| `W` `A` `S` `D` | Hareket                 |
| `SPACE`         | Dash (İleri Atılma)     |
| `R`             | Seviyeyi yeniden başlat |
| `M`             | Sesi Aç/Kapa            |
| `ESC`           | Ana menü / Pause        |

### Oyun Mekanikleri

#### Lazer Sistemi

- **Lazer Tüfeği**: Belirli yöne sürekli ışın yayar
- **Yansıtma**: Ayna kapılardan yansır (maksimum 8 yansıma)
- **Güçlendirme**: Enerji hücrelerini güçlendirir
- **Ölümcül**: Oyuncuya değerse seviye yeniden başlar

#### Varlık Tipleri

**🔴 Oyuncu (Player)**

- WASD ile hareket
- Space ile dash
- Lazer temas ettiğinde ölür

**🚪 Kapılar (Door)**

- Varsayılan kapalı
- Button ile açılıp kapanılabilir
- Açık halde lazer geçirir

**🔫 Lazer Cihazları**

- Belirli bir yöne doğru bakar
- Button ile 90° döndürülebilir
- Sürekli ışın yayar
- Ölümcüldür. (Karakter ışına çarparsa ölür.)
- E tuşu ile interaksiyona girilir.

**🔘 Düğme**

- Oda içerisindeki lazerleri açık kapamaya yarar.
- E tuşu ile interaksiyona girilir.

**⚡ Enerji Hücresi**

- Lazer ışını ile güçlenir
- Tüm hücreler güçlü olduğunda çıkış açılır

## 🛠️ Proje Kılavuzu

### Dosya Yapısı

```
bulletrunner-btu-bilgisayarmuh/
├── index.html              # Ana HTML sayfa
├── main.js                 # Oyun döngüsü ve state yönetimi
├── constants.js            # Sabit değerler ve konfigürasyon
├── utils.js                # Yardımcı fonksiyonlar ve matematik
├── entity.js               # Oyun varlıkları (Player, Door, vs.)
├── laser.js                # Lazer sistemi ve fizik
├── level.js                # Seviye yönetimi ve entity yaratma
├── dungeonGen.js           # Rastgele seviye üretici
├── ui.js                   # Kullanıcı arayüzü yönetimi
├── assets/
│   └── tiles/
│       ├── straight.json   # Düz koridor tile
│       ├── corner.json     # L-köşe tile
│       ├── start.json      # Başlangıç tile
│       └── exit.json       # Çıkış tile
└── README.md               # Bu dosya
```

### Yeni Tile Ekleme

#### Tile JSON Formatı

```json
{
  "id": "unique_tile_id",
  "name": "Okunabilir İsim",
  "size": [width, height],
  "start": false,
  "exit": false,
  "exits": {
    "N": [x, y],
    "E": [x, y],
    "S": [x, y],
    "W": [x, y]
  },
  "prefabs": [
    {
      "type": "EntityType",
      "pos": [x, y],
      "dir": "N|E|S|W",
      "id": "unique_id",
      "targets": ["target_id1", "target_id2"],
      "exit": true|false
    }
  ]
}
```

#### Tile Özellikleri

| Alan      | Tip              | Açıklama                             |
| --------- | ---------------- | ------------------------------------ |
| `id`      | string           | Benzersiz tile tanımlayıcısı         |
| `name`    | string           | İnsan okunabilir tile ismi           |
| `size`    | [number, number] | Tile boyutu (grid hücresi cinsinden) |
| `start`   | boolean          | Başlangıç tile'ı mı?                 |
| `exit`    | boolean          | Çıkış tile'ı mı?                     |
| `exits`   | object           | Bağlantı noktaları (N/E/S/W yönleri) |
| `prefabs` | array            | Tile içindeki varlıklar              |

#### Prefab Özellikleri

| Alan      | Tip              | Açıklama                                      |
| --------- | ---------------- | --------------------------------------------- |
| `type`    | string           | Varlık tipi (Player, Door, LaserEmitter, vs.) |
| `pos`     | [number, number] | Grid pozisyonu                                |
| `dir`     | string           | Yön (N/E/S/W)                                 |
| `id`      | string           | Benzersiz varlık ID'si                        |
| `targets` | array            | Hedef varlık ID'leri (Button için)            |
| `exit`    | boolean          | Çıkış kapısı var ise                          |

#### Örnek Tile

```json
{
  "id": "puzzle_room",
  "name": "Puzzle Odası",
  "size": [12, 8],
  "exits": {
    "W": [0, 4],
    "E": [11, 4]
  },
  "prefabs": [
    {
      "type": "LaserEmitter",
      "pos": [2, 2],
      "dir": "E",
      "id": "emitter1"
    },
    {
      "type": "Button",
      "pos": [4, 6],
      "id": "btn1",
      "targets": ["emitter1"]
    },
    {
      "type": "PowerCell",
      "pos": [9, 2],
      "id": "cell1"
    },
    {
      "type": "Door",
      "pos": [11, 4],
      "dir": "E",
      "id": "exit_door",
      "exit": true
    }
  ]
}
```

### Yeni Varlık Ekleme

#### Entity Sınıfı Oluşturma

```javascript
import { Entity } from "./entity.js";
import { COLORS } from "./constants.js";

export class YeniVarlik extends Entity {
  constructor(x, y, options = {}) {
    super(x, y);
    this.ozellik = options.ozellik || "varsayilan";
    this.solid = true; // Çarpışma var mı?
  }

  update(deltaTime) {
    // Varlık güncelleme mantığı
    super.update(deltaTime);
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.fillStyle = COLORS.YENI_RENK;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
  }
}
```

#### Entity Oluşturucuya Ekleme

```javascript
this.entityFactories = {
  // ... mevcut oluşturucular
  YeniVarlik: (data) => new YeniVarlik(data.x, data.y, data),
};
```

## 🎨 Oyun Tasarımı

### Renk Paleti

```javascript
export const COLORS = {
  BACKGROUND: "#1a1a2e", // Koyu mavi arkaplan
  GRID_LINE: "#16213e", // Grid çizgileri
  WALL: "#0f3460", // Duvarlar
  PLAYER: "#e94560", // Oyuncu (kırmızı)
  LASER_BEAM: "#00ff41", // Lazer ışını (yeşil)
  LASER_EMITTER: "#ff6b35", // Lazer tüfeği (turuncu)
  DOOR_CLOSED: "#533483", // Kapalı kapı (mor)
  DOOR_OPEN: "#7209b7", // Açık kapı (açık mor)
  BUTTON_INACTIVE: "#6c5ce7", // Pasif düğme
  BUTTON_ACTIVE: "#00cec9", // Aktif düğme (turkuaz)
  POWER_CELL_UNPOWERED: "#636e72", // Güçsüz hücre (gri)
  POWER_CELL_POWERED: "#00b894", // Güçlü hücre (yeşil)
  UI_BACKGROUND: "#2d3436", // UI arkaplan
  UI_TEXT: "#ddd", // UI metin
  UI_BUTTON: "#74b9ff", // UI düğme
};
```

### Grid Sistemi

- Her grid hücresi **64x64 piksel**
- Canvas boyutu **1024x600 piksel**
- Benzersiz Seviye Sistemi Sistemi **Produceral Level**

## 🔧 Debug ve Geliştirme

### Console Komutları

```javascript
// Global game instance
window.game;

// Level yeniden üret (yeni seed ile)
game.levelManager.generateLevel();

// Belirli seed ile level üret
game.levelManager.generateLevel(1, 12345);

// Player pozisyonu değiştir
game.levelManager.player.position.x = 100;
game.levelManager.player.position.y = 100;

// Debug bilgileri
game.levelManager.getDebugInfo();
game.laserSystem.getDebugInfo();
```

## 📄 Lisans

Bu proje eğitim amaçlı Bursa Teknik Üniversitesi Bilgisayar Mühendisliği Web Tabanlı Programlama dersi için oluşturulmuştur.

## 📚 Referanslar

- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

**Wattsup - BTÜ** - Duha Keskin 22360859003
Geliştirici: Duha KESKİN
Versiyon: 1.0.0  
Son Güncelleme: 2025
