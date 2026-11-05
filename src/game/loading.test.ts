import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSET_TIMEOUT, BOOT_TASKS, loadBitmap, loadTasks } from './loading';

class FakeImage {
  static instances: FakeImage[] = [];
  src = '';
  naturalWidth = 32;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn(() => Promise.resolve());
  constructor() {
    FakeImage.instances.push(this);
  }
}
function images() {
  FakeImage.instances = [];
  vi.stubGlobal('Image', FakeImage);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('honest, shared, retryable asset loading', () => {
  it('does not complete an image until it has decoded, and shares its promise', async () => {
    images();
    const promise = loadBitmap('test/decoded.png');
    expect(loadBitmap('test/decoded.png')).toBe(promise);
    const image = FakeImage.instances[0];
    let decode!: () => void;
    image.decode.mockReturnValue(
      new Promise<void>((resolve) => {
        decode = resolve;
      }),
    );
    let ready = false;
    void promise.then(() => {
      ready = true;
    });
    image.onload!();
    await Promise.resolve();
    expect(ready).toBe(false);
    decode();
    expect(await promise).toBe(image);
    expect(ready).toBe(true);
    expect(FakeImage.instances).toHaveLength(1);
    expect(image.src).toBe(`${import.meta.env.BASE_URL}test/decoded.png`);
  });
  it('evicts a failed image, retries only that resource, and retains successes', async () => {
    images();
    const success = loadBitmap('test/kept.png');
    FakeImage.instances[0].onload!();
    await success;
    const failed = loadBitmap('test/retry.png');
    FakeImage.instances[1].onerror!();
    await expect(failed).rejects.toThrow('Could not load');
    const retried = loadBitmap('test/retry.png');
    expect(retried).not.toBe(failed);
    FakeImage.instances[2].onload!();
    await retried;
    expect(loadBitmap('test/kept.png')).toBe(success);
    expect(FakeImage.instances).toHaveLength(3);
  });
  it('rejects corrupt and empty images instead of announcing ready', async () => {
    images();
    const corrupt = loadBitmap('test/corrupt.png');
    FakeImage.instances[0].decode.mockRejectedValue(new Error('Invalid PNG'));
    FakeImage.instances[0].onload!();
    await expect(corrupt).rejects.toThrow('Could not decode');
    const empty = loadBitmap('test/empty.png');
    FakeImage.instances[1].naturalWidth = 0;
    FakeImage.instances[1].onload!();
    await expect(empty).rejects.toThrow('Empty image');
  });
  it('times out stalled network requests and permits a later retry', async () => {
    images();
    vi.useFakeTimers();
    const stalled = loadBitmap('test/timeout.png');
    const rejected = expect(stalled).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(ASSET_TIMEOUT);
    await rejected;
    expect(FakeImage.instances[0].onload).toBeNull();
    const retried = loadBitmap('test/timeout.png');
    FakeImage.instances[1].onload!();
    await retried;
  });
  it('counts unique completed tasks, not calls or elapsed time', async () => {
    const load = vi.fn(async () => {});
    const progress = vi.fn();
    const first = { id: 'one', label: 'First image', load };
    await loadTasks([first, first, { id: 'two', label: 'Font', load }], progress);
    expect(load).toHaveBeenCalledTimes(2);
    expect(progress.mock.calls.map(([value]) => [value.completed, value.total])).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });
  it('does not count a failed task or report false completion', async () => {
    const progress = vi.fn();
    await expect(
      loadTasks(
        [
          { id: 'one', label: 'Good image', load: async () => {} },
          {
            id: 'two',
            label: 'Missing table',
            load: async () => {
              throw new Error('offline');
            },
          },
        ],
        progress,
      ),
    ).rejects.toThrow('Missing table');
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({ completed: 1, total: 2 });
  });
  it('detaches cancelled screens without late progress updates or cancelling shared work', async () => {
    const controller = new AbortController();
    const progress = vi.fn();
    let finish!: () => void;
    const shared = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const job = loadTasks(
      [{ id: 'pending', label: 'Pines', load: () => shared }],
      progress,
      controller.signal,
    );
    controller.abort();
    await expect(job).rejects.toMatchObject({ name: 'AbortError' });
    finish();
    await shared;
    await Promise.resolve();
    expect(progress).toHaveBeenCalledTimes(1);
  });
  it('handles already-cancelled and empty batches without starting work', async () => {
    const controller = new AbortController();
    controller.abort();
    const load = vi.fn(async () => {});
    await expect(
      loadTasks([{ id: 'no', label: 'Unused', load }], vi.fn(), controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
    const progress = vi.fn();
    await loadTasks([], progress);
    expect(progress).toHaveBeenCalledExactlyOnceWith({ completed: 0, total: 0, label: 'Preparing supplies' });
  });
  it('includes both custom scenes and title previews before the menu is available', () => {
    expect(new Set(BOOT_TASKS.map((task) => task.id)).size).toBe(BOOT_TASKS.length);
    expect(BOOT_TASKS.map((task) => task.id)).toEqual(
      expect.arrayContaining([
        'art/loading/forest-arrival.png',
        'art/loading/camp-arrival.png',
        'art/ui/fieldwork-frame.png',
        'art/animations/survivor.png',
        'art/forest-menu.webp',
        'art/item-sprites.png',
      ]),
    );
  });
});
