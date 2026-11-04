import type { CSSProperties } from 'react';
import { CLIPS, SHEETS } from '../game/animation';
import { assetUrl } from '../game/assets';

/** Menus preview the same pixel sheets that the Canvas renderer uses in-game. */
export function PixelPreview({
  clip: name,
  scale = 2,
  label,
}: {
  clip: string;
  scale?: number;
  label: string;
}) {
  const clip = CLIPS[name];
  const sheet = SHEETS[clip.sheet as keyof typeof SHEETS];
  const grid = clip.columns === 4 && clip.frames === 8;
  const style = {
    width: clip.w * scale,
    height: clip.h * scale,
    backgroundImage: `url("${assetUrl(`art/animations/${clip.sheet}.png`)}")`,
    backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
    backgroundPositionY: -clip.y * scale,
    animationDuration: `${clip.frames / clip.fps}s`,
    animationName: name.startsWith('idle-') ? 'none' : grid ? 'sprite-grid-loop' : 'sprite-preview-loop',
    animationTimingFunction: grid ? 'steps(1, end)' : `steps(${clip.frames})`,
    '--sprite-step': `${clip.w * scale}px`,
    '--sprite-row-one': `${-clip.y * scale}px`,
    '--sprite-row-two': `${-(clip.y + clip.h) * scale}px`,
    '--sprite-end': `${-clip.frames * clip.w * scale}px`,
  } as CSSProperties;
  return <span className="pixel-preview" style={style} role="img" aria-label={label} />;
}
