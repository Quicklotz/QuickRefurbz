/**
 * SoundManager — Web Audio API synthesized sound effects
 * No audio files needed; all sounds are generated programmatically.
 */

type SoundName =
  | 'scan-success'
  | 'scan-error'
  | 'notification-success'
  | 'notification-error'
  | 'notification-warning'
  | 'notification-info'
  | 'stage-advance'
  | 'item-complete'
  | 'camera-shutter'
  | 'click'
  | 'login-success';

const STORAGE_ENABLED_KEY = 'qr-sound-enabled';
const STORAGE_VOLUME_KEY = 'qr-sound-volume';

class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private enabled: boolean;
  private volume: number;

  private constructor() {
    this.enabled = localStorage.getItem(STORAGE_ENABLED_KEY) !== 'false';
    this.volume = parseFloat(localStorage.getItem(STORAGE_VOLUME_KEY) || '0.3');
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem(STORAGE_ENABLED_KEY, String(enabled));
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(STORAGE_VOLUME_KEY, String(this.volume));
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(ctx.destination);

      switch (name) {
        case 'scan-success':
          this.playScanSuccess(ctx, master);
          break;
        case 'scan-error':
          this.playScanError(ctx, master);
          break;
        case 'notification-success':
          this.playNotificationSuccess(ctx, master);
          break;
        case 'notification-error':
          this.playNotificationError(ctx, master);
          break;
        case 'notification-warning':
          this.playNotificationWarning(ctx, master);
          break;
        case 'notification-info':
          this.playNotificationInfo(ctx, master);
          break;
        case 'stage-advance':
          this.playStageAdvance(ctx, master);
          break;
        case 'item-complete':
          this.playItemComplete(ctx, master);
          break;
        case 'camera-shutter':
          this.playCameraShutter(ctx, master);
          break;
        case 'click':
          this.playClick(ctx, master);
          break;
        case 'login-success':
          this.playLoginSuccess(ctx, master);
          break;
      }
    } catch {
      // Silently ignore audio errors
    }
  }

  // Short rising tone (200ms)
  private playScanSuccess(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.15);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Low descending buzz (150ms)
  private playScanError(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(150, t + 0.15);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Pleasant double-chime (300ms)
  private playNotificationSuccess(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    [0, 0.12].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.5, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.18);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.18);
    });
  }

  // Descending two-tone (200ms)
  private playNotificationError(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    [0, 0.1].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = i === 0 ? 440 : 330;
      gain.gain.setValueAtTime(0.5, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.1);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.1);
    });
  }

  // Alert beep (150ms)
  private playNotificationWarning(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Soft ping (100ms)
  private playNotificationInfo(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1046;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Ascending progress chime (250ms)
  private playStageAdvance(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const offset = i * 0.07;
      gain.gain.setValueAtTime(0.4, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.12);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.12);
    });
  }

  // Celebration arpeggio (400ms)
  private playItemComplete(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1046]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const offset = i * 0.08;
      gain.gain.setValueAtTime(0.5, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.2);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.2);
    });
  }

  // White noise burst (80ms)
  private playCameraShutter(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4000;
    filter.Q.value = 0.5;
    source.connect(filter).connect(gain).connect(dest);
    source.start(t);
  }

  // Subtle tick (30ms)
  private playClick(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Warm welcome chime (350ms)
  private playLoginSuccess(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const notes = [392, 523, 659]; // G4, C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const offset = i * 0.1;
      gain.gain.setValueAtTime(0.4, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.25);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.25);
    });
  }
}

export const soundManager = SoundManager.getInstance();
export type { SoundName };
