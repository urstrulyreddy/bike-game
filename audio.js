// Simple Audio System using Web Audio API with continuous engine oscillator
class SimpleAudioManager {
  constructor() {
    this.audioContext = null;
    this.engineOscillator = null;
    this.engineGain = null;
    this.isEngineRunning = false;
    this.masterGain = null;
    this.init();
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.audioContext.destination);
    } catch (e) {
      console.log('Web Audio API not supported');
    }
  }

  // Start a continuous engine sound; frequency and volume will be modulated
  startEngine() {
    if (!this.audioContext || this.isEngineRunning) return;
    this.engineOscillator = this.audioContext.createOscillator();
    this.engineGain = this.audioContext.createGain();

    this.engineOscillator.type = 'sawtooth';
    this.engineOscillator.frequency.value = 80; // base idle

    this.engineGain.gain.value = 0.0; // start silent; fade in via updateEngine

    this.engineOscillator.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOscillator.start();
    this.isEngineRunning = true;
  }

  // Smoothly modulate engine tone based on normalized speed [0..1]
  updateEngine(normalizedSpeed) {
    if (!this.audioContext) return;
    // Resume context on user gesture if it was suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (!this.isEngineRunning) this.startEngine();
    if (!this.engineOscillator || !this.engineGain) return;

    const now = this.audioContext.currentTime;
    const clamped = Math.max(0, Math.min(1, normalizedSpeed));

    // Frequency sweeps from idle 80Hz to ~500Hz
    const targetFreq = 80 + clamped * 420;
    this.engineOscillator.frequency.setTargetAtTime(targetFreq, now, 0.08);

    // Volume from 0.05 to 0.25
    const targetGain = 0.05 + clamped * 0.2;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  stopEngine() {
    if (!this.isEngineRunning) return;
    try {
      const now = this.audioContext.currentTime;
      // Fade out then stop
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.1);
      setTimeout(() => {
        try {
          this.engineOscillator.stop();
        } catch {}
        this.engineOscillator.disconnect();
        this.engineGain.disconnect();
        this.engineOscillator = null;
        this.engineGain = null;
        this.isEngineRunning = false;
      }, 200);
    } catch {
      this.isEngineRunning = false;
    }
  }

  // One-shot SFX helpers
  oneShot(fStart, fEnd, dur, startGain = 0.2, type = 'sine') {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    const osc = this.audioContext.createOscillator();
    const g = this.audioContext.createGain();
    osc.type = type;
    osc.connect(g);
    g.connect(this.masterGain);

    const now = this.audioContext.currentTime;
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, fEnd), now + dur);
    g.gain.setValueAtTime(startGain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start();
    osc.stop(now + dur + 0.02);
  }

  playJump() { this.oneShot(500, 200, 0.2, 0.25, 'triangle'); }
  playCrash() { this.oneShot(200, 60, 0.35, 0.35, 'square'); }
  playPowerup() { this.oneShot(900, 600, 0.15, 0.3, 'sine'); }
  playMenu() { this.oneShot(300, 450, 0.1, 0.15, 'sine'); }
}
