import { DAY_LENGTH, clamp } from './data';
import type { Weather } from './types';

export function weatherAt(time: number): Weather {
  const day = Math.floor(time / DAY_LENGTH),
    phase = time % DAY_LENGTH;
  if (phase >= 48 && phase < 83) return day % 2 === 0 ? 'rain' : 'storm';
  if (phase >= 92 && phase < 119) return 'cold';
  if (phase >= 120 && phase < 154) return 'wolves';
  return 'clear';
}

export interface WeatherMix {
  rain: number;
  storm: number;
  cold: number;
  cloud: number;
}
export const WEATHER_FADE = 7;
export const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
export const hourAt = (time: number) =>
  (8 + ((((time % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH) / DAY_LENGTH) * 24) % 24;
/** Continuous, including midnight. Twilight is gameplay lighting, not decoration. */
export function daylightAt(time: number) {
  const hour = hourAt(time);
  return smoothstep(4.8, 7.8, hour) * (1 - smoothstep(17.4, 21.5, hour));
}
export function weatherTarget(weather: Weather): WeatherMix {
  return {
    rain: weather === 'rain' || weather === 'storm' ? 1 : 0,
    storm: weather === 'storm' ? 1 : 0,
    cold: weather === 'cold' ? 1 : 0,
    cloud: weather === 'storm' ? 1 : weather === 'rain' ? 0.8 : weather === 'cold' ? 0.3 : 0,
  };
}
/** Retarget from the current mix, never from a hard-coded prior preset. A storm
 * interrupted by another front stays continuous; pausing freezes its clock. */
export class WeatherTransition {
  private from: WeatherMix;
  private to: WeatherMix;
  private startedAt: number;
  private weather: Weather;
  constructor(weather: Weather, time: number) {
    this.weather = weather;
    this.from = this.to = weatherTarget(weather);
    this.startedAt = time - WEATHER_FADE;
  }
  static fromClock(weather: Weather, time: number) {
    if (weather !== weatherAt(time)) return new WeatherTransition(weather, time);
    const start = Math.max(0, Math.floor(time - WEATHER_FADE * 2));
    const transition = new WeatherTransition(weatherAt(start), start);
    for (let t = start + 1; t <= time; t++) transition.change(weatherAt(t), t);
    return transition;
  }
  at(time: number): WeatherMix {
    const t = smoothstep(0, WEATHER_FADE, time - this.startedAt);
    return {
      rain: this.from.rain + (this.to.rain - this.from.rain) * t,
      storm: this.from.storm + (this.to.storm - this.from.storm) * t,
      cold: this.from.cold + (this.to.cold - this.from.cold) * t,
      cloud: this.from.cloud + (this.to.cloud - this.from.cloud) * t,
    };
  }
  change(weather: Weather, time: number) {
    if (weather === this.weather) return;
    this.from = this.at(time);
    this.to = weatherTarget(weather);
    this.startedAt = time;
    this.weather = weather;
  }
}
export function darknessAt(time: number, weather: WeatherMix) {
  return clamp((1 - daylightAt(time)) * 0.93 + weather.cloud * 0.11, 0, 0.96);
}
