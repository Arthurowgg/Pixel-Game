import { LoadingScreen } from './components/LoadingScreen';
import { BOOT_TASKS, finishTransition, loadTasks, nextPaint } from './game/loading';
import type { LoadProgress } from './game/loading';
import { FieldcraftDialog } from './components/TrailDialogs';
import { useEffect, useState } from 'react';
import { MainMenu } from './components/Menu';
import {
  BiomeDialog,
  GuideDialog,
  JourneyDialog,
  NewAdventure,
  SettingsDialog,
} from './components/MenuDialogs';
import { GameShell } from './components/GameShell';
import { audio } from './game/audio';
import { createGame } from './game/simulation';
import { loadGame, loadRecords, loadSettings, saveGame, saveSettings } from './game/storage';
import type { Difficulty, GameState, Settings } from './game/types';

type MenuOverlay = 'new' | 'settings' | 'guide' | 'journey' | 'biome' | 'fieldcraft' | null;
export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState('Unpacking the wilderness…');
  const [bootProgress, setBootProgress] = useState<LoadProgress>({
    completed: 0,
    total: BOOT_TASKS.length,
    label: 'Preparing supplies',
  });
  useEffect(() => {
    const controller = new AbortController();
    const started = performance.now();
    setBootError(null);
    setBootPhase('Unpacking the wilderness…');
    void (async () => {
      try {
        await loadTasks(BOOT_TASKS, setBootProgress, controller.signal);
        if (controller.signal.aborted) return;
        setBootPhase('Your little world is ready.');
        await nextPaint();
        await finishTransition(started);
        if (!controller.signal.aborted) setBootReady(true);
      } catch (error) {
        if (!controller.signal.aborted)
          setBootError(
            error instanceof Error ? error.message : 'A forest asset failed to load. Please try again.',
          );
      }
    })();
    return () => controller.abort();
  }, [bootAttempt]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [save, setSave] = useState<GameState | null>(loadGame);
  const [game, setGame] = useState<GameState | null>(null);
  const [session, setSession] = useState(0);
  const [arrival, setArrival] = useState<'new' | 'resume'>('new');
  const [overlay, setOverlay] = useState<MenuOverlay>(null);
  const [biome, setBiome] = useState('The Alpine');
  const [records, setRecords] = useState(loadRecords);
  useEffect(() => {
    audio.configure(settings);
    saveSettings(settings);
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  }, [settings]);
  const start = (name: string, difficulty: Difficulty) => {
    const fresh = createGame(name, difficulty);
    setArrival('new');
    saveGame(fresh);
    setSave(fresh);
    setSession((s) => s + 1);
    setGame(fresh);
    setOverlay(null);
  };
  const continueGame = () => {
    const checkpoint = loadGame();
    if (checkpoint) {
      setArrival('resume');
      setGame(checkpoint);
      setSession((s) => s + 1);
      setOverlay(null);
    } else {
      setSave(null);
      setOverlay('new');
    }
  };
  const quit = () => {
    setGame(null);
    setSave(loadGame());
    setRecords(loadRecords());
    setOverlay(null);
  };
  const close = () => setOverlay(null);
  return (
    <div
      className="app"
      onPointerDown={() => {
        void audio.unlock();
      }}
      onClick={(event) => {
        if ((event.target as Element).closest('button')) audio.play('click');
      }}
    >
      {!bootReady ? (
        <LoadingScreen
          kind="boot"
          progress={bootProgress}
          phase={bootPhase}
          error={bootError}
          onRetry={() => setBootAttempt((value) => value + 1)}
          reducedMotion={settings.reducedMotion}
        />
      ) : game ? (
        <GameShell
          key={session}
          initial={game}
          arrival={arrival}
          settings={settings}
          onSettings={setSettings}
          onQuit={quit}
          onRestart={() => start(game.name, game.difficulty)}
        />
      ) : (
        <MainMenu
          save={save}
          settings={settings}
          onNew={() => setOverlay('new')}
          onContinue={continueGame}
          onSettings={() => setOverlay('settings')}
          onGuide={() => setOverlay('guide')}
          onFieldcraft={() => setOverlay('fieldcraft')}
          onJourney={() => {
            setRecords(loadRecords());
            setOverlay('journey');
          }}
          onBiome={(name) => {
            setBiome(name);
            setOverlay('biome');
          }}
          onSound={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
        />
      )}
      {overlay === 'new' && <NewAdventure hasSave={!!save} onClose={close} onStart={start} />}
      {overlay === 'settings' && (
        <SettingsDialog settings={settings} onChange={setSettings} onClose={close} />
      )}
      {overlay === 'guide' && <GuideDialog onClose={close} />}
      {overlay === 'fieldcraft' && <FieldcraftDialog onClose={close} />}
      {overlay === 'journey' && (
        <JourneyDialog
          save={save}
          records={records}
          onClose={close}
          onContinue={continueGame}
          onNew={() => setOverlay('new')}
        />
      )}
      {overlay === 'biome' && <BiomeDialog biome={biome} onClose={close} />}
    </div>
  );
}
