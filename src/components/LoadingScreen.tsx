import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { assetUrl } from '../game/assets';
import type { LoadProgress } from '../game/loading';
import type { GameState } from '../game/types';

const TIPS = [
  [
    'A place to begin',
    'The camp has a fire and a resting bench. Build your first workbench by hand to unlock the full workshop.',
  ],
  [
    'Travel light. Stay ready.',
    'Your pockets hold anything. Choose with 1–6, then left-click to use what you’re holding.',
  ],
  [
    'A little warmth goes a long way',
    'Cook stew or brew berry tea beside a burning fire. Remember to feed it pine wood.',
  ],
  ['The forest can wait', 'Your satchel, map, and crafting menu pause the world. Take your time.'],
];
export function LoadingScreen({
  kind,
  progress,
  phase,
  error,
  onRetry,
  onBack,
  world,
  reducedMotion = false,
  returning = false,
}: {
  kind: 'boot' | 'world';
  progress: LoadProgress;
  phase: string;
  error?: string | null;
  onRetry: () => void;
  onBack?: () => void;
  world?: GameState;
  reducedMotion?: boolean;
  returning?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState(0);
  const percent = progress.total ? Math.floor((progress.completed / progress.total) * 100) : 0;
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (error) retry.current?.focus({ preventScroll: true });
  }, [error]);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setTip((value) => (value + 1) % TIPS.length), 6500);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`loading-screen loading-${kind} ${kind === 'world' ? 'forest-loading' : 'boot-loading'} ${error ? 'loading-error' : ''}`}
      aria-labelledby={`${id}-title`}
      aria-busy={!error}
      data-phase={error ? 'error' : phase}
    >
      <div className="loading-landscape" aria-hidden="true" />
      <div className="loading-shade" aria-hidden="true" />
      <div className="loading-motes" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${9 + index * 8.7}%`,
              top: `${26 + ((index * 17) % 48)}%`,
              animationDelay: `${-index * 1.4}s`,
            }}
          />
        ))}
      </div>
      <header className="loading-topline">
        <span>
          <Icon name="tree" size={15} /> WILDPINE <i>/</i> A LITTLE WORLD. A WILD LIFE.
        </span>
        <span className="loading-chapter">
          CHAPTER I <i>·</i> THE FOREST
        </span>
      </header>
      <main className="loading-story">
        <img
          className="loading-emblem"
          src={assetUrl('art/ui/pine-emblem.png')}
          alt=""
          width={80}
          height={80}
        />
        <span className="loading-kicker">
          {kind === 'boot'
            ? 'SOMEWHERE BEYOND THE EVERYDAY'
            : returning
              ? 'THE PATH BACK HOME'
              : 'YOUR FIRST FOOTSTEPS'}
        </span>
        <h1 id={`${id}-title`}>
          {kind === 'boot' ? (
            <>
              WILDPINE<span>.</span>
            </>
          ) : (
            'The Forest'
          )}
        </h1>
        <p className="loading-subtitle">
          {kind === 'boot'
            ? 'A little world. A wild life.'
            : returning
              ? `Welcome back, ${world?.name}.`
              : 'A small camp. A big unknown.'}
        </p>
        {kind === 'world' && world && (
          <div className="loading-camp-details">
            <span>
              <Icon name="sun" size={16} /> Day {Math.floor(world.time / 180) + 1}
            </span>
            <span>
              <Icon name="leaf" size={16} /> {world.difficulty}
            </span>
            <span>
              <Icon name="home" size={16} /> {world.nights}/3 sunrises
            </span>
          </div>
        )}
      </main>
      <div className="loading-bottom">
        <div className="loading-progress-area">
          <div className="loading-phase">
            <span role="status" aria-live="polite">
              {error ? 'A few supplies didn’t arrive.' : phase}
            </span>
            <b aria-hidden="true">
              {String(percent).padStart(2, '0')}
              <small>%</small>
            </b>
          </div>
          <div
            className="loading-track"
            role="progressbar"
            aria-label={kind === 'boot' ? 'Preparing Wildpine' : 'Preparing your world'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${progress.completed} of ${progress.total} resources and preparation steps complete`}
          >
            <div className="loading-track-fill" style={{ width: `${percent}%` }} />
            <span className="loading-trail-marker" style={{ left: `${percent}%` }} aria-hidden="true">
              <Icon name="tree" size={15} />
            </span>
          </div>
          <div className="loading-count" aria-hidden="true">
            <span>{error ? 'YOUR SAVED CAMP IS SAFE' : progress.label}</span>
            <span>
              {progress.completed} / {progress.total}
            </span>
          </div>
        </div>
        {error ? (
          <div className="loading-recovery">
            <p role="alert">{error}</p>
            <div>
              <button ref={retry} className="button button-primary" onClick={onRetry}>
                <Icon name="spark" size={16} /> Retry loading
              </button>
              {onBack && (
                <button className="button button-secondary" onClick={onBack}>
                  Return to main menu
                </button>
              )}
            </div>
          </div>
        ) : (
          <aside className="loading-tip" aria-label="Trail tip">
            <Icon name={kind === 'boot' ? 'compass' : 'workbench'} size={25} />
            <div>
              <strong>{TIPS[tip][0]}</strong>
              <p>{TIPS[tip][1]}</p>
            </div>
          </aside>
        )}
        <footer className="loading-footer">
          <span>TAKE A BREATH. THE WILD IS WAITING.</span>
          {onBack && !error ? (
            <button onClick={onBack}>
              Back to title <span>↗</span>
            </button>
          ) : (
            <span>HEARTH &amp; HAND</span>
          )}
        </footer>
      </div>
    </section>
  );
}
