import { useEffect, useId, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { Icon, Key } from './Icon';
import { PixelPreview } from './PixelPreview';
import { DEFAULT_SETTINGS } from '../game/data';
import { audio } from '../game/audio';
import type { Settings } from '../game/types';

const SECTIONS = [
  { id: 'display', name: 'Display', icon: 'display', note: 'Pixels & atmosphere' },
  { id: 'audio', name: 'Audio', icon: 'audio', note: 'Sounds of the wild' },
  { id: 'interface', name: 'Interface', icon: 'pack', note: 'A clearer trail' },
  { id: 'controls', name: 'Controls', icon: 'controls', note: 'Know your tools' },
] as const;
type Section = (typeof SECTIONS)[number]['id'];
function chooseWithKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]'));
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) %
          buttons.length;
  buttons[next]?.focus();
  buttons[next]?.click();
}

function Toggle({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="field-setting-row">
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <button
        type="button"
        className={`pixel-switch ${value ? 'is-on' : ''}`}
        role="switch"
        aria-label={title}
        aria-checked={value}
        onClick={() => onChange(!value)}
      >
        <span aria-hidden="true">{value ? 'ON' : 'OFF'}</span>
        <i aria-hidden="true" />
      </button>
    </div>
  );
}
function Volume({
  title,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`field-volume ${disabled ? 'is-muted' : ''}`}>
      <span>
        {title}
        <output>
          {Math.round(value * 100)}
          <small>%</small>
        </output>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={`${title} volume`}
        disabled={disabled}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        style={{ '--level': `${value * 100}%` } as CSSProperties}
      />
      <span className="volume-endpoints" aria-hidden="true">
        <small>QUIET</small>
        <small>LOUD</small>
      </span>
    </label>
  );
}
export function SettingsDialog({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>('display');
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const id = useId();
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const select = (next: Section) => {
    setSection(next);
    setConfirmReset(false);
    setMessage('');
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setMessage('Display updated.');
    } catch {
      setMessage(
        'Fullscreen is unavailable in this preview. You can use your browser’s fullscreen shortcut.',
      );
    }
  };
  const preset =
    !settings.atmosphere && settings.reducedMotion && !settings.damageFlash
      ? 'quiet'
      : settings.atmosphere && !settings.reducedMotion && settings.damageFlash
        ? settings.pixelScale === 3
          ? 'close'
          : 'classic'
        : 'custom';
  const choosePreset = (value: string) =>
    onChange({
      ...settings,
      atmosphere: value !== 'quiet',
      reducedMotion: value === 'quiet',
      damageFlash: value !== 'quiet',
      pixelScale: value === 'close' ? 3 : 2,
    });
  const current = SECTIONS.find((item) => item.id === section)!;
  return (
    <Modal
      title="Settings"
      eyebrow="WILDPINE / MAKE IT YOUR WILD"
      className="settings-dialog"
      onClose={onClose}
      wide
    >
      <div className="field-settings-layout">
        <nav
          className="settings-rail"
          role="tablist"
          aria-label="Settings categories"
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return;
            event.preventDefault();
            const index = SECTIONS.findIndex((item) => item.id === section);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? SECTIONS.length - 1
                  : (index +
                      (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) +
                      SECTIONS.length) %
                    SECTIONS.length;
            select(SECTIONS[next].id);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`[data-section="${SECTIONS[next].id}"]`)
              ?.focus();
          }}
        >
          <span className="settings-rail-label" aria-hidden="true">
            FIELD PREFERENCES
          </span>
          {SECTIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-label={item.name}
              aria-selected={section === item.id}
              aria-controls={`${id}-panel`}
              id={`${id}-${item.id}`}
              tabIndex={section === item.id ? 0 : -1}
              data-section={item.id}
              data-autofocus={section === item.id || undefined}
              className={section === item.id ? 'selected' : ''}
              onClick={() => select(item.id)}
            >
              <Icon name={item.icon} size={28} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.note}</small>
              </span>
              <i aria-hidden="true">0{index + 1}</i>
            </button>
          ))}
          <div className="settings-rail-seal" aria-hidden="true">
            <Icon name="pineEmblem" size={38} />
            <small>
              A LITTLE WORLD.
              <br />
              YOUR KIND OF WILD.
            </small>
          </div>
        </nav>
        <section
          className="field-settings-content"
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${section}`}
          tabIndex={0}
        >
          <header className="settings-page-heading">
            <Icon name={current.icon} size={28} />
            <div>
              <span>{current.note}</span>
              <h3>
                {section === 'display'
                  ? 'Through the pines.'
                  : section === 'audio'
                    ? 'Listen a little closer.'
                    : section === 'interface'
                      ? 'Room to breathe.'
                      : 'A sure hand.'}
              </h3>
            </div>
          </header>
          {section === 'display' && (
            <>
              <div
                className="settings-presets"
                role="radiogroup"
                aria-label="Visual preset"
                onKeyDown={chooseWithKeys}
              >
                {['classic', 'quiet', 'close'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={preset === value}
                    tabIndex={preset === value || (preset === 'custom' && value === 'classic') ? 0 : -1}
                    onClick={() => choosePreset(value)}
                    className={preset === value ? 'selected' : ''}
                  >
                    <Icon
                      name={value === 'classic' ? 'tree' : value === 'quiet' ? 'leaf' : 'display'}
                      size={18}
                    />
                    {value === 'classic' ? 'Classic' : value === 'quiet' ? 'Quiet' : 'Close-up'}
                  </button>
                ))}
              </div>
              <div className="field-setting-row">
                <div>
                  <strong>Pixel scale</strong>
                  <p>Whole pixels. No smoothing. Changes your view of the world.</p>
                </div>
                <div
                  className="pixel-segmented"
                  role="radiogroup"
                  aria-label="Pixel scale"
                  onKeyDown={chooseWithKeys}
                >
                  {([2, 3] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      role="radio"
                      aria-checked={settings.pixelScale === scale}
                      tabIndex={settings.pixelScale === scale ? 0 : -1}
                      aria-label={`${scale}× pixel scale`}
                      className={settings.pixelScale === scale ? 'selected' : ''}
                      onClick={() => update('pixelScale', scale)}
                    >
                      {scale}×
                    </button>
                  ))}
                </div>
              </div>
              <Toggle
                title="Forest atmosphere"
                detail="Sun shafts, drifting leaves, embers, and footprints."
                value={settings.atmosphere}
                onChange={(value) => update('atmosphere', value)}
              />
              <Toggle
                title="Reduce motion"
                detail="Still ambience and clear action poses. Combat timing stays the same."
                value={settings.reducedMotion}
                onChange={(value) => update('reducedMotion', value)}
              />
              <Toggle
                title="Damage & storm flashes"
                detail="Brief hit highlights and storm lightning. Off removes both."
                value={settings.damageFlash}
                onChange={(value) => update('damageFlash', value)}
              />
              <Toggle
                title="Soft vignette"
                detail="Shade the outer edges of the world, without changing night difficulty."
                value={settings.vignette}
                onChange={(value) => update('vignette', value)}
              />
              <button className="field-setting-action" onClick={() => void toggleFullscreen()}>
                <Icon name="expand" size={18} />
                {fullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}
                <Icon name="arrow" size={16} />
              </button>
            </>
          )}
          {section === 'audio' && (
            <>
              <Toggle
                title="Forest sounds"
                detail="Mute everything without losing your chosen levels."
                value={settings.sound}
                onChange={(value) => update('sound', value)}
              />
              <Volume
                title="Master"
                value={settings.masterVolume}
                onChange={(value) => update('masterVolume', value)}
                disabled={!settings.sound}
              />
              <Volume
                title="Sound effects"
                value={settings.effects}
                onChange={(value) => update('effects', value)}
                disabled={!settings.sound}
              />
              <Volume
                title="Forest ambience"
                value={settings.ambience}
                onChange={(value) => update('ambience', value)}
                disabled={!settings.sound}
              />
              <button
                className="field-setting-action"
                disabled={!settings.sound || settings.masterVolume === 0 || settings.effects === 0}
                onClick={() => {
                  void audio.unlock().then((ready) => {
                    if (ready) audio.play('notice');
                    setMessage(
                      ready
                        ? 'Playing a sound check at your current levels.'
                        : 'Audio is unavailable in this browser. You can still adjust the levels.',
                    );
                  });
                }}
              >
                <Icon name="audio" size={20} />
                Test sound
                <Icon name="play" size={15} />
              </button>
              <p className="settings-note">
                Wind, birds, footsteps. No external streams or background music downloads.
              </p>
            </>
          )}
          {section === 'interface' && (
            <>
              <Toggle
                title="Compact HUD"
                detail="Hide the minimap and extra notices. Keep your health and pockets."
                value={settings.compactHud}
                onChange={(value) => update('compactHud', value)}
              />
              <Toggle
                title="Field objectives"
                detail="Your expedition checklist. No permanent control tutorial on the screen."
                value={settings.showHints}
                onChange={(value) => update('showHints', value)}
              />
              <Toggle
                title="Floating numbers"
                detail="Show gathered supplies and damage at the point of contact."
                value={settings.floatingText}
                onChange={(value) => update('floatingText', value)}
              />
              <div className="settings-feature-note">
                <Icon name="fire" size={24} />
                <div>
                  <strong>A quieter campfire.</strong>
                  <p>
                    Stand close to the hearth and the HUD clears away. One log action and live fuel. Movement
                    or danger brings the trail view back.
                  </p>
                </div>
              </div>
            </>
          )}
          {section === 'controls' && (
            <>
              <p className="settings-note">Four directions. Deliberate tools. Nothing equips itself.</p>
              <dl className="settings-bindings">
                <div>
                  <dt>Move</dt>
                  <dd>
                    <Key>W</Key>
                    <Key>A</Key>
                    <Key>S</Key>
                    <Key>D</Key>
                    <small>or arrow keys</small>
                  </dd>
                </div>
                <div>
                  <dt>Walk to a spot</dt>
                  <dd>
                    <Key>RIGHT CLICK</Key>
                  </dd>
                </div>
                <div>
                  <dt>Attack / use held item</dt>
                  <dd>
                    <Key>LEFT CLICK</Key>
                  </dd>
                </div>
                <div>
                  <dt>Interact / add a log</dt>
                  <dd>
                    <Key>E</Key>
                  </dd>
                </div>
                <div>
                  <dt>Defend (keyboard)</dt>
                  <dd>
                    <Key>SPACE</Key>
                  </dd>
                </div>
                <div>
                  <dt>Sprint / stow item</dt>
                  <dd>
                    <Key>SHIFT</Key>
                    <Key>X</Key>
                  </dd>
                </div>
                <div>
                  <dt>Choose a pocket</dt>
                  <dd>
                    <Key>1 — 6</Key>
                  </dd>
                </div>
                <div>
                  <dt>Backpack / crafting</dt>
                  <dd>
                    <Key>B</Key>
                    <Key>C</Key>
                  </dd>
                </div>
                <div>
                  <dt>Map / journal / pause</dt>
                  <dd>
                    <Key>M</Key>
                    <Key>J</Key>
                    <Key>ESC</Key>
                  </dd>
                </div>
              </dl>
              <div className="settings-feature-note">
                <Icon name="wolfMark" size={25} />
                <div>
                  <strong>Read the wind-up.</strong>
                  <p>
                    Wolves circle, commit to a lunge, then recover. Equip your hatchet before swinging. F is
                    unbound.
                  </p>
                </div>
              </div>
              <p className="settings-note">
                Touch: use the four-way pad, the held-item button, and E. The last held direction takes
                priority.
              </p>
            </>
          )}
          {message && (
            <p className="settings-feedback" role="status">
              {message}
            </p>
          )}
        </section>
        <aside className="field-settings-preview" aria-label="Settings preview">
          <div className="settings-preview-label">
            <span>LIVE LOOK</span>
            <Icon name="display" size={16} />
          </div>
          <div
            className="settings-preview-world"
            data-atmosphere={settings.atmosphere}
            data-vignette={settings.vignette}
          >
            <div className="settings-preview-sun" />
            <div className="settings-preview-survivor">
              <PixelPreview
                clip="idle-down"
                scale={settings.pixelScale}
                label="Survivor at your selected pixel scale"
              />
            </div>
            <div className="settings-preview-fire">
              <PixelPreview clip="fire-burn" scale={1} label="Campfire preview" />
            </div>
            <i />
            <i />
            <i />
          </div>
          <div className="settings-preview-caption">
            <strong>{settings.pixelScale}× PIXELS</strong>
            <span>{settings.reducedMotion ? 'A still moment.' : 'A little life in the pines.'}</span>
          </div>
          <dl>
            <div>
              <dt>Motion</dt>
              <dd>{settings.reducedMotion ? 'Reduced' : 'Full'}</dd>
            </div>
            <div>
              <dt>Atmosphere</dt>
              <dd>{settings.atmosphere ? 'On' : 'Off'}</dd>
            </div>
            <div>
              <dt>HUD</dt>
              <dd>{settings.compactHud ? 'Compact' : 'Full'}</dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd>{settings.sound ? `${Math.round(settings.masterVolume * 100)}%` : 'Muted'}</dd>
            </div>
          </dl>
          <p>
            <Icon name="save" size={13} />
            Preferences stay on this device when browser storage is available.
          </p>
        </aside>
      </div>
      <footer className="field-settings-footer">
        {confirmReset ? (
          <>
            <span>Restore all preferences? Your expedition stays safe.</span>
            <button onClick={() => setConfirmReset(false)}>Cancel</button>
            <button
              className="settings-done"
              onClick={() => {
                onChange({ ...DEFAULT_SETTINGS });
                setConfirmReset(false);
                setMessage('Default preferences restored. Your expedition is unchanged.');
              }}
            >
              Reset all preferences
            </button>
          </>
        ) : (
          <>
            <span>
              <Icon name="check" size={14} />
              Changes apply immediately
            </span>
            <button onClick={() => setConfirmReset(true)}>Restore defaults</button>
            <button className="settings-done" onClick={onClose}>
              Done <Icon name="check" size={14} />
            </button>
          </>
        )}
      </footer>
    </Modal>
  );
}
