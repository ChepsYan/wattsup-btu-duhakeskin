/**
 * Türkçe
 * Wattsup - BTÜ
 */

export const TURKISH_TEXTS = {
  // Ana menü
  menu: {
    title: "Wattsup - BTÜ",
    subtitle: "Duha KESKİN 22360859003",
    startGame: "SPACE tuşuna basarak oyuna başla",
    controls: "",
    highScore: "En Yüksek Skor: {score}",
  },

  // Oyun içi
  game: {
    level: "Seviye",
    score: "Skor",
    lives: "Can",
    time: "Süre",
    objectives: "Hedefler",
    paused: "DURAKLANDI",
    pauseInstruction: "Devam etmek için ESC tuşuna basın",
  },

  // Seviye tamamlama
  levelComplete: {
    title: "SEVİYE TAMAMLANDI!",
    congratulations: "Tebrikler!",
    levelCompleted: "Seviye {level} başarıyla tamamlandı",
    timeBonus: "Süre Bonusu: {bonus}",
    totalScore: "Toplam Skor: {score}",
    nextLevel: "Sonraki Seviye",
    backToMenu: "Ana Menüye Dön",
    stats: {
      title: "İstatistikler",
      timeElapsed: "Geçen Süre: {time}s",
      dashCount: "İleri Atılma Sayısı: {count}",
      interactionCount: "Etkileşim Sayısı: {count}",
    },
  },

  // Oyun sonu
  gameOver: {
    title: "OYUN BİTTİ",
    levelReached: "Ulaşılan Seviye: {level}",
    finalScore: "Son Skor: {score}",
    newHighScore: "YENİ REKOR!",
    restart: "Yeniden Başla - R",
    menu: "Ana Menü - ESC",
  },

  // Bildirimler
  notifications: {
    levelGenerated: "Seviye {level} oluşturuldu",
    levelGenerationFailed:
      "Seviye oluşturma başarısız, yedek seviye kullanılıyor",
    emergencyLevel: "Acil durum seviyesi yüklendi",
    playerDeath: "Oyuncu öldü! Kalan can: {lives}",
    powerActivated: "Güç aktif edildi",
    doorOpened: "Kapı açıldı",
    objectiveComplete: "Hedef tamamlandı",
  },

  // UI elementleri
  ui: {
    back: "Geri",
    restart: "Yeniden Başla",
    memory: "Bellek",
    debug: "Hata Ayıklama",
    loading: "Yükleniyor...",
    generatingWorld: "Dinamik Dünya Oluşturuluyor...",
  },

  // Hedefler
  objectives: {
    reachExit: "Çıkışa ulaş",
    activateAllPowerCells: "Tüm güç hücrelerini aktif et",
    openAllDoors: "Tüm kapıları aç",
    collectItems: "Eşyaları topla",
    solvePuzzle: "Bulmacayı çöz",
  },

  // Varlık isimleri
  entities: {
    player: "Oyuncu",
    door: "Kapı",
    laserEmitter: "Lazer Yayıcı",
    button: "Düğme",
    powerCell: "Güç Hücresi",
    wall: "Duvar",
    exit: "Çıkış",
  },
};

/**
 * Metin interpolasyon fonksiyonu
 * @param {string} text - Interpolasyon yapılacak metin
 * @param {Object} params - Parametreler
 * @returns {string} İnterpolasyonlu metin
 */
export function interpolateText(text, params = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

/**
 * Süreyi saniye olarak formatla
 * @param {number} milliseconds - Milisaniye
 * @returns {string} Formatlanmış süre
 */
export function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Skoru formatla
 * @param {number} score - Skor
 * @returns {string} Formatlanmış skor
 */
export function formatScore(score) {
  return score.toLocaleString("tr-TR");
}

/**
 * Türkçe metin alma fonksiyonu
 * @param {string} path - Metin yolu (örn: "menu.title")
 * @param {Object} params - İnterpolasyon parametreleri
 * @returns {string} Türkçe metin
 */
export function getText(path, params = {}) {
  const keys = path.split(".");
  let text = TURKISH_TEXTS;

  for (const key of keys) {
    if (text && typeof text === "object" && key in text) {
      text = text[key];
    } else {
      console.warn(`Localization key not found: ${path}`);
      return path; // Fallback to path if not found
    }
  }

  if (typeof text !== "string") {
    console.warn(`Localization path does not resolve to string: ${path}`);
    return path;
  }

  return interpolateText(text, params);
}

export default {
  TURKISH_TEXTS,
  interpolateText,
  formatTime,
  formatScore,
  getText,
};
