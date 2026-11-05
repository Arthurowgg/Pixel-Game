import { Icon } from './Icon';
import type { GameState, Settings } from '../game/types';
import { DAY_LENGTH } from '../game/data';

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'brand-small' : ''}`}>
      <span className="brand-mark">
        <Icon name="tree" size={32} />
      </span>
      <div>
        <span className="brand-name">
          wildpine<span className="brand-dot">.</span>
        </span>
        {!small && <span className="brand-tagline">A LITTLE WORLD. A WILD LIFE.</span>}
      </div>
    </div>
  );
}
export function MainMenu({
  save,
  settings,
  onNew,
  onContinue,
  onSettings,
  onGuide,
  onFieldcraft,
  onJourney,
  onBiome,
  onSound,
}: {
  save: GameState | null;
  settings: Settings;
  onNew: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onGuide: () => void;
  onFieldcraft: () => void;
  onJourney: () => void;
  onBiome: (biome: string) => void;
  onSound: () => void;
}) {
  return (
    <div className="main-menu camp-title-screen">
      <header className="title-topline">
        <span>
          <Icon name="tree" size={15} /> CHAPTER I <i> / </i> THE FOREST
        </span>
        <button
          className="icon-button"
          onClick={onSound}
          aria-label={settings.sound ? 'Mute forest sounds' : 'Enable forest sounds'}
        >
          <Icon name={settings.sound ? 'volume' : 'muted'} size={18} />
        </button>
      </header>
      <main className="menu-world">
        <div className="menu-landscape" aria-hidden="true" />
        <div className="menu-shade" aria-hidden="true" />
        <div className="menu-motes" aria-hidden="true">
          {Array.from({ length: 13 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${37 + i * 4.7}%`,
                top: `${24 + ((i * 13) % 56)}%`,
                animationDelay: `${-i * 1.3}s`,
                animationDuration: `${5 + (i % 4)}s`,
              }}
            />
          ))}
        </div>
        <div className="menu-inner">
          <section className="menu-hero" aria-label="Welcome to Wildpine">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <Icon name="leaf" size={16} /> A LITTLE WORLD. A WILD LIFE.
              </div>
              <h1>
                WILDPINE<span>.</span>
              </h1>
              <p className="hero-description">A small camp. A big unknown.</p>
              <nav
                className="title-actions"
                aria-label="Adventure menu"
                onKeyDown={(event) => {
                  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
                  if (!keys.includes(event.key)) return;
                  const buttons = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
                  );
                  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? buttons.length - 1
                        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                  event.preventDefault();
                  buttons[next]?.focus();
                }}
              >
                <button
                  className="title-menu-button continue-button"
                  onClick={onContinue}
                  disabled={!save}
                  title={
                    save
                      ? `Continue ${save.name}'s adventure`
                      : 'Start an adventure to create your first save'
                  }
                >
                  <Icon name="play" size={18} />
                  <span>Continue</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button className="title-menu-button new-adventure" onClick={onNew}>
                  <Icon name="spark" size={20} />
                  <span>New adventure</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button className="title-menu-button" onClick={onGuide}>
                  <Icon name="journal" size={22} />
                  <span>Survival guide</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button className="title-menu-button" onClick={onFieldcraft}>
                  <Icon name="compass" size={22} />
                  <span>Fieldcraft</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button className="title-menu-button" onClick={onJourney}>
                  <Icon name="map" size={22} />
                  <span>Your journey</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button className="title-menu-button" onClick={onSettings}>
                  <Icon name="settings" size={19} />
                  <span>Settings</span>
                  <span className="menu-pointer" aria-hidden="true">
                    ›
                  </span>
                </button>
              </nav>
              {save && (
                <button
                  className="camp-save-summary"
                  onClick={onContinue}
                  aria-label={`Resume ${save.name}'s camp`}
                >
                  <Icon name="fire" size={20} />
                  <span>
                    <strong>{save.name}’s camp</strong>
                    <small>
                      {save.difficulty} · {save.nights}/3 sunrises · day{' '}
                      {Math.floor(save.time / DAY_LENGTH) + 1}
                    </small>
                  </span>
                  <Icon name="arrow" size={13} />
                </button>
              )}
              <div className="save-caption">
                <span className={`status-dot ${save ? 'is-live' : ''}`} />
                {save
                  ? `YOUR CAMP IS WAITING · DAY ${Math.floor(save.time / DAY_LENGTH) + 1}`
                  : 'YOUR FIRST CAMP IS WAITING.'}
              </div>
            </div>
            <aside className="scene-location">
              <Icon name="fire" size={21} />
              <div>
                <strong>Leave a little light behind.</strong>
                <span>SURVIVE THREE NIGHTS. FIND YOUR OWN WAY.</span>
              </div>
            </aside>
          </section>
          <section className="biome-section" aria-labelledby="biome-title">
            <div className="section-heading">
              <h2 id="biome-title">
                <Icon name="compass" size={15} /> Your wilderness
              </h2>
              <span className="region-count">
                THE FOREST <span> / </span> CHAPTER I
              </span>
            </div>
            <div className="biome-grid">
              <button
                className="biome-card biome-forest selected"
                onClick={onNew}
                aria-label="The Forest, selected and ready to explore"
              >
                <div className="biome-picture" />
                <div className="biome-card-shade" />
                <div className="biome-card-content">
                  <span className="biome-tag playable">
                    <span />
                    READY TO EXPLORE
                  </span>
                  <h3>The Forest</h3>
                  <p>Deep roots. Long nights. A new beginning.</p>
                  <div className="biome-meta">
                    <Icon name="tree" size={12} />
                    <span>TEMPERATE WOODLAND</span>
                    <span className="difficulty-dots">
                      <i />
                      <i />
                      <i className="empty" />
                    </span>
                  </div>
                </div>
                <span className="biome-selected">
                  <Icon name="check" size={11} />
                </span>
                <span className="biome-number">01</span>
              </button>
              <button
                className="biome-card biome-alpine locked"
                onClick={() => onBiome('The Alpine')}
                aria-label="The Alpine, coming soon"
              >
                <div className="biome-picture" />
                <div className="biome-card-shade" />
                <div className="biome-card-content">
                  <span className="biome-tag">
                    <Icon name="lock" size={9} />
                    ON THE HORIZON
                  </span>
                  <h3>The Alpine</h3>
                  <p>Thin air. Cold hands. No easy way down.</p>
                  <div className="biome-meta">
                    <Icon name="snow" size={12} />
                    <span>FROZEN HIGHLANDS</span>
                  </div>
                </div>
                <span className="biome-lock">
                  <Icon name="lock" size={16} />
                </span>
                <span className="biome-number">02</span>
              </button>
              <button
                className="biome-card biome-dunes locked"
                onClick={() => onBiome('The Dunes')}
                aria-label="The Dunes, coming soon"
              >
                <div className="biome-picture" />
                <div className="biome-card-shade" />
                <div className="biome-card-content">
                  <span className="biome-tag">
                    <Icon name="lock" size={9} />
                    ON THE HORIZON
                  </span>
                  <h3>The Dunes</h3>
                  <p>Endless sand. A very different kind of thirst.</p>
                  <div className="biome-meta">
                    <Icon name="sun" size={12} />
                    <span>ARID WILDERNESS</span>
                  </div>
                </div>
                <span className="biome-lock">
                  <Icon name="lock" size={16} />
                </span>
                <span className="biome-number">03</span>
              </button>
            </div>
          </section>
        </div>
      </main>
      <footer className="main-footer">
        <span className="version">
          <span />
          v0.9.0 <i> / </i> ROOTS & REFUGE
        </span>
        <span className="footer-motto">A LITTLE COURAGE GOES A LONG WAY.</span>
        <button onClick={onGuide} className="footer-guide">
          <Icon name="keyboard" size={15} />
          <span>HOW TO PLAY</span>
          <Icon name="arrow" size={11} />
        </button>
      </footer>
    </div>
  );
}
