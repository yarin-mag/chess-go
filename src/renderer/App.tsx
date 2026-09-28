import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { OpeningExplorerScreen } from './components/OpeningExplorerScreen';
import { PuzzleMapScreen } from './components/PuzzleMapScreen';
import { PuzzleScreen } from './components/PuzzleScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SavedGamesScreen } from './components/SavedGamesScreen';
import { WeaknessDashboardScreen } from './components/WeaknessDashboardScreen';
import { useGameStore } from './features/game/gameStore';
import { useOpeningExplorerStore } from './features/openings/openingExplorerStore';
import { useOnlineLobbyStore } from './features/online/onlineLobbyVisibilityStore';
import { useSavedGamesVisibilityStore } from './features/history/savedGamesVisibilityStore';
import { useWeaknessDashboardStore } from './features/history/weaknessDashboardStore';
import { usePuzzleStore } from './features/puzzle/puzzleStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const puzzleStatus = usePuzzleStore((s) => s.status);
  const exploringOpenings = useOpeningExplorerStore((s) => s.visible);
  const viewingStats = useWeaknessDashboardStore((s) => s.visible);
  const viewingSavedGames = useSavedGamesVisibilityStore((s) => s.visible);
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
  const hideOnlineLobby = useOnlineLobbyStore((s) => s.hide);

  if (reviewing) return <ReviewScreen />;
  if (puzzleStatus === 'map') return <PuzzleMapScreen onExit={exitPuzzle} />;
  if (puzzleStatus !== 'idle') return <PuzzleScreen onExit={exitPuzzle} />;
  if (exploringOpenings) return <OpeningExplorerScreen onExit={hideOpeningExplorer} />;
  if (viewingStats) return <WeaknessDashboardScreen onExit={hideWeaknessDashboard} />;
  if (viewingSavedGames) return <SavedGamesScreen onExit={hideSavedGames} />;
  if (showingOnlineLobby) return <OnlineLobbyScreen onExit={hideOnlineLobby} />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
