import { assetUrl } from '../game/assets';
import itemAtlas from '../game/item-atlas.json';
import generatedAssets from '../game/generated-assets.json';
import type { ItemId } from '../game/types';
import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  tree: 'M11 2h2v3h3v3h-2v2h5v3h-3v2h6v4H2v-4h6v-2H5v-3h5V8H8V5h3V2Zm0 18h2v3h-2z',
  arrow: 'M3 11h14V7h-3V4h3v3h3v3h3v4h-3v3h-3v3h-3v-3h3v-4H3z',
  play: 'M6 3h3v3h4v3h4v3h4v2h-4v3h-4v3H9v3H6z',
  heart: 'M3 4h6v3h6V4h6v3h3v8h-3v3h-3v3h-3v3H9v-3H6v-3H3v-3H0V7h3z',
  fire: 'M11 1h3v5h3v4h3v4h2v5h-3v3H5v-3H2v-7h3V7h3v7h3V1zm0 14v4h4v-4z',
  check: 'M2 11h4v4h4v-4h4V7h4V3h4v7h-4v4h-4v4h-4v4H6v-4H2z',
  lock: 'M7 2h10v3h3v6h2v12H2V11h2V5h3V2zm1 4v5h8V6H8zm2 9v5h4v-5z',
  leaf: 'M18 2h5v8h-3v5h-3v3h-6v3H7v3H3v-4h4v-4H4v-6h3V7h5V4h6V2zm-6 8v4h4v-4z',
  diamond: 'M10 1h4v4h4v4h4v6h-4v4h-4v4h-4v-4H6v-4H2V9h4V5h4z',
  spark: 'M10 1h4v7h3v2h6v4h-6v3h-3v6h-4v-6H7v-3H1v-4h6V8h3z',
  moon: 'M9 2h5v3h-4v4H7v7h3v3h7v-3h5v4h-3v3H7v-3H3v-4H1V8h3V5h5z',
  sun: 'M10 1h4v4h-4zM10 19h4v4h-4zM1 10h4v4H1zM19 10h4v4h-4zM5 3h3v3H5zM17 3h3v3h-3zM4 18h3v3H4zM18 18h3v3h-3zM8 7h8v2h2v6h-2v2H8v-2H6V9h2z',
  water: 'M10 1h4v5h3v4h3v5h2v5h-3v3H5v-3H2v-5h2v-5h3V6h3z',
  volume: 'M2 9h5V6h4V3h4v18h-4v-3H7v-3H2zM18 7h3v10h-3zM22 4h2v16h-2z',
  muted: 'M2 9h5V6h4V3h4v18h-4v-3H7v-3H2zM17 8h3v3h3v3h-3v3h-3v-3h3v-3h-3z',
  pack: 'M8 1h8v3h4v4h2v14H2V8h2V4h4V1zm2 3v2h4V4zm-4 7v8h12v-8zm3 3h6v3H9z',
  close: 'M4 2h3v3h3v3h4V5h3V2h3v5h-3v3h-3v4h3v3h3v5h-3v-3h-3v-3h-4v3H7v3H4v-5h3v-3h3v-4H7V7H4z',
  pause: 'M5 3h5v18H5zM14 3h5v18h-5z',
};
const lines: Record<string, string> = {
  settings: 'M9 2h6v4l3 2 3-1 2 5-3 2v3l-4 2-1 3H9l-1-3-4-2v-3l-3-2 2-5 3 1 3-2V2z M9 9h6v6H9z',
  expand: 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6',
  compass: 'M7 2h10l5 5v10l-5 5H7l-5-5V7l5-5z m8 7-2 5-5 2 2-5 5-2z',
  map: 'm2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3V5zM9 2v17m6-14v17',
  journal: 'M4 2h16v20H4V2zm4 5h8M8 11h8m-8 4h5M1 6h5m-5 6h5m-5 6h5',
  hammer: 'm3 5 5-3 8 8-5 5L3 7V5zm10 8 8 8-3 2-8-8m7-8 4-4 2 2-4 4',
  rain: 'M5 13H2V7h3V4h9v3h5v3h3v5H5m1 3-2 4m9-4-2 4m9-4-2 4',
  storm: 'M5 13H2V7h3V4h9v3h5v3h3v5h-6m-5-5-5 8h5l-3 6 9-10h-6l2-4',
  snow: 'M12 1v22M3 6l18 12M3 18 21 6M8 3l4 4 4-4M8 21l4-4 4 4M2 10l6-1-1-5m10 16-1-5 6-1m0-4-6-1 1-5M2 14l6 1-1 5',
  paw: 'M8 13h8l4 5-2 4H6l-2-4 4-5zM2 7h4v5H2zm6-5h3v6H8zm6 0h3v6h-3zm4 5h4v5h-4z',
  food: 'M3 2v7h6V2M6 2v20M17 2v20m0-20h4v11h-4',
  thermometer: 'M10 3h4v12l3 3v3H7v-3l3-3V3zm1 14h2v3h-2',
  flag: 'M4 23V2h16v10H4m0 11H1m3 0h3',
  arrowLeft: 'M21 12H3m7-7-7 7 7 7',
  chevron: 'm9 5 7 7-7 7',
  clock: 'M7 2h10l5 5v10l-5 5H7l-5-5V7l5-5zm5 4v7h5',
  shield: 'm3 3 9-2 9 2v12l-9 8-9-8V3zm5 9 3 3 6-7',
  save: 'M2 2h17l3 3v17H2V2zm4 0v7h11V2M7 22V13h10v9',
  info: 'M7 2h10l5 5v10l-5 5H7l-5-5V7l5-5zm5 8v7m0-12v2',
  home: 'm1 11 11-9 11 9h-3v11h-6v-7h-4v7H4V11H1z',
  keyboard: 'M2 5h20v14H2V5zm4 4h1m4 0h1m4 0h1M6 13h1m3 2h8',
};
export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const generated = Object.hasOwn(generatedAssets.icons, name)
    ? generatedAssets.icons[name as keyof typeof generatedAssets.icons]
    : null;
  if (generated)
    return (
      <img
        src={assetUrl(generated.file)}
        width={size}
        height={size}
        className={`icon icon-pixel ${className}`}
        style={{ imageRendering: 'pixelated', ...style }}
        alt=""
        aria-hidden="true"
        draggable={false}
        data-generated-icon={name}
      />
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`icon ${className}`}
      style={style}
      aria-hidden="true"
      fill={paths[name] ? 'currentColor' : 'none'}
      stroke={paths[name] ? 'none' : 'currentColor'}
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={paths[name] || lines[name] || lines.compass} />
    </svg>
  );
}
export function ItemIcon({ item, size = 32 }: { item: string; size?: number }) {
  if (!Object.hasOwn(itemAtlas.items, item)) return null;
  const rect = itemAtlas.items[item as ItemId];
  return (
    <svg
      className="item-icon"
      width={size}
      height={size}
      viewBox={`${rect.x} ${rect.y} ${rect.w} ${rect.h}`}
      data-item-sprite={item}
      aria-hidden="true"
      focusable="false"
      style={{ overflow: 'hidden' }}
    >
      <image href={assetUrl(itemAtlas.sheet)} width={itemAtlas.width} height={itemAtlas.height} />
    </svg>
  );
}
export function Key({ children }: { children: React.ReactNode }) {
  return <kbd>{children}</kbd>;
}
