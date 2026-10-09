import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { OfflineBlockedScreen } from './components/OfflineBlockedScreen';
import { FriendsScreen } from './components/FriendsScreen';
import { GameScreen } from './components/GameScreen';
import { GlossaryScreen } from './components/GlossaryScreen';
import { HomeScreen } from './components/HomeScreen';
import { LearnScreen } from './components/LearnScreen';
import { MeScreen } from './components/MeScreen';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { OpeningExplorerScreen } from './components/OpeningExplorerScreen';
import { PuzzleMapScreen } from './components/PuzzleMapScreen';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SavedGamesScreen } from './components/SavedGamesScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { ShopScreen } from './components/ShopScreen';
import { TabBar } from './components/TabBar';
import { WeaknessDashboardScreen } from './components/WeaknessDashboardScreen';
import { decideGate } from './features/auth/authGate';
import { useAuthStore } from './features/auth/authStore';
import { useOnlineStatus } from './features/auth/useOnlineStatus';
import { syncOfflineQueue } from './features/sync/syncClient';
import { useGameStore } from './features/game/gameStore';
import { useGlossaryVisibilityStore } from './features/glossary/glossaryVisibilityStore';
import { useNavStore } from './features/nav/navStore';
import { useOpeningExplorerStore } from './features/openings/openingExplorerStore';
import { useOnlineLobbyStore } from './features/online/onlineLobbyVisibilityStore';
import { useSavedGamesVisibilityStore } from './features/history/savedGamesVisibilityStore';
import { useWeaknessDashboardStore } from './features/history/weaknessDashboardStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';
import { useSettingsPanelStore } from './features/settings/settingsPanelStore';
import styles from './App.module.css';

/** Dev-only escape hatch: skip Clerk entirely and act as a fixed fake test account. `import.meta.env.DEV`
 *  is statically false in any `build`/`build:web` output, so this branch is dead-code-eliminated out of
 *  every real bundle regardless of what env vars happen to be set — it cannot exist in a shipped build.
 *  Exists so the app can be opened on a second device (e.g. a phone over LAN) without needing Clerk's
 *  OAuth redirect to resolve correctly from that device — Clerk's dev instance redirects back to the
 *  literal origin registered during `clerk init` (typically localhost), which a phone can never reach. */
const DEV_SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === '1';

export function App() {
  // Every hook this component can possibly need is called unconditionally, every render — the auth
  // gate branches only *after* all of them have run. Returning early between hook calls (as an
  // earlier version of this function did) violates React's Rules of Hooks: the number of hooks
  // called must never change between renders, and the gate legitimately does change between renders
  // (checking -> showApp, or signedIn -> offlineBlocked) as connectivity/auth state changes.
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { status, hasEverAuthenticated, setChecking, setSignedOut, setSignedIn } = useAuthStore();
  const isOnline = useOnlineStatus();

  // This effect — not AuthGateScreen's own — is the one place that ever reacts to isSignedIn becoming
  // true. AuthGateScreen only *renders* while decideGate() says 'showSignIn'; decideGate checks 'status'
  // itself, so a version of this effect that let AuthGateScreen own the isSignedIn->setSignedIn step
  // raced its own precondition — status never left 'checking'/'signedOut' fast enough for gate to reach
  // 'showSignIn' at exactly the render where isSignedIn flips true, so AuthGateScreen's effect could
  // simply never fire, leaving the app stuck showing nothing. Living here, on a component that's always
  // mounted regardless of what decideGate returns, this has no such window.
  useEffect(() => {
    if (DEV_SKIP_AUTH) {
      setSignedIn('dev-test-account', 'dev-test-user');
      return;
    }
    if (!isLoaded) {
      // Don't stomp a cached signed-in identity while Clerk is still loading (or unreachable, e.g.
      // offline) — authStore already started 'signedIn' from the cached accountId for exactly this
      // case; calling setChecking() unconditionally here would immediately overwrite that back to
      // 'checking', with no guarantee isLoaded ever arrives to undo it (Critical finding, final review).
      if (!useAuthStore.getState().accountId) setChecking();
      return;
    }
    if (!isSignedIn) return setSignedOut();
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE_URL as string;
      const res = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const { accountId, clerkUserId } = await res.json();
      setSignedIn(accountId, clerkUserId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, setChecking, setSignedOut, setSignedIn]);

  useEffect(() => {
    // No real identity, no real server to drain to — nothing to sync in dev-bypass mode.
    if (DEV_SKIP_AUTH || !(isOnline && status === 'signedIn')) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // syncOfflineQueue owns no timers of its own (keeps its own tests leak-free) — this effect is
    // what turns a failed attempt (server unreachable, network blip) into the exponential-backoff
    // retry the spec asks for, instead of waiting for the next isOnline/status change to try again.
    // The effect's own cleanup (unmount, or isOnline/status changing away) clears any pending retry.
    let backoffMs = 5_000;
    const attempt = () => {
      void syncOfflineQueue(getToken).then((drained) => {
        if (cancelled || drained) return;
        timer = setTimeout(attempt, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 5 * 60_000);
      });
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOnline, status, getToken]);

  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const puzzleStatus = usePuzzleStore((s) => s.status);
  const exploringOpenings = useOpeningExplorerStore((s) => s.visible);
  const viewingStats = useWeaknessDashboardStore((s) => s.visible);
  const viewingSavedGames = useSavedGamesVisibilityStore((s) => s.visible);
  const viewingGlossary = useGlossaryVisibilityStore((s) => s.visible);
  const lobbyVisible = useOnlineLobbyStore((s) => s.visible);
  const gameStatus = useGameStore((s) => s.status);
  const inMenu = gameStatus === 'menu';
  // Lets the lobby's own visibility flag stay true harmlessly once the game actually starts —
  // gameStore.status flips to 'playing' inside onlineStore.hostGame/joinGame's startGame call, so the
  // plain inMenu ? <NewGameMenu/> : <GameScreen/> fallback below takes over without the lobby needing to
  // explicitly hide itself at that exact moment (it does anyway, from onlineStore.enterGame, for cleanliness).
  const showingOnlineLobby = lobbyVisible && gameStatus !== 'playing';
  const exitPuzzle = usePuzzleStore((s) => s.exit);
  const hideOpeningExplorer = useOpeningExplorerStore((s) => s.hide);
  const hideWeaknessDashboard = useWeaknessDashboardStore((s) => s.hide);
  const hideSavedGames = useSavedGamesVisibilityStore((s) => s.hide);
  const hideGlossary = useGlossaryVisibilityStore((s) => s.hide);
  const hideOnlineLobby = useOnlineLobbyStore((s) => s.hide);
  const tab = useNavStore((s) => s.tab);
  const settingsOpen = useSettingsPanelStore((s) => s.visible);
  const hideSettings = useSettingsPanelStore((s) => s.hide);

  const gate = decideGate({ hasEverAuthenticated, status, isOnline });
  if (gate === 'checking') return null;
  if (gate === 'showSignIn') return <AuthGateScreen />;
  if (gate === 'offlineBlocked') return <OfflineBlockedScreen />;
  // 'showApp' and 'offlineFallback' both fall through to the existing app below unchanged —
  // offlineFallback is exactly today's app, by construction (no account, no coins UI to show yet
  // regardless, since sub-project 2 hasn't shipped any).

  // Settings can be opened from several of the screens below (Me's gear icon, GameScreen's control bar,
  // the desktop nav rail's gear icon) — one shared overlay mount here instead of each screen owning its
  // own `<SettingsPanel>` instance and local open/close state.
  let screen;
  if (reviewing) screen = <ReviewScreen />;
  else if (puzzleStatus === 'map') screen = <PuzzleMapScreen onExit={exitPuzzle} />;
  else if (puzzleStatus !== 'idle') screen = <PuzzleScreen onExit={exitPuzzle} />;
  else if (exploringOpenings) screen = <OpeningExplorerScreen onExit={hideOpeningExplorer} />;
  else if (viewingStats) screen = <WeaknessDashboardScreen onExit={hideWeaknessDashboard} />;
  else if (viewingSavedGames) screen = <SavedGamesScreen onExit={hideSavedGames} />;
  else if (viewingGlossary) screen = <GlossaryScreen onExit={hideGlossary} />;
  else if (showingOnlineLobby) screen = <OnlineLobbyScreen onExit={hideOnlineLobby} />;
  else if (!inMenu)
    // A game that's actually in progress (or just ended) still owns the whole screen — the tab bar only
    // ever applies once the player is back at the top level (gameStore.backToMenu, called from
    // ControlBar's "Menu" button, is a pause: fen/history survive, so HomeScreen's "Resume my game" can
    // bring it back via resumeGame()).
    screen = <GameScreen />;
  else
    screen = (
      <div className={`round3 ${styles.shell}`}>
        <div className={styles.tabContent}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'learn' && <LearnScreen />}
          {tab === 'friends' && <FriendsScreen />}
          {tab === 'shop' && <ShopScreen />}
          {tab === 'me' && <MeScreen />}
        </div>
        <TabBar />
      </div>
    );

  return (
    <>
      {screen}
      <SettingsPanel open={settingsOpen} onClose={hideSettings} />
    </>
  );
}
