/** Presentation-only helpers; never round or alter the simulation's actual needs. */
export function healthPips(value: number): number[] {
  const health = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return Array.from({ length: 10 }, (_, index) => Math.min(100, Math.max(0, (health - index * 10) * 10)));
}

export function daylightAngle(hour: number): number {
  return Number.isFinite(hour) ? (((hour % 24) + 24) % 24) * 15 : 0;
}
