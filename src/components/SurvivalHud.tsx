import { Icon } from './Icon';
import { assetUrl } from '../game/assets';
import { healthPips } from '../game/hud';
import { condition, meterValue, VITALS } from '../game/vitals';
import type { GameView } from '../game/types';

export function SurvivalHud({ view, onDetails }: { view: GameView; onDetails: () => void }) {
  const health = meterValue(view.needs.health);
  return (
    <section
      className="survivor-panel hud-panel vitals-panel"
      aria-label="Survival status"
      data-frame="status"
    >
      <div className="vitals-top">
        <img className="vitals-portrait" src={assetUrl('art/ranger.png')} alt="" />
        <div className="survivor-details">
          <div className="survivor-heading">
            <h2>{view.name}</h2>
            <button
              className="vitals-details"
              onClick={onDetails}
              aria-label="Survival details"
              title="Your condition (H)"
            >
              <Icon name="info" size={14} />
            </button>
          </div>
          <div className="health-row">
            <div
              className={`health-pips ${condition(health)}`}
              role="meter"
              aria-label="Health"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.ceil(health)}
              aria-valuetext={`${Math.ceil(health)} of 100`}
            >
              {healthPips(health).map((fill, index) => (
                <span className="health-pip" key={index} aria-hidden="true">
                  <Icon name="heart" size={14} />
                  <i style={{ width: `${fill}%` }}>
                    <Icon name="heart" size={14} />
                  </i>
                </span>
              ))}
            </div>
            <b>
              {Math.ceil(health)}
              <small>/100</small>
            </b>
          </div>
        </div>
      </div>
      <div className="vital-rows">
        {(['hunger', 'thirst', 'warmth'] as const).map((key) => {
          const info = VITALS[key],
            value = meterValue(view.needs[key]);
          return (
            <div
              key={key}
              className={`vital-row ${condition(value)}`}
              role="meter"
              aria-label={info.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.ceil(value)}
              aria-valuetext={`${Math.ceil(value)} of 100, ${condition(value)}`}
              title={`${info.label}: ${Math.ceil(value)}/100. ${info.advice}`}
            >
              <Icon name={info.icon} size={16} />
              <span className="vital-label">{info.label}</span>
              <div className="vital-track" aria-hidden="true">
                <i style={{ width: `${value}%`, background: info.color }} />
              </div>
              <b>{Math.ceil(value)}</b>
              <span className="vital-warning" aria-hidden="true">
                {condition(value) === 'critical' ? '!' : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="vital-stamina"
        role="meter"
        aria-label="Stamina"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.ceil(meterValue(view.needs.stamina))}
        title="Stamina: rest or walk to recover"
      >
        <Icon name="stamina" size={12} />
        <div className="vital-track">
          <i style={{ width: `${meterValue(view.needs.stamina)}%` }} />
        </div>
        <span>STAMINA</span>
      </div>
    </section>
  );
}
