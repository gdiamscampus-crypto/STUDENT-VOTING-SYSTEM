/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SoundType, AudioSettings } from './types';

// Default settings
let settings: AudioSettings = {
  enabled: true,
  volume: 0.6,
  soundToggles: {
    login_sound: true,
    select_sound: true,
    vote_success: true,
    warning_sound: true,
    winner_sound: true,
    new_vote_sound: true,
    election_started_sound: true,
    election_ended_sound: true,
    candidate_added_sound: true,
  },
};

// Store custom uploaded files' object URLs and names
const customSoundUrls: Record<string, string> = {};
const customSoundNames: Record<string, string> = {};

// Web Audio API context references
let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;

// Audio visualizer hook listener
type VisualizerCallback = (analyser: AnalyserNode) => void;
let visualizerCallback: VisualizerCallback | null = null;
let analyserNode: AnalyserNode | null = null;

export function setVisualizerCallback(callback: VisualizerCallback | null) {
  visualizerCallback = callback;
  if (callback && analyserNode) {
    callback(analyserNode);
  }
}

/**
 * Lazy initialization of the Web Audio Context
 */
function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    // Create master gain node
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(settings.volume, audioCtx.currentTime);
    
    // Create Analyser node for the visualizer
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    
    // Connect master gain to analyzer, and analyzer to destination
    masterGainNode.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  // Call visualizer callback if registered
  if (visualizerCallback && analyserNode) {
    visualizerCallback(analyserNode);
  }
  
  return { ctx: audioCtx, masterGain: masterGainNode };
}

/**
 * Updates settings dynamically
 */
export function updateAudioSettings(newSettings: Partial<AudioSettings>) {
  if (newSettings.enabled !== undefined) {
    settings.enabled = newSettings.enabled;
  }
  if (newSettings.volume !== undefined) {
    settings.volume = Math.max(0, Math.min(1, newSettings.volume));
    if (masterGainNode && audioCtx) {
      masterGainNode.gain.setValueAtTime(settings.volume, audioCtx.currentTime);
    }
  }
  if (newSettings.soundToggles !== undefined) {
    settings.soundToggles = { ...settings.soundToggles, ...newSettings.soundToggles };
  }
}

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

/**
 * Upload and register a custom sound file
 */
export function registerCustomSound(soundType: SoundType, file: File) {
  // Clean up existing Object URL if any
  if (customSoundUrls[soundType]) {
    URL.revokeObjectURL(customSoundUrls[soundType]);
  }
  
  const url = URL.createObjectURL(file);
  customSoundUrls[soundType] = url;
  customSoundNames[soundType] = file.name;
}

/**
 * Removes custom sound and reverts to synthesized default
 */
export function removeCustomSound(soundType: SoundType) {
  if (customSoundUrls[soundType]) {
    URL.revokeObjectURL(customSoundUrls[soundType]);
    delete customSoundUrls[soundType];
    delete customSoundNames[soundType];
  }
}

export function getCustomSoundName(soundType: SoundType): string | null {
  return customSoundNames[soundType] || null;
}

export function getCustomSoundUrl(soundType: SoundType): string | null {
  return customSoundUrls[soundType] || null;
}

/**
 * Main play function for playing sounds
 */
export function playSystemSound(soundType: SoundType) {
  if (!settings.enabled) return;
  if (!settings.soundToggles[soundType]) return;

  // 1. Check if a custom uploaded sound file exists
  const customUrl = customSoundUrls[soundType];
  if (customUrl) {
    try {
      // Play using native HTML5 Audio API
      const audio = new Audio(customUrl);
      audio.volume = settings.volume;
      audio.play().catch(err => {
        console.warn('Custom audio playback failed or was blocked:', err);
        // Fallback to synth if custom playback fails
        playSynthesizedSound(soundType);
      });
      return;
    } catch (e) {
      console.error('Error playing custom sound, falling back:', e);
    }
  }

  // 2. Play synthesized sound using Web Audio API
  playSynthesizedSound(soundType);
}

/**
 * Synthesizes creative, high-fidelity sounds directly in the browser
 */
function playSynthesizedSound(soundType: SoundType) {
  try {
    const { ctx, masterGain } = initAudio();
    const now = ctx.currentTime;

    switch (soundType) {
      case 'login_sound': {
        // Soft welcome sound - Ascending major arpeggio, warm, friendly
        const notes = [523.25, 659.25, 784.00, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          
          gainNode.gain.setValueAtTime(0, now + idx * 0.08);
          gainNode.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
          
          osc.connect(gainNode);
          gainNode.connect(masterGain);
          
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.4);
        });
        break;
      }
      
      case 'select_sound': {
        // Short high-quality click
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        // Fast pitch decay for a tactile click feel
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      
      case 'vote_success': {
        // Two positive success tones (crisp confirmation) + celebration upward sweep
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        
        // Success Tone 1: F5
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(698.46, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.2);
        
        // Success Tone 2: A5 (played slightly later)
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.2, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.45);
        
        // Celebration Sparkle: Fast cascading tones running upwards
        const sparkleNotes = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
        sparkleNotes.forEach((freq, idx) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          
          sOsc.type = 'sine';
          sOsc.frequency.setValueAtTime(freq, now + 0.25 + idx * 0.05);
          
          sGain.gain.setValueAtTime(0, now + 0.25 + idx * 0.05);
          sGain.gain.linearRampToValueAtTime(0.12, now + 0.25 + idx * 0.05 + 0.01);
          sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + idx * 0.05 + 0.15);
          
          sOsc.connect(sGain);
          sGain.connect(masterGain);
          
          sOsc.start(now + 0.25 + idx * 0.05);
          sOsc.stop(now + 0.25 + idx * 0.05 + 0.2);
        });
        break;
      }
      
      case 'warning_sound': {
        // Double warning buzz (dissonant and prominent)
        const buzzes = [now, now + 0.22];
        buzzes.forEach((startTime) => {
          // Play two slightly detuned oscillators to make a thick buzz/horn sound
          const oscA = ctx.createOscillator();
          const oscB = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          oscA.type = 'sawtooth';
          oscA.frequency.setValueAtTime(220.00, startTime); // A3
          
          oscB.type = 'sawtooth';
          oscB.frequency.setValueAtTime(222.50, startTime); // Detuned slightly
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, startTime);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
          
          oscA.connect(filter);
          oscB.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(masterGain);
          
          oscA.start(startTime);
          oscB.start(startTime);
          oscA.stop(startTime + 0.2);
          oscB.stop(startTime + 0.2);
        });
        break;
      }
      
      case 'winner_sound': {
        // 1. Grand Fanfare
        const fanfare = [392.00, 523.25, 659.25, 784.00, 1046.50]; // G4, C5, E5, G5, C6
        fanfare.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1200, now);
          
          const dur = idx === fanfare.length - 1 ? 1.5 : 0.3;
          gainNode.gain.setValueAtTime(0, now + idx * 0.12);
          gainNode.gain.linearRampToValueAtTime(0.15, now + idx * 0.12 + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + dur);
          
          osc.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(masterGain);
          
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + dur + 0.1);
        });

        // 2. Synthesized Crowd Applause and Cheering (White Noise simulation)
        // Create 2 seconds of white noise buffer
        const bufferSize = ctx.sampleRate * 2.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        // Filter the noise to sound like hand claps / crowd roar (bandpass centered at ~1000Hz)
        const filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        filterNode.frequency.setValueAtTime(1000, now);
        filterNode.Q.setValueAtTime(1.5, now);
        
        const noiseGain = ctx.createGain();
        // Envelope: Swell up and then fade
        noiseGain.gain.setValueAtTime(0, now + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0.12, now + 1.2);
        noiseGain.gain.linearRampToValueAtTime(0.06, now + 2.0);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        
        noiseSource.connect(filterNode);
        filterNode.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noiseSource.start(now + 0.5);
        noiseSource.stop(now + 2.8);
        break;
      }
      
      case 'new_vote_sound': {
        // High, crisp, friendly double chirp (ding-ding)
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1318.51, now); // E6
        osc.frequency.setValueAtTime(1567.98, now + 0.06); // G6
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.16, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      
      case 'election_started_sound': {
        // Inspiring upward perfect fifth (C4 to G4), bright wave
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.linearRampToValueAtTime(392.00, now + 0.4); // G4
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      
      case 'election_ended_sound': {
        // Transition downward perfect fifth (G4 to C4)
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(392.00, now); // G4
        osc.frequency.linearRampToValueAtTime(261.63, now + 0.4); // C4
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      
      case 'candidate_added_sound': {
        // Cheerful triple chirp: C5, E5, G5
        const notes = [523.25, 659.25, 784.00];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          
          gainNode.gain.setValueAtTime(0, now + idx * 0.06);
          gainNode.gain.linearRampToValueAtTime(0.15, now + idx * 0.06 + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.15);
          
          osc.connect(gainNode);
          gainNode.connect(masterGain);
          
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.2);
        });
        break;
      }
    }
  } catch (err) {
    console.error('Synthesized sound playback failed:', err);
  }
}
