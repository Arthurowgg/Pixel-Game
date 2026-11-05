import { Icon, ItemIcon, Key } from './Icon';
import type { CampView } from '../game/types';

export function CampfirePanel({
  camp,
  wood,
  onFeed,
  onLeave,
  saveIssue,
}: {
  camp: CampView;
  wood: number;
  onFeed: () => void;
  onLeave: () => void;
  saveIssue: boolean;
}) {
  const fuel = Math.max(0, Math.min(100, camp.fuel));
  const time = `${Math.floor(camp.secondsLeft / 60)}:${String(camp.secondsLeft % 60).padStart(2, '0')}`;
  return (
    <section className="campfire-scene" aria-label="By the campfire">
      <header className="hearth-scene-heading">
        <Icon name="pineEmblem" size={28} />
        <span>
          THE FOREST <i>/</i> A MOMENT BY THE FIRE
        </span>
        <button onClick={onLeave} aria-label="Leave campfire view">
          <Icon name="close" size={16} />
        </button>
      </header>
      <div
        className="hearth-panel"
        data-burning={fuel > 0}
        data-feeding={camp.feeding}
        data-seated={camp.seated}
      >
        <div className="hearth-panel-heading">
          <span className="hearth-flame">
            <Icon name="fire" size={28} />
          </span>
          <div>
            <span className="eyebrow">A LITTLE LIGHT. A LITTLE PEACE.</span>
            <h2>{fuel > 0 ? 'By the fire.' : 'Only embers remain.'}</h2>
          </div>
          <div className="hearth-fuel-number">
            <strong>
              {Math.ceil(fuel)}
              <small>%</small>
            </strong>
            <span>FUEL</span>
          </div>
        </div>
        <div
          className="hearth-fuel-track"
          role="meter"
          aria-label="Campfire fuel"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.ceil(fuel)}
        >
          <i style={{ width: `${fuel}%` }} />
        </div>
        <div className="hearth-supply-line">
          <span>
            <ItemIcon item="wood" size={23} />
            <b>{wood}</b> pine wood
          </span>
          <span>{fuel > 0 ? `~${time} of firelight` : 'A new log will relight it'}</span>
        </div>
        <button
          className="hearth-feed"
          disabled={!camp.canFeed}
          onClick={onFeed}
          aria-label={fuel > 0 ? 'Add one pine log' : 'Relight with one pine log'}
        >
          <Key>E</Key>
          <span>
            {camp.feeding
              ? 'Adding a log…'
              : fuel > 80
                ? 'The fire is well fed'
                : wood === 0
                  ? 'No pine wood in your pack'
                  : fuel > 0
                    ? 'Add a pine log'
                    : 'Relight the campfire'}
          </span>
          <b>{camp.feeding ? '…' : `+${Math.min(35, Math.floor(100 - fuel))}`}</b>
          {camp.feeding && <i style={{ width: `${camp.progress * 100}%` }} />}
        </button>
        <p className="hearth-caption" aria-live="polite">
          {camp.feeding
            ? 'One more log. A little more warmth.'
            : camp.seated
              ? 'Seated on the camp bench. Let the forest carry on.'
              : 'The forest carries on. Take a breath.'}
        </p>
        {saveIssue && (
          <p className="hearth-save-warning" role="status">
            <Icon name="info" size={13} />
            Local saving is unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
