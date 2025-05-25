/**
 * Ses Yöneticisi - Tüm oyun seslerinin yönetildiği script.
 */

export class AudioManager {
  constructor() {
    this.bgMusic = null;
    this.soundEffects = new Map();
    this.lastPlayTimes = new Map();
    this.isMuted = false;
    this.musicVolume = 0.075;
    this.sfxVolume = 0.75;
    this.isInitialized = false;

    this.audioContext = null;
    this.musicGainNode = null;
    this.sfxGainNode = null;

    this.setupAudioContext();
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.musicGainNode = this.audioContext.createGain();
      this.sfxGainNode = this.audioContext.createGain();

      this.musicGainNode.connect(this.audioContext.destination);
      this.sfxGainNode.connect(this.audioContext.destination);

      this.musicGainNode.gain.value = this.musicVolume;
      this.sfxGainNode.gain.value = this.sfxVolume;
    } catch (error) {}
  }

  async initialize() {
    try {
      await this.loadBackgroundMusic("assets/tiles/sound/bgmusic.mp3");

      await this.loadSoundEffect(
        "door-open",
        "assets/tiles/sound/scifi-door.mp3"
      );
      await this.loadSoundEffect(
        "button-toggle",
        "assets/tiles/sound/button.mp3"
      );
      await this.loadSoundEffect("death", "assets/tiles/sound/death.mp3");
      await this.loadSoundEffect(
        "level-pass",
        "assets/tiles/sound/passlevel.mp3"
      );
      await this.loadSoundEffect("dash", "assets/tiles/sound/dash.mp3");
      await this.loadSoundEffect(
        "powercell-charge",
        "assets/tiles/sound/powercell.mp3"
      );

      this.isInitialized = true;
    } catch (error) {}
  }

  async loadBackgroundMusic(musicPath) {
    return new Promise((resolve, reject) => {
      try {
        this.bgMusic = new Audio(musicPath);
        this.bgMusic.loop = true;
        this.bgMusic.volume = this.musicVolume;
        this.bgMusic.preload = "auto";

        this.bgMusic.addEventListener("canplaythrough", () => {
          resolve();
        });

        this.bgMusic.addEventListener("error", (e) => {
          reject(e);
        });

        this.bgMusic.load();
      } catch (error) {
        reject(error);
      }
    });
  }

  async loadSoundEffect(name, soundPath) {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(soundPath);
        audio.volume = this.sfxVolume;
        audio.preload = "auto";

        audio.addEventListener("canplaythrough", () => {
          this.soundEffects.set(name, audio);
          console.log(`Sound effect '${name}' loaded successfully`);
          resolve();
        });

        audio.addEventListener("error", (e) => {
          console.error(`Failed to load sound effect '${name}':`, e);
          reject(e);
        });

        audio.load();
      } catch (error) {
        reject(error);
      }
    });
  }

  playBackgroundMusic() {
    if (!this.bgMusic || this.isMuted) return;

    try {
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      this.bgMusic.currentTime = 0;
      this.bgMusic.play().catch((error) => {});
    } catch (error) {}
  }

  pauseBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }

  stopBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
  }

  playSoundEffect(name) {
    if (this.isMuted) return;

    const cooldownPeriod = name === "dash" ? 150 : 50;
    const now = Date.now();
    const lastPlayTime = this.lastPlayTimes.get(name) || 0;

    if (now - lastPlayTime < cooldownPeriod) {
      return;
    }

    const sound = this.soundEffects.get(name);
    if (sound) {
      try {
        const soundClone = sound.cloneNode();
        soundClone.volume = this.sfxVolume;
        soundClone.play().catch((error) => {
          console.warn(`Failed to play sound effect '${name}':`, error);
        });
        this.lastPlayTimes.set(name, now);
      } catch (error) {
        console.error(`Error playing sound effect '${name}':`, error);
      }
    } else {
      console.warn(`Sound effect '${name}' not found`);
    }
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.bgMusic) {
      this.bgMusic.volume = this.musicVolume;
    }
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = this.musicVolume;
    }
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.soundEffects.forEach((sound) => {
      sound.volume = this.sfxVolume;
    });
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.value = this.sfxVolume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;

    if (this.isMuted) {
      this.pauseBackgroundMusic();
    } else {
      this.playBackgroundMusic();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;

    if (this.isMuted) {
      this.pauseBackgroundMusic();
    } else {
      this.playBackgroundMusic();
    }
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  isMuted() {
    return this.isMuted;
  }

  isMusicPlaying() {
    return this.bgMusic && !this.bgMusic.paused;
  }

  destroy() {
    this.stopBackgroundMusic();

    if (this.bgMusic) {
      this.bgMusic = null;
    }

    this.soundEffects.clear();

    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export const audioManager = new AudioManager();
