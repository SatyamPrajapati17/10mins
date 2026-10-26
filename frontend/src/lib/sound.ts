// frontend/src/lib/sound.ts
/**
 * Control-Room Tactical Audio Engine (Web Audio API)
 * Generates synthesized avionic and telemetry tones with zero external audio assets.
 * Adheres to control-room design standards: calm, distinct frequencies, no harsh clipping.
 */

import { HypothesisKey, ActionType } from './types';

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private masterGain: GainNode | null = null;

  constructor() {
    // Check localStorage preference
    const saved = localStorage.getItem('first10_sound_enabled');
    this.enabled = saved !== null ? saved === 'true' : true;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime); // Safe, calm master volume
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('first10_sound_enabled', String(this.enabled));
    if (this.enabled) {
      this.initContext();
      this.playTactileClick();
    }
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    localStorage.setItem('first10_sound_enabled', String(val));
    if (val) this.initContext();
  }

  /**
   * Subtle tactile UI click (500Hz sine decayed in 20ms)
   */
  public playTactileClick() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.025);
  }

  /**
   * Sound for dominant hypothesis shifts
   */
  public playHypothesisShift(hypothesis: HypothesisKey) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    switch (hypothesis) {
      case 'noise': {
        // Calm single 440Hz harmonic drop (all clear)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + 0.16);
        break;
      }

      case 'sensor_failure': {
        // Glitch tone: slight frequency wobble / square harmonic
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.08);
        osc.frequency.linearRampToValueAtTime(220, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + 0.21);
        break;
      }

      case 'isolated': {
        // Amber chime: two rising notes (D5 -> G5)
        const notes = [587, 784];
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.20, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.12);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.13);
        });
        break;
      }

      case 'cascade': {
        // High-priority cascade alert: three pulsing tactical harmonics
        const pulseNotes = [659, 784, 988]; // E5, G5, B5
        pulseNotes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.10);
          gain.gain.setValueAtTime(0.28, now + idx * 0.10);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.10 + 0.15);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.10);
          osc.stop(now + idx * 0.10 + 0.16);
        });
        break;
      }
    }
  }

  /**
   * Sound for Action Controller state escalation
   */
  public playActionTransition(action: ActionType) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    switch (action) {
      case 'WATCH': {
        // Calm confirmation
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + 0.13);
        break;
      }

      case 'PREPARE': {
        // Soft double-pulse
        [523, 659].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.14);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.15);
        });
        break;
      }

      case 'ALERT': {
        // Distinct alert beacon chime
        [784, 880, 1046].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.24, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.16);
        });
        break;
      }

      case 'ESCALATE': {
        // Urgent two-tone military command alarm (Klaxon harmonic)
        const freqs = [880, 1174, 880, 1174]; // A5 -> D6 -> A5 -> D6
        freqs.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.32, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.13);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.14);
        });
        break;
      }
    }
  }

  /**
   * Sound for fault injection in the Simulation Lab
   */
  public playFaultTriggered() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(now + 0.19);
  }

  /**
   * Sound for authorization approvals / submissions
   */
  public playAuthConfirmation(approved: boolean) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    if (approved) {
      // Pleasant rising major chord
      [523, 659, 784].forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.20, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.20);
      });
    } else {
      // Reject buzzer
      [350, 310].forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.14);
      });
    }
  }
}

export const sound = new TacticalAudioEngine();
