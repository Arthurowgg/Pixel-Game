import { assetUrl } from './assets';
import registry from './generated-assets.json';

export interface LoadProgress {
  completed: number;
  total: number;
  label: string;
}
export interface AssetTask {
  id: string;
  label: string;
  load: () => Promise<unknown>;
}
export const ASSET_TIMEOUT = 15_000;
const images = new Map<string, Promise<HTMLImageElement>>();
const fonts = new Map<string, Promise<unknown>>();

/** One decoded bitmap per URL, shared by the title, previews, and world renderer.
 * A failed request is evicted, so Retry never reuses a rejected promise. */
export function loadBitmap(path: string): Promise<HTMLImageElement> {
  const url = assetUrl(path);
  const cached = images.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error(`Timed out: ${path}`)), ASSET_TIMEOUT);
    image.onload = () => {
      if (!image.naturalWidth) return finish(new Error(`Empty image: ${path}`));
      if (typeof image.decode === 'function')
        void image.decode().then(
          () => finish(),
          () => finish(new Error(`Could not decode: ${path}`)),
        );
      else finish();
    };
    image.onerror = () => finish(new Error(`Could not load: ${path}`));
    image.src = url;
  });
  images.set(url, promise);
  void promise.catch(() => {
    if (images.get(url) === promise) images.delete(url);
  });
  return promise;
}

export function imageTask(path: string, label: string): AssetTask {
  return { id: path, label, load: () => loadBitmap(path) };
}

function loadFont(font: string) {
  const cached = fonts.get(font);
  if (cached) return cached;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${font}`)), ASSET_TIMEOUT);
    void document.fonts.load(font, 'Wildpine 0123456789').then(
      (faces) => {
        clearTimeout(timer);
        resolve(faces);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
  fonts.set(font, promise);
  void promise.catch(() => {
    if (fonts.get(font) === promise) fonts.delete(font);
  });
  return promise;
}

/** Progress counts completed, decoded resources, not a time-based pretend percentage.
 * Aborting detaches this consumer without cancelling resources another screen may need. */
export async function loadTasks(
  tasks: readonly AssetTask[],
  onProgress: (progress: LoadProgress) => void = () => {},
  signal?: AbortSignal,
) {
  const unique = [...new Map(tasks.map((task) => [task.id, task])).values()];
  let completed = 0;
  if (signal?.aborted) throw new DOMException('Loading cancelled', 'AbortError');
  onProgress({ completed, total: unique.length, label: 'Preparing supplies' });
  let abort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new DOMException('Loading cancelled', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
  });
  const work = Promise.allSettled(
    unique.map(async (task) => {
      await task.load();
      if (!signal?.aborted) onProgress({ completed: ++completed, total: unique.length, label: task.label });
    }),
  ).then((results) => {
    const failed = results.flatMap((result, index) =>
      result.status === 'rejected' ? [unique[index].label] : [],
    );
    if (failed.length)
      throw new Error(`Missing supplies: ${failed.join(', ')}. Check your connection and try again.`);
  });
  try {
    await Promise.race([work, cancelled]);
  } finally {
    if (abort) signal?.removeEventListener('abort', abort);
  }
}

export const BOOT_TASKS: AssetTask[] = [
  imageTask('art/forest-menu.webp', 'Title woodland'),
  imageTask('art/alpine.png', 'Alpine postcard'),
  imageTask('art/dunes.png', 'Dunes postcard'),
  imageTask('art/ranger.png', 'Survivor portrait'),
  imageTask('art/item-sprites.png', 'Satchel supplies'),
  imageTask('art/animations/survivor.png', 'Survivor previews'),
  imageTask('art/animations/camp.png', 'Campfire preview'),
  imageTask('art/animations/wolf-run.png', 'Wildlife preview'),
  ...Object.entries(registry.icons).map(([key, asset]) => imageTask(asset.file, `${key} emblem`)),
  ...Object.entries(registry.frames).map(([key, asset]) => imageTask(asset.file, `${key} frame`)),
  ...Object.entries(registry.scenes).map(([key, asset]) => imageTask(asset.file, `${key} woodland`)),
  ...[
    '400 16px "Pixelify Sans"',
    '500 16px "Pixelify Sans"',
    '700 16px "Pixelify Sans"',
    '400 16px "DM Sans"',
    '600 16px "DM Sans"',
    '400 12px "Space Mono"',
  ].map((font) => ({ id: font, label: 'Field lettering', load: () => loadFont(font) })),
];

export const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
/** A short transition only. The displayed number remains the actual completed count. */
export const finishTransition = (started: number, minimum = 500) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, minimum - (performance.now() - started))));
