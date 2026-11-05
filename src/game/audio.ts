import { daylightAt } from './climate';
import type { WeatherMix } from './climate';
import { DEFAULT_SETTINGS } from './data';
import type { Settings } from './types';

// Procedural forest ambience: no remote audio, autoplay, or large audio downloads.
class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private rain: GainNode | null = null;
  private sceneDay = 1;
  private sceneRain = 0;
  private sceneCloud = 0;
  private lastScene = { day: -1, rain: -1, cloud: -1 };
  private birdTimer: ReturnType<typeof setInterval> | null = null;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  configure(settings: Settings) {
    this.settings = settings;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        settings.sound ? 0.45 * settings.masterVolume : 0,
        this.context.currentTime,
        0.15,
      );
    if (this.wind && this.context)
      this.wind.gain.setTargetAtTime(
        settings.ambience * (0.13 + this.sceneCloud * 0.1),
        this.context.currentTime,
        0.8,
      );
  }
  scene(time: number, weather: WeatherMix) {
    const day = daylightAt(time);
    if (
      Math.abs(day - this.lastScene.day) < 0.02 &&
      Math.abs(weather.rain - this.lastScene.rain) < 0.02 &&
      Math.abs(weather.cloud - this.lastScene.cloud) < 0.02 &&
      this.lastScene.day >= 0
    )
      return;
    this.lastScene = { day, rain: weather.rain, cloud: weather.cloud };
    this.sceneDay = day;
    this.sceneRain = weather.rain;
    this.sceneCloud = weather.cloud;
    if (!this.context) return;
    this.wind?.gain.setTargetAtTime(
      this.settings.ambience * (0.13 + weather.cloud * 0.1),
      this.context.currentTime,
      0.8,
    );
    this.rain?.gain.setTargetAtTime(
      this.settings.ambience * weather.rain * 0.16,
      this.context.currentTime,
      0.8,
    );
  }
  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.settings.sound ? 0.45 * this.settings.masterVolume : 0;
        this.master.connect(this.context.destination);
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
        const channel = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < channel.length; i++) {
          last = (last + Math.random() * 0.04 - 0.02) / 1.02;
          channel[i] = last * 5;
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 450;
        this.wind = this.context.createGain();
        this.wind.gain.value = this.settings.ambience * 0.13;
        source.connect(filter).connect(this.wind).connect(this.master);
        source.start();
        const rainBuffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
        const rainData = rainBuffer.getChannelData(0);
        for (let i = 0; i < rainData.length; i++) rainData[i] = Math.random() * 2 - 1;
        const rainSource = this.context.createBufferSource();
        rainSource.buffer = rainBuffer;
        rainSource.loop = true;
        const rainFilter = this.context.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.value = 2300;
        this.rain = this.context.createGain();
        this.rain.gain.value = this.settings.ambience * this.sceneRain * 0.16;
        rainSource.connect(rainFilter).connect(this.rain).connect(this.master);
        rainSource.start();
        this.birdTimer = setInterval(() => {
          if (
            this.settings.ambience > 0 &&
            !document.hidden &&
            this.settings.sound &&
            this.sceneDay > 0.2 &&
            this.sceneRain < 0.8
          )
            this.tone(
              1500 + Math.random() * 600,
              0.13,
              this.settings.ambience * 0.06 * this.sceneDay * (1 - this.sceneRain),
              'sine',
              2200,
            );
        }, 5800);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      // Audio is enhancement-only on restricted browsers.
      return false;
    }
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'triangle',
    endFrequency?: number,
  ) {
    if (
      !this.context ||
      !this.master ||
      !this.settings.sound ||
      this.settings.masterVolume <= 0 ||
      volume <= 0
    )
      return;
    const osc = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
  play = (
    sound: 'gather' | 'craft' | 'hit' | 'eat' | 'step' | 'notice' | 'click' | 'chop' | 'mine' | 'swish',
  ) => {
    const volume = this.settings.effects;
    if (sound === 'chop') {
      this.tone(160, 0.11, volume * 0.32, 'triangle', 55);
    }
    if (sound === 'mine') {
      this.tone(1050, 0.12, volume * 0.18, 'triangle', 350);
      this.tone(190, 0.08, volume * 0.18);
    }
    if (sound === 'swish') this.tone(90, 0.1, volume * 0.06, 'sawtooth', 220);
    if (sound === 'gather') this.tone(220, 0.075, volume * 0.25, 'triangle', 80);
    if (sound === 'step') this.tone(100 + Math.random() * 40, 0.04, volume * 0.07, 'sine', 45);
    if (sound === 'hit') this.tone(160, 0.15, volume * 0.23, 'sawtooth', 45);
    if (sound === 'eat') this.tone(480, 0.18, volume * 0.16, 'sine', 750);
    if (sound === 'craft') {
      this.tone(523, 0.18, volume * 0.14);
      setTimeout(() => this.tone(784, 0.25, volume * 0.13), 100);
    }
    if (sound === 'notice') this.tone(392, 0.4, volume * 0.08, 'sine', 494);
    if (sound === 'click') this.tone(650, 0.06, volume * 0.1, 'triangle', 850);
  };
  suspend() {
    if (this.context?.state === 'running') void this.context.suspend();
  }
  dispose() {
    if (this.birdTimer) clearInterval(this.birdTimer);
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.wind = null;
    this.rain = null;
    this.birdTimer = null;
  }
}
export const audio = new ForestAudio();
