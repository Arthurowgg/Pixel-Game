import { PixelPreview } from './PixelPreview';
import { useState } from 'react';
import { Icon, Key } from './Icon';
import { Modal } from './Modal';
import type { Difficulty, GameState, RunRecord, Settings } from '../game/types';
import { DAY_LENGTH } from '../game/data';

export function NewAdventure({
  hasSave,
  onClose,
  onStart,
}: {
  hasSave: boolean;
  onClose: () => void;
  onStart: (name: string, difficulty: Difficulty) => void;
}) {
  const [name, setName] = useState('Wanderer');
  const [difficulty, setDifficulty] = useState<Difficulty>('survivor');
  const descriptions = {
    explorer: 'Take a breath. Gentler hunger, thirst, and weather. One wolf at a time.',
    survivor: 'The way the forest was meant to feel. A little peace. A little peril.',
    wild: 'The woods don’t pull their punches. Harsher conditions. Larger wolf packs.',
  };
  return (
    <Modal
      title="Every story starts somewhere."
      eyebrow="A NEW ADVENTURE"
      onClose={onClose}
      className="setup-dialog"
    >
      <div className="setup-preview">
        <div className="setup-character">
          <PixelPreview clip="idle-down" label="Your forest survivor" />
        </div>
        <div>
          <span className="eyebrow">YOUR FIRST CHAPTER</span>
          <h3>The Forest</h3>
          <p>
            Gather. Build. Brave the unexpected.
            <br />
            Make it through three nights.
          </p>
          <span className="small-badge">
            <Icon name="clock" size={12} /> ~9 MINUTE CHALLENGE
          </span>
        </div>
        <Icon name="tree" size={53} className="setup-pine" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onStart(name, difficulty);
        }}
      >
        <label className="input-label" htmlFor="survivor-name">
          WHAT SHOULD THE FOREST CALL YOU?<span>20 characters max</span>
        </label>
        <input
          id="survivor-name"
          autoComplete="off"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wanderer"
          data-autofocus
        />
        <div className="input-label difficulty-label">FIND YOUR KIND OF WILD</div>
        <div className="difficulty-options" role="radiogroup" aria-label="Difficulty">
          {(['explorer', 'survivor', 'wild'] as Difficulty[]).map((d, i) => (
            <button
              type="button"
              key={d}
              role="radio"
              aria-checked={difficulty === d}
              className={difficulty === d ? 'selected' : ''}
              onClick={() => setDifficulty(d)}
            >
              <span className="difficulty-symbols">
                {Array.from({ length: 3 }, (_, n) => (
                  <i key={n} className={n <= i ? 'filled' : ''} />
                ))}
              </span>
              <strong>{d.charAt(0).toUpperCase() + d.slice(1)}</strong>
              {difficulty === d && <Icon name="check" size={11} />}
            </button>
          ))}
        </div>
        <p className="difficulty-description">{descriptions[difficulty]}</p>
        {hasSave && (
          <div className="inline-notice">
            <Icon name="info" size={16} />
            <span>A fresh start will replace your current adventure.</span>
          </div>
        )}
        <button className="button button-primary full-width" type="submit">
          <Icon name="tree" size={17} />
          <span>Enter the forest</span>
          <Icon name="arrow" size={17} />
        </button>
        <p className="autosave-note">
          <Icon name="save" size={12} />
          Your progress is saved automatically on this device.
        </p>
      </form>
    </Modal>
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
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const update = (key: keyof Settings, value: boolean | number) => onChange({ ...settings, [key]: value });
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenMessage('Display updated.');
    } catch {
      setFullscreenMessage(
        'Fullscreen is not available in this preview. Try your browser’s fullscreen shortcut.',
      );
    }
  };
  return (
    <Modal title="Make yourself comfortable." eyebrow="SETTINGS" onClose={onClose}>
      <div className="settings-section">
        <h3>
          <Icon name="volume" size={17} />
          Sounds of the wild
        </h3>
        <SettingToggle
          title="Forest sounds"
          description="A little wind. A few birds. Your own footsteps."
          checked={settings.sound}
          onChange={(v) => update('sound', v)}
        />
        <label className="slider-row">
          <span>Sound effects</span>
          <input
            aria-label="Sound effects volume"
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.effects * 100)}
            onChange={(e) => update('effects', +e.target.value / 100)}
          />
          <output>{Math.round(settings.effects * 100)}%</output>
        </label>
        <label className="slider-row">
          <span>Forest ambience</span>
          <input
            aria-label="Forest ambience volume"
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.ambience * 100)}
            onChange={(e) => update('ambience', +e.target.value / 100)}
          />
          <output>{Math.round(settings.ambience * 100)}%</output>
        </label>
      </div>
      <div className="settings-section">
        <h3>
          <Icon name="spark" size={17} />
          Your view of things
        </h3>
        <SettingToggle
          title="Forest atmosphere"
          description="Sun rays, leaves, campfire smoke, footsteps, splashes, and impact sparks."
          checked={settings.atmosphere}
          onChange={(v) => update('atmosphere', v)}
        />
        <SettingToggle
          title="Reduce motion"
          description="Less ambient movement. Actions keep two clear key poses."
          checked={settings.reducedMotion}
          onChange={(v) => update('reducedMotion', v)}
        />
        <SettingToggle
          title="Compact HUD"
          description="A quieter view. Hide the minimap, repeated hints, and extra notices. Map and journal stay one key away."
          checked={settings.compactHud}
          onChange={(value) => update('compactHud', value)}
        />
        <SettingToggle
          title="Helpful hints"
          description="Show controls and your first survival checklist."
          checked={settings.showHints}
          onChange={(v) => update('showHints', v)}
        />
        <button className="setting-fullscreen" onClick={fullscreen}>
          <span>
            <Icon name="expand" size={17} />
            Toggle fullscreen
          </span>
          <Icon name="arrow" size={14} />
        </button>
        {fullscreenMessage && (
          <p className="settings-feedback" role="status">
            {fullscreenMessage}
          </p>
        )}
      </div>
      <div className="settings-footnote">
        <Icon name="save" size={14} />
        Preferences save automatically. Just like your adventure.
      </div>
    </Modal>
  );
}
function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button
        className={`toggle ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function GuideDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('basics');
  return (
    <Modal
      title="A little know-how goes a long way."
      eyebrow="THE SURVIVAL GUIDE"
      onClose={onClose}
      wide
      className="guide-dialog"
    >
      <div className="dialog-tabs" role="tablist" aria-label="Survival guide chapters">
        {[
          ['basics', 'The basics'],
          ['controls', 'Your controls'],
          ['threats', 'Expect the unexpected'],
        ].map(([id, title]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? 'active' : ''}
          >
            {title}
          </button>
        ))}
      </div>
      {tab === 'basics' && (
        <div className="guide-content" role="tabpanel">
          <p className="guide-intro">
            You don’t need to conquer the forest. Just learn to live in it.
            <br />
            <strong>Your first goal: see the sun rise three times.</strong>
          </p>
          <div className="guide-grid">
            {[
              [
                'tree',
                '01',
                'Start with the small things.',
                'Walk up to pines, boulders, and plants. Hold E to gather; your axe or pickaxe is readied automatically. Three axe swings fell a pine and reveal a portion of pine nuts; two pickaxe strikes break a boulder.',
              ],
              [
                'fire',
                '02',
                'Keep a little light alive.',
                'Your starting campfire won’t last forever. Feed it wood with E. Stay nearby to keep warm and discourage curious wolves.',
              ],
              [
                'hammer',
                '03',
                'Make the forest your home.',
                'Visit the crafting table east of your first fire. Press E or C, make a shelter with 10 wood and 6 fiber, then place the kit from your backpack.',
              ],
              [
                'water',
                '04',
                'Look after yourself.',
                'Select berries with 3 or water with 4, then press F to use what you hold. Refill at the spring northeast of camp. Brew berry tea beside a fire: two berries and one water restore thirst and warmth.',
              ],
            ].map(([icon, number, title, text]) => (
              <article className="guide-step" key={number}>
                <div className="guide-step-top">
                  <Icon name={icon} size={23} />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="guide-tip">
            <Icon name="leaf" size={18} />
            <p>
              Take your time. Opening your backpack, map, or any menu pauses the world. And your progress
              saves every five seconds.
            </p>
          </div>
        </div>
      )}
      {tab === 'controls' && (
        <div className="controls-content" role="tabpanel">
          <p className="guide-intro">Simple tools. A world of possibilities.</p>
          <div className="control-list">
            {[
              [
                ['W', 'A', 'S', 'D'],
                'Find your way',
                'Move up, down, left, or right. The last held direction takes priority; arrow keys work too.',
              ],
              [['SHIFT'], 'Pick up the pace', 'Hold while moving to sprint. Keep an eye on your stamina.'],
              [['H'], 'Check your condition', 'Health, survival needs, and practical advice.'],
              [['E'], 'A helping hand', 'Gather, chop, refill water, feed a fire, or rest.'],
              [
                ['SPACE'],
                'Stand your ground',
                'Swing what you’re holding. An axe or pickaxe hits harder than empty hands.',
              ],
              [
                ['F'],
                'Put it to use',
                'Use your held item, chop with an axe, or mine with a pickaxe. Right-click works too.',
              ],
              [['X'], 'Travel light', 'Stow what you’re holding and keep your hands free.'],
              [
                ['1', '—', '6'],
                'Keep it close',
                'Select what to hold: hatchet, pickaxe, berries, water, bandage, torch. Pin any item to any slot from your backpack.',
              ],
              [
                ['B', 'C'],
                'Make something of it',
                'B opens your backpack. C opens the workshop. Use E at the camp table.',
              ],
              [['M', 'J'], 'Know where you stand', 'M opens the map. J opens your field journal.'],
              [['ESC'], 'Take a breather', 'Pause your journey. The forest can wait.'],
            ].map(([keys, title, text]) => (
              <div className="control-row" key={title as string}>
                <div className="control-keys">
                  {(keys as string[]).map((k) => (
                    <Key key={k}>{k}</Key>
                  ))}
                </div>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="guide-tip">
            <Icon name="compass" size={18} />
            <p>
              On a touch screen, use the on-screen directional pad and action buttons. You can also click or
              tap the ground to walk there; steer around trees and water.
            </p>
          </div>
        </div>
      )}
      {tab === 'threats' && (
        <div className="threats-content" role="tabpanel">
          <p className="guide-intro">A quiet forest. Until it isn’t.</p>
          {[
            [
              'rain',
              'Rain & thunderstorms',
              'Clouds gather without asking. Wet weather drains your warmth and burns through firewood faster. A shelter or a well-fed fire makes all the difference.',
            ],
            [
              'snow',
              'Cold snaps',
              'The nights have teeth. A cold snap can drain warmth even faster than rain. Keep wood in reserve, or light a torch when you have to leave camp.',
            ],
            [
              'paw',
              'Unwelcome company',
              'Wolf packs emerge at night. Hold your hatchet and swing with Space—two hits make a wolf retreat. Better yet, stay in the firelight or carry a burning torch.',
            ],
            [
              'moon',
              'The long night',
              'One day lasts three real minutes. The forest darkens at 20:00, and dawn arrives at 06:00. Survive three dawns to complete the challenge—or keep exploring afterward.',
            ],
          ].map(([icon, title, text]) => (
            <article className="threat-row" key={title}>
              <span className="threat-icon">
                {icon === 'paw' ? (
                  <PixelPreview clip="wolf-run" scale={0.75} label="Wolf running animation" />
                ) : (
                  <Icon name={icon} size={27} />
                )}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
export function JourneyDialog({
  save,
  records,
  onClose,
  onContinue,
  onNew,
}: {
  save: GameState | null;
  records: RunRecord[];
  onClose: () => void;
  onContinue: () => void;
  onNew: () => void;
}) {
  return (
    <Modal title="Every night leaves a story." eyebrow="YOUR JOURNEY" onClose={onClose}>
      <div className="journey-stats">
        <div>
          <strong>{records.length}</strong>
          <span>STORIES TOLD</span>
        </div>
        <div>
          <strong>{records.reduce((n, r) => n + r.nights, 0)}</strong>
          <span>NIGHTS SURVIVED</span>
        </div>
        <div>
          <strong>{records.filter((r) => r.outcome === 'won').length}</strong>
          <span>FORESTS BRAVED</span>
        </div>
      </div>
      {save && (
        <div className="saved-journey">
          <div className="saved-journey-icon">
            <Icon name="fire" size={25} />
          </div>
          <div>
            <span className="eyebrow">A STORY STILL UNFOLDING</span>
            <h3>{save.name}’s camp</h3>
            <p>
              Day {Math.floor(save.time / DAY_LENGTH) + 1} · {save.difficulty} · {save.nights} nights survived
            </p>
          </div>
          <button className="icon-button" aria-label="Continue saved adventure" onClick={onContinue}>
            <Icon name="arrow" />
          </button>
        </div>
      )}
      {!records.length ? (
        <div className="empty-journey">
          <PixelPreview clip="idle-down" label="A wandering forest survivor" />
          <h3>Your story is still out there.</h3>
          <p>
            A fresh trail. An unfamiliar sky.
            <br />
            The forest is ready when you are.
          </p>
          <button className="button button-secondary" onClick={save ? onContinue : onNew}>
            {save ? 'Back to your camp' : 'Find your first adventure'}
            <Icon name="arrow" size={14} />
          </button>
        </div>
      ) : (
        <div className="past-journeys">
          <span className="eyebrow">TALES FROM THE TREE LINE</span>
          {records.map((r, i) => (
            <div className="past-journey" key={`${r.date}-${i}`}>
              <Icon name={r.outcome === 'won' ? 'sun' : 'leaf'} size={22} />
              <div>
                <strong>{r.name}</strong>
                <span>
                  {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                  {r.difficulty}
                </span>
              </div>
              <div>
                <strong>{r.nights} nights</strong>
                <span>{r.outcome === 'won' ? 'Made it to morning' : 'Returned to the wild'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="autosave-note">Your stories are stored locally on this device.</p>
    </Modal>
  );
}
export function BiomeDialog({ biome, onClose }: { biome: string; onClose: () => void }) {
  const alpine = biome === 'The Alpine';
  return (
    <Modal title="Beyond the tree line." eyebrow="SOME PLACES ARE WORTH WAITING FOR" onClose={onClose}>
      <div className={`coming-soon-art ${alpine ? 'alpine-art' : 'dunes-art'}`} />
      <div className="coming-soon-copy">
        <span className="small-badge">
          <Icon name="lock" size={11} />
          ON THE HORIZON
        </span>
        <h3>{biome}</h3>
        <p>
          {alpine
            ? 'A quieter world of frozen lakes, thin air, and snow-covered peaks. The Alpine is a future chapter, not a playable region just yet.'
            : 'Sun-scorched days, freezing nights, and a horizon that never seems to end. The Dunes is a future chapter, not a playable region just yet.'}
        </p>
        <button className="button button-primary full-width" onClick={onClose}>
          The forest is waiting
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </Modal>
  );
}
