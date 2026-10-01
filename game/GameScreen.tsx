import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import World, { EventKind, Stats } from './World';
import { Action, COLORS } from './constants';
import { CHARACTERS } from './characters';
import { DEFAULTS, SaveData, loadSave, saveData } from './save';
import {
  ACHIEVEMENTS,
  AchStats,
  DAILY_REWARDS,
  HEADSTART_COST,
  HOVERBOARD_COST,
  REVIVE_COST,
  MISSION_LABEL,
  UPGRADES,
  UpgradeKey,
  newMissions,
  todayKey,
} from './progress';
import {
  buzz,
  duckMusic,
  initAudio,
  settings as audioSettings,
  sfx,
  startMusic,
  stopMusic,
} from './audio';
import HomeScreen from './ui/HomeScreen';
import Hud from './ui/Hud';
import { GameOver, PauseMenu } from './ui/Overlays';
import {
  DailyModal,
  GoalsModal,
  MissionsModal,
  SettingsModal,
  StoreModal,
} from './ui/Modals';
import Tutorial from './ui/Tutorial';
import Splash from './ui/Splash';

type Phase = 'home' | 'playing' | 'over';
type Modal = null | 'store' | 'missions' | 'settings' | 'goals';
type Result = { score: number; coins: number; isNewBest: boolean };

/** Finger travel (dp) before a swipe counts. It fires while the finger is still moving. */
const SWIPE = 22;
const MAX_REVIVES = 2;

export default function GameScreen() {
  const [phase, setPhase] = useState<Phase>('home');
  const [paused, setPaused] = useState(false);
  const [runId, setRunId] = useState(0);
  const [reviveId, setReviveId] = useState(0);
  const [hero, setHero] = useState(0);
  const [readyId, setReadyId] = useState('');
  const [stats, setStats] = useState<Stats>({ score: 0, coins: 0 });
  const [result, setResult] = useState<Result>({
    score: 0,
    coins: 0,
    isNewBest: false,
  });
  const [runBest, setRunBest] = useState(0);
  const [zone, setZone] = useState('');
  const [banner, setBanner] = useState('');
  const [popup, setPopup] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [dailyIdx, setDailyIdx] = useState<number | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [sv, setSv] = useState<SaveData>(DEFAULTS);
  const [revives, setRevives] = useState(0);
  const [headStart, setHeadStart] = useState(false);
  const [hoverboard, setHoverboard] = useState(false);
  const [toast, setToast] = useState('');
  const [splash, setSplash] = useState(true);

  const save = useRef<SaveData>({ ...DEFAULTS });
  const inputRef = useRef<((a: Action) => void) | null>(null);
  const phaseRef = useRef<Phase>('home');
  const pausedRef = useRef(false);
  const blockedRef = useRef(false);
  const heroRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef({
    coins: 0,
    jumps: 0,
    near: 0,
    powers: 0,
    bankedCoins: 0,
    bankedDist: 0,
  });
  phaseRef.current = phase;
  pausedRef.current = paused;
  blockedRef.current = modal !== null || dailyIdx !== null;

  const character = CHARACTERS[hero];
  const loading = readyId !== character.id;

  // ---- helpers ---------------------------------------------------------
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /** Apply a change to the save data, refresh the UI, and write it to disk. */
  const update = useCallback((fn: (d: SaveData) => void) => {
    fn(save.current);
    setSv({ ...save.current });
    saveData(save.current);
  }, []);

  const applySettings = useCallback((st: SaveData['settings']) => {
    audioSettings.sound = st.sound;
    audioSettings.music = st.music;
    audioSettings.haptics = st.haptics;
    if (st.music) startMusic();
    else stopMusic();
  }, []);

  // ---- load save + daily / missions -----------------------------------------
  useEffect(() => {
    loadSave().then(d => {
      const today = todayKey();
      if (d.missionDay !== today || d.missions.length === 0) {
        d.missions = newMissions();
        d.missionDay = today;
      }
      save.current = d;
      setSv({ ...d });
      saveData(d);
      const i = CHARACTERS.findIndex(c => c.id === d.hero);
      if (i >= 0) {
        heroRef.current = i;
        setHero(i);
      }
      if (d.daily.last !== today) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        const streak = d.daily.last === yesterday ? d.daily.streak : 0;
        setDailyIdx(streak % DAILY_REWARDS.length);
      }
      setTimeout(() => {
        initAudio();
        applySettings(d.settings);
      }, 400);
    });
    return clearTimers;
  }, [applySettings, clearTimers]);

  // pause automatically when the app leaves the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st !== 'active') {
        stopMusic();
        if (phaseRef.current === 'playing') setPaused(true);
      } else if (!pausedRef.current || phaseRef.current !== 'playing') {
        if (save.current.settings.music) startMusic();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!sv.settings.music) return;
    if (paused) stopMusic();
    else startMusic();
  }, [paused, sv.settings.music]);

  // ---- hero selection / unlocking ------------------------------------------
  const selectHero = useCallback(
    (i: number) => {
      heroRef.current = i;
      setHero(i);
      update(d => {
        if (d.unlocked.includes(CHARACTERS[i].id)) d.hero = CHARACTERS[i].id;
      });
    },
    [update],
  );
  const stepHero = useCallback(
    (dir: number) => {
      sfx('click');
      selectHero(
        (heroRef.current + dir + CHARACTERS.length) % CHARACTERS.length,
      );
    },
    [selectHero],
  );
  const unlockHero = useCallback(() => {
    const c = CHARACTERS[heroRef.current];
    if (save.current.coins < c.price) return;
    update(d => {
      d.coins -= c.price;
      d.unlocked.push(c.id);
      d.hero = c.id;
    });
    sfx('unlock');
    buzz('success');
  }, [update]);

  // ---- popups & events --------------------------------------------------------
  const showPopup = useCallback((text: string) => {
    if (popTimer.current) clearTimeout(popTimer.current);
    setPopup(text);
    popTimer.current = setTimeout(() => setPopup(''), 1100);
  }, []);
  const onEvent = useCallback((k: EventKind) => {
    const r = run.current;
    if (k === 'coin') r.coins += 1;
    else if (k === 'jump') r.jumps += 1;
    else if (k === 'near') r.near += 1;
    else if (k === 'power') r.powers += 1;
  }, []);

  const onZone = useCallback(
    (name: string) => {
      setZone(name);
      later(() => setZone(''), 2200);
    },
    [later],
  );

  // ---- run lifecycle ---------------------------------------------------------
  /** Move the coins / mission progress earned since the last bank into the save. */
  const bank = useCallback(
    (s: Stats) => {
      const r = run.current;
      const newAch: string[] = [];
      update(d => {
        d.coins += s.coins - r.bankedCoins;
        const dist = (s.distance ?? 0) - r.bankedDist;
        d.missions.forEach(m => {
          if (m.claimed) return;
          if (m.type === 'coins') m.progress += r.coins;
          else if (m.type === 'distance') m.progress += Math.floor(dist);
          else if (m.type === 'jumps') m.progress += r.jumps;
          else if (m.type === 'near') m.progress += r.near;
          else if (m.type === 'powers') m.progress += r.powers;
          else if (m.type === 'score')
            m.progress = Math.max(m.progress, s.score);
        });
        const t = d.totals;
        t.coins += s.coins - r.bankedCoins;
        t.distance += Math.floor(dist);
        t.near += r.near;
        t.powers += r.powers;
        t.jumps += r.jumps;
        // achievements pay out the moment they are reached
        const st: AchStats = {
          ...t,
          bestScore: Math.max(d.best, s.score),
          unlocked: d.unlocked.length,
        };
        ACHIEVEMENTS.forEach(a => {
          if (!d.ach.includes(a.id) && a.test(st)) {
            d.ach.push(a.id);
            d.coins += a.reward;
            newAch.push(a.name);
          }
        });
      });
      if (newAch.length) {
        setToast(
          `GOAL COMPLETE: ${newAch[0]}${
            newAch.length > 1 ? ` +${newAch.length - 1}` : ''
          }`,
        );
        later(() => setToast(''), 3200);
        sfx('unlock');
      }
      r.bankedCoins = s.coins;
      r.bankedDist = s.distance ?? r.bankedDist;
      r.coins = r.jumps = r.near = r.powers = 0;
    },
    [update, later],
  );

  const lastStats = useRef<Stats>({ score: 0, coins: 0 });
  const onStats = useCallback((s: Stats) => {
    lastStats.current = s;
    setStats(s);
  }, []);

  const start = useCallback(() => {
    if (!save.current.unlocked.includes(CHARACTERS[heroRef.current].id)) return;
    clearTimers();
    run.current = {
      coins: 0,
      jumps: 0,
      near: 0,
      powers: 0,
      bankedCoins: 0,
      bankedDist: 0,
    };
    lastStats.current = { score: 0, coins: 0 };
    setStats({ score: 0, coins: 0 });
    setRunBest(save.current.best);
    setRevives(0);
    setPaused(false);
    const useHead = save.current.headstarts > 0;
    if (useHead) {
      update(d => {
        d.headstarts -= 1;
      });
    }
    setHeadStart(useHead);
    const useBoard = save.current.hoverboards > 0;
    if (useBoard) {
      update(d => {
        d.hoverboards -= 1;
      });
    }
    setHoverboard(useBoard);
    update(d => {
      d.totals.runs += 1;
    });
    setRunId(r => r + 1);
    setPhase('playing');
    setBanner('');
    setPopup('');
    duckMusic(false);
    sfx('click');
    later(() => {
      setBanner('GO!');
      sfx('go');
    }, 600);
    later(() => setBanner(''), 1500);
    if (!save.current.tutorialDone) {
      later(() => setTutorial(true), 1400);
      later(() => {
        setTutorial(false);
        update(d => {
          d.tutorialDone = true;
        });
      }, 6800);
    }
  }, [clearTimers, later, update]);

  const toHome = useCallback(() => {
    if (phaseRef.current === 'playing') bank(lastStats.current); // keep what was earned
    clearTimers();
    duckMusic(false);
    setPaused(false);
    setBanner('');
    setZone('');
    setPopup('');
    setTutorial(false);
    setRunId(r => r + 1);
    setPhase('home');
    sfx('click');
  }, [bank, clearTimers]);

  const onGameOver = useCallback(
    (s: Stats) => {
      const isNewBest = s.score > save.current.best;
      bank(s);
      update(d => {
        d.best = Math.max(d.best, s.score);
      });
      lastStats.current = s;
      setStats(s);
      setResult({ score: s.score, coins: s.coins, isNewBest });
      later(() => setPhase('over'), 750);
    },
    [bank, later, update],
  );

  const reviveCost = revives < MAX_REVIVES ? REVIVE_COST(revives) : 0;
  const revive = useCallback(() => {
    const cost = REVIVE_COST(revives);
    if (save.current.coins < cost) return;
    update(d => {
      d.coins -= cost;
    });
    setRevives(n => n + 1);
    setReviveId(n => n + 1);
    setPhase('playing');
    setPaused(false);
    duckMusic(false);
    buzz('success');
  }, [revives, update]);

  // ---- progression actions ---------------------------------------------------
  const buyUpgrade = useCallback(
    (key: UpgradeKey) => {
      const u = UPGRADES.find(x => x.key === key)!;
      const lvl = save.current.upgrades[key];
      const cost = u.cost(lvl);
      if (lvl >= u.max || save.current.coins < cost) return;
      update(d => {
        d.coins -= cost;
        d.upgrades[key] += 1;
      });
      sfx('unlock');
      buzz('success');
    },
    [update],
  );
  const buyHeadStart = useCallback(() => {
    if (save.current.coins < HEADSTART_COST) return;
    update(d => {
      d.coins -= HEADSTART_COST;
      d.headstarts += 1;
    });
    sfx('unlock');
    buzz('success');
  }, [update]);
  const buyHoverboard = useCallback(() => {
    if (save.current.coins < HOVERBOARD_COST) return;
    update(d => {
      d.coins -= HOVERBOARD_COST;
      d.hoverboards += 1;
    });
    sfx('unlock');
    buzz('success');
  }, [update]);
  const claimMission = useCallback(
    (id: string) => {
      update(d => {
        const m = d.missions.find(x => x.id === id);
        if (m && !m.claimed && m.progress >= m.target) {
          m.claimed = true;
          d.coins += m.reward;
        }
      });
      sfx('power');
      buzz('success');
    },
    [update],
  );
  const claimDaily = useCallback(() => {
    if (dailyIdx === null) return;
    update(d => {
      d.coins += DAILY_REWARDS[dailyIdx];
      d.daily = { last: todayKey(), streak: dailyIdx + 1 };
    });
    setDailyIdx(null);
    sfx('unlock');
    buzz('success');
  }, [dailyIdx, update]);
  const changeSettings = useCallback(
    (st: SaveData['settings']) => {
      update(d => {
        d.settings = st;
      });
      applySettings(st);
    },
    [applySettings, update],
  );
  const openModal = useCallback((m: Modal) => {
    sfx('click');
    setModal(m);
  }, []);

  // ---- swipe input -------------------------------------------------------------
  const fired = useRef(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          fired.current = false;
        },
        onPanResponderMove: (_, { dx, dy }) => {
          if (
            phaseRef.current !== 'playing' ||
            pausedRef.current ||
            blockedRef.current ||
            fired.current
          ) {
            return;
          }
          const ax = Math.abs(dx);
          const ay = Math.abs(dy);
          if (Math.max(ax, ay) < SWIPE) return;
          fired.current = true;
          if (ax > ay) inputRef.current?.(dx > 0 ? 'right' : 'left');
          else inputRef.current?.(dy < 0 ? 'jump' : 'roll');
        },
        onPanResponderRelease: (_, { dx, dy }) => {
          if (phaseRef.current === 'home' && !blockedRef.current) {
            const ax = Math.abs(dx);
            if (ax > 45 && ax > Math.abs(dy)) stepHero(dx < 0 ? 1 : -1);
          }
        },
      }),
    [stepHero],
  );

  const missionAlert = sv.missions.some(
    m => !m.claimed && m.progress >= m.target,
  );
  const achStats: AchStats = {
    ...sv.totals,
    bestScore: sv.best,
    unlocked: sv.unlocked.length,
  };
  const goalAlert = false;

  // live mission ticker: saved progress plus whatever this run has added so far
  const tickerMission = sv.missions.find(
    m => !m.claimed && m.progress < m.target,
  );
  let ticker = null as {
    label: string;
    progress: number;
    target: number;
  } | null;
  if (tickerMission && phase === 'playing') {
    const r = run.current;
    const add =
      tickerMission.type === 'coins'
        ? r.coins
        : tickerMission.type === 'distance'
        ? Math.floor((stats.distance ?? 0) - r.bankedDist)
        : tickerMission.type === 'jumps'
        ? r.jumps
        : tickerMission.type === 'near'
        ? r.near
        : tickerMission.type === 'powers'
        ? r.powers
        : 0;
    const progress =
      tickerMission.type === 'score'
        ? Math.max(tickerMission.progress, stats.score)
        : tickerMission.progress + add;
    ticker = {
      label: MISSION_LABEL[tickerMission.type](
        tickerMission.target,
      ).toUpperCase(),
      progress,
      target: tickerMission.target,
    };
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <World
        runId={runId}
        reviveId={reviveId}
        playing={phase !== 'home'}
        paused={paused}
        quality={sv.settings.quality}
        upgrades={sv.upgrades}
        headStart={headStart}
        hoverboard={hoverboard}
        character={character}
        onRigReady={setReadyId}
        inputRef={inputRef}
        onStats={onStats}
        onGameOver={onGameOver}
        onZone={onZone}
        onEvent={onEvent}
        onPopup={showPopup}
      />
      {/* transparent layer above the GL canvas so it can't swallow touches */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {phase !== 'home' && (
        <Hud
          score={stats.score}
          coins={stats.coins}
          best={runBest}
          distance={stats.distance ?? 0}
          heroShort={character.short}
          comboFill={phase === 'playing' ? stats.comboFill : 0}
          ticker={ticker}
          accent={character.accent}
          zone={phase === 'playing' ? zone : ''}
          banner={phase === 'playing' ? banner : ''}
          popup={phase === 'playing' ? popup : ''}
          fx={phase === 'playing' ? stats.fx : undefined}
          combo={phase === 'playing' ? stats.combo : 0}
          onPause={() => {
            sfx('click');
            setPaused(true);
          }}
        />
      )}

      {phase === 'playing' && tutorial && !paused && <Tutorial />}

      {phase === 'home' && (
        <HomeScreen
          index={hero}
          loading={loading}
          best={sv.best}
          coins={sv.coins}
          unlocked={sv.unlocked}
          onStep={stepHero}
          onSelect={i => {
            sfx('click');
            selectHero(i);
          }}
          onPlay={start}
          onUnlock={unlockHero}
          onOpen={openModal}
          alerts={{ missions: missionAlert, goals: goalAlert }}
        />
      )}

      {phase === 'playing' && paused && (
        <PauseMenu
          hero={character}
          onResume={() => {
            sfx('click');
            setPaused(false);
          }}
          onRestart={start}
          onQuit={toHome}
        />
      )}

      {phase === 'over' && (
        <GameOver
          hero={character}
          score={result.score}
          coins={result.coins}
          best={sv.best}
          isNewBest={result.isNewBest}
          totalCoins={sv.coins}
          distance={stats.distance ?? 0}
          reviveCost={reviveCost}
          canRevive={sv.coins >= reviveCost}
          onRevive={revive}
          onAgain={start}
          onMenu={toHome}
        />
      )}

      {phase === 'home' && modal === 'store' && (
        <StoreModal
          coins={sv.coins}
          upgrades={sv.upgrades}
          headstarts={sv.headstarts}
          hoverboards={sv.hoverboards}
          onBuyBoard={buyHoverboard}
          onBuyHead={buyHeadStart}
          onBuy={buyUpgrade}
          onClose={() => setModal(null)}
        />
      )}
      {phase === 'home' && modal === 'missions' && (
        <MissionsModal
          missions={sv.missions}
          coins={sv.coins}
          onClaim={claimMission}
          onClose={() => setModal(null)}
        />
      )}
      {phase === 'home' && modal === 'settings' && (
        <SettingsModal
          settings={sv.settings}
          onChange={changeSettings}
          onClose={() => setModal(null)}
        />
      )}
      {phase === 'home' && modal === 'goals' && (
        <GoalsModal
          done={sv.ach}
          stats={achStats}
          coins={sv.coins}
          onClose={() => setModal(null)}
        />
      )}
      {toast !== '' && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      {phase === 'home' && dailyIdx !== null && (
        <DailyModal streak={dailyIdx} onClaim={claimDaily} />
      )}
      {splash && (
        <Splash ready={readyId !== ''} onDone={() => setSplash(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  toast: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,210,63,0.95)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  toastText: {
    color: '#120326',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
