import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { OfflineBlockedScreen } from './components/OfflineBlockedScreen';
import { GameScreen } from './components/GameScreen';
import { GlossaryScreen } from './components/GlossaryScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { OpeningExplorerScreen } from './components/OpeningExplorerScreen';
import { PuzzleMapScreen } from './components/PuzzleMapScreen';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SavedGamesScreen } from './components/SavedGamesScreen';
import { WeaknessDashboardScreen } from './components/WeaknessDashboardScreen';
import { decideGate } from './features/auth/authGate';
import { useAuthStore } from './features/auth/authStore';
import { useOnlineStatus } from './features/auth/useOnlineStatus';
import { useGameStore } from './features/game/gameStore';
import { useGlossaryVisibilityStore } from './features/glossary/glossaryVisibilityStore';
import { useOpeningExplorerStore } from './features/openings/openingExplorerStore';
import { useOnlineLobbyStore } from './features/online/onlineLobbyVisibilityStore';
import { useSavedGamesVisibilityStore } from './features/history/savedGamesVisibilityStore';
import { useWeaknessDashboardStore } from './features/history/weaknessDashboardStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  // Every hook this component can possibly need is called unconditionally, every render — the auth
  // gate branches only *after* all of them have run. Returning early between hook calls (as an
  // earlier version of this function did) violates React's Rules of Hooks: the number of hooks
  // called must never change between renders, and the gate legitimately does change between renders
  // (checking -> showApp, or signedIn -> offlineBlocked) as connectivity/auth state changes.
  const { isLoaded, isSignedIn } = useAuth();
  const { status, hasEverAuthenticated, setChecking, setSignedOut } = useAuthStore();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isLoaded) return setChecking();
    if (!isSignedIn) setSignedOut();
    // A truthy isSignedIn is handled by AuthGateScreen's own effect calling setSignedIn once /me
    // resolves — this effect only ever needs to move state *toward* signedOut/checking.
  }, [isLoaded, isSignedIn, setChecking, setSignedOut]);

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

  const gate = decideGate({ hasEverAuthenticated, status, isOnline });
  if (gate === 'checking') return null;
  if (gate === 'showSignIn') return <AuthGateScreen />;
  if (gate === 'offlineBlocked') return <OfflineBlockedScreen />;
  // 'showApp' and 'offlineFallback' both fall through to the existing app below unchanged —
  // offlineFallback is exactly today's app, by construction (no account, no coins UI to show yet
  // regardless, since sub-project 2 hasn't shipped any).

  if (reviewing) return <ReviewScreen />;
  if (puzzleStatus === 'map') return <PuzzleMapScreen onExit={exitPuzzle} />;
  if (puzzleStatus !== 'idle') return <PuzzleScreen onExit={exitPuzzle} />;
  if (exploringOpenings) return <OpeningExplorerScreen onExit={hideOpeningExplorer} />;
  if (viewingStats) return <WeaknessDashboardScreen onExit={hideWeaknessDashboard} />;
  if (viewingSavedGames) return <SavedGamesScreen onExit={hideSavedGames} />;
  if (viewingGlossary) return <GlossaryScreen onExit={hideGlossary} />;
  if (showingOnlineLobby) return <OnlineLobbyScreen onExit={hideOnlineLobby} />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
